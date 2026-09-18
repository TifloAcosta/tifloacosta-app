(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_DOWNLOAD_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const directExtensions = new Set([
    'pdf','zip','rar','7z','txt','doc','docx','xls','xlsx','ppt','pptx',
    'epub','mp3','m4a','wav','ogg','mp4','m4v','mov','webm','apk','csv','json'
  ]);

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
    } catch (error) {
      return null;
    }
  }

  function hostMatches(host, domain) {
    return host === domain || host.endsWith(`.${domain}`);
  }

  function extensionFrom(url) {
    const filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    const match = filename.match(/\.([a-z0-9]{1,10})$/i);
    return match ? match[1].toLowerCase() : '';
  }

  function nameFromUrl(url, fallback = 'Archivo') {
    const raw = url.pathname.split('/').filter(Boolean).pop() || '';
    if (!raw) return fallback;
    try { return decodeURIComponent(raw); }
    catch (error) { return raw; }
  }

  function classifyUrl(value) {
    const url = normalizeUrl(value);
    if (!url) return { provider: 'invalid', url: null };
    const host = url.hostname.toLowerCase();
    if (hostMatches(host, 'drive.google.com')) return { provider: 'google-drive', url };
    if (hostMatches(host, 'dropbox.com')) return { provider: 'dropbox', url };
    if (host === '1drv.ms' || hostMatches(host, 'onedrive.live.com')) return { provider: 'onedrive', url };
    if (hostMatches(host, 'icloud.com')) return { provider: 'icloud-drive', url };
    if (hostMatches(host, 'box.com')) return { provider: 'box', url };
    if (hostMatches(host, 'mega.nz')) return { provider: 'mega', url };
    if (host === 'we.tl' || hostMatches(host, 'wetransfer.com')) return { provider: 'wetransfer', url };
    if (hostMatches(host, 'mediafire.com')) return { provider: 'mediafire', url };
    if (hostMatches(host, 'pcloud.link') || hostMatches(host, 'pcloud.com')) return { provider: 'pcloud', url };
    const ext = extensionFrom(url);
    return { provider: directExtensions.has(ext) ? 'direct' : 'web', url };
  }

  function resultItem(url, provider, name, type) {
    return { name, url: url.href, type: type || 'unknown', size: null, source: provider };
  }

  function resolveLocal(value) {
    const classified = classifyUrl(value);
    const { provider, url } = classified;
    if (!url) return { kind: 'invalid', provider: 'invalid', url: null, items: [] };

    if (provider === 'google-drive') {
      const match = url.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) {
        const direct = new URL('https://drive.google.com/uc');
        direct.searchParams.set('export', 'download');
        direct.searchParams.set('id', match[1]);
        return { kind: 'result', provider, url, items: [resultItem(direct, provider, 'Google Drive', 'unknown')] };
      }
    }

    if (provider === 'dropbox') {
      const direct = new URL(url.href);
      direct.searchParams.set('dl', '1');
      const name = nameFromUrl(direct, 'Archivo de Dropbox');
      const ext = extensionFrom(direct);
      return { kind: 'result', provider, url, items: [resultItem(direct, provider, name, ext || 'unknown')] };
    }

    if (provider === 'direct') {
      const ext = extensionFrom(url);
      return { kind: 'result', provider, url, items: [resultItem(url, provider, nameFromUrl(url), ext || 'unknown')] };
    }

    return { kind: 'needs-analyzer', provider, url, items: [] };
  }

  function normalizeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function filterResults(items, query = '', type = 'all') {
    const term = normalizeText(query);
    const wantedType = String(type || 'all').toLowerCase();
    return (Array.isArray(items) ? items : []).filter(item => {
      const typeOk = wantedType === 'all' || String(item?.type || '').toLowerCase() === wantedType;
      if (!typeOk) return false;
      if (!term) return true;
      const haystack = normalizeText(`${item?.name || ''} ${item?.type || ''} ${item?.source || ''}`);
      return haystack.includes(term);
    });
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && size >= 1024; index += 1) {
      size /= 1024;
      unit = units[index];
    }
    return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${unit}`;
  }

  return { normalizeUrl, classifyUrl, resolveLocal, filterResults, formatBytes };
}));
