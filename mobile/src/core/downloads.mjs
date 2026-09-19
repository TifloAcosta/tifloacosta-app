const DIRECT_EXTENSIONS = new Set([
  'pdf', 'zip', 'rar', '7z', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'epub', 'mp3', 'm4a', 'wav', 'ogg', 'mp4', 'm4v', 'mov', 'webm', 'apk', 'csv', 'json'
]);

function codedError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

export function normalizeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
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
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function classifyUrl(value) {
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
  const extension = extensionFrom(url);
  return { provider: DIRECT_EXTENSIONS.has(extension) ? 'direct' : 'web', url };
}

function resultItem(url, provider, name, type) {
  return {
    name,
    url: url.href,
    type: type || 'unknown',
    size: null,
    source: provider
  };
}

export function resolveLocal(value) {
  const { provider, url } = classifyUrl(value);
  if (!url) return { kind: 'invalid', provider: 'invalid', url: null, items: [] };

  if (provider === 'google-drive') {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    if (match) {
      const direct = new URL('https://drive.google.com/uc');
      direct.searchParams.set('export', 'download');
      direct.searchParams.set('id', match[1]);
      return {
        kind: 'result',
        provider,
        url,
        items: [resultItem(direct, provider, 'Google Drive', 'unknown')]
      };
    }
  }

  if (provider === 'dropbox') {
    const direct = new URL(url.href);
    direct.searchParams.set('dl', '1');
    const extension = extensionFrom(direct);
    return {
      kind: 'result',
      provider,
      url,
      items: [resultItem(direct, provider, nameFromUrl(direct, 'Archivo de Dropbox'), extension || 'unknown')]
    };
  }

  if (provider === 'direct') {
    const extension = extensionFrom(url);
    return {
      kind: 'result',
      provider,
      url,
      items: [resultItem(url, provider, nameFromUrl(url), extension || 'unknown')]
    };
  }

  return { kind: 'needs-analyzer', provider, url, items: [] };
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') return '';
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

export function createAnalyzerClient({
  fetchFn = (...args) => fetch(...args),
  endpoint = 'https://tifloacosta.com/api/download/analyze',
  timeoutMs = 10_000
} = {}) {
  async function analyze(value) {
    if (!endpoint) throw codedError('service_unavailable');
    const url = normalizeUrl(value);
    if (!url) throw codedError('invalid_url');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.href }),
        signal: controller.signal
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw codedError('bad_response');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw codedError('bad_response');
      }
      if (!response.ok && !payload.code) throw codedError('service_unavailable');
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw codedError('timeout');
      if (error?.code) throw error;
      throw codedError('service_unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  return { analyze };
}
