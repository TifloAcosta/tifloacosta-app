(() => {
  'use strict';
  // iOS-only: received content has its own view, not a second TifloLector
  // library, floating native panel or Home overlay.
  const native = () => window.Capacitor?.Plugins?.TifloShareInbox;
  const youtube = () => window.Capacitor?.Plugins?.TifloYouTube;
  const tr = (es, en) => document.documentElement.lang === 'en' ? en : es;
  const screen = document.getElementById('ios-received-section');
  const heading = document.getElementById('ios-received-heading');
  const list = document.getElementById('ios-received-list');
  const status = document.getElementById('ios-received-status');
  const reader = document.getElementById('reading-section');
  if (!screen || !list || !status || !reader) return;
  let items = [];
  let fingerprint = '';
  let busy = false;
  let refreshing = false;
  let limit = 10;
  const titles = new Map();
  const titleRequests = new Set();
  let zipPromise = null;

  const hosts = new Set([
    'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
    'youtube-nocookie.com', 'www.youtube-nocookie.com',
    'youtu.be', 'www.youtu.be'
  ]);
  const audioExtensions = new Set(['mp3', 'm4a', 'aac', 'wav', 'aiff', 'flac']);
  function urlsInText(raw) {
    return (String(raw || '').match(/https?:\/\/[^\s<>"']+/gi) || [])
      .map(value => value.replace(/[)\]},;.!?]+$/g, ''));
  }
  function youtubeId(raw) {
    for (const candidate of urlsInText(raw)) {
      try {
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) || !hosts.has(url.hostname.toLowerCase())) continue;
        const parts = url.pathname.split('/').filter(Boolean);
        const host = url.hostname.toLowerCase();
        const id = ['youtu.be', 'www.youtu.be'].includes(host) ? parts[0]
          : parts[0] === 'watch' ? url.searchParams.get('v')
          : ['shorts', 'live', 'embed', 'v'].includes(parts[0]) ? parts[1] : null;
        if (/^[A-Za-z0-9_-]{11}$/.test(id || '')) return id;
      } catch {}
    }
    return '';
  }
  function externalURL(raw) {
    for (const candidate of urlsInText(raw)) {
      try {
        const url = new URL(candidate);
        if (['http:', 'https:'].includes(url.protocol) && url.hostname &&
            !url.username && !url.password) return url.href;
      } catch {}
    }
    return '';
  }
  function safeName(raw) {
    return String(raw || 'Contenido').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 160) || 'Contenido';
  }
  function extensionOf(raw) {
    return (safeName(raw).match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  }
  function kindOf(item) {
    if (item?.kind === 'file') {
      const ext = extensionOf(item.name);
      const type = String(item.contentType || '').toLowerCase();
      return audioExtensions.has(ext) || type.startsWith('audio/') ? 'audio' : 'document';
    }
    if (youtubeId(item?.preview || '')) return 'youtube';
    if (externalURL(item?.preview || '')) return 'link';
    return 'text';
  }
  function message(error) {
    const code = String(error?.message || error || '');
    if (/App Group/i.test(code)) {
      return tr('El almacenamiento compartido de iOS no está disponible. No se ha borrado ningún contenido.',
        'The iOS shared storage is unavailable. No content was deleted.');
    }
    if (/file-unavailable|missing-file-url|invalid-native-chunk|No se puede preparar el archivo/i.test(code)) {
      return tr('No se ha podido abrir este archivo. Se conserva en Recibidos para reintentarlo.',
        'This file could not be opened. It remains in Received for another attempt.');
    }
    if (/unsupported-audio-format/i.test(code)) {
      return tr('Este formato de audio aún no se puede guardar en la biblioteca. El original permanece en Recibidos.',
        'This audio format cannot yet be saved to the library. The original remains in Received.');
    }
    if (/import-not-persisted|not-saved|readback-failed|media-readback-failed/i.test(code)) {
      return tr('No se ha confirmado el guardado en la biblioteca. El original sigue en Recibidos.',
        'The library save could not be verified. The original remains in Received.');
    }
    return tr('La operación no se ha completado. El contenido permanece en Recibidos.',
      'The operation did not finish. The content remains in Received.');
  }
  function makeButton(parent, label, action, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener('click', action);
    parent.append(button);
    return button;
  }
  function itemStatus(card) {
    const result = document.createElement('p');
    result.className = 'ios-received-item-status';
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    card.append(result);
    return result;
  }
  function setError(error, localStatus) {
    const text = message(error);
    localStatus.textContent = text;
    status.textContent = text;
  }
  async function enterReader() {
    if (!reader.hidden) return;
    if (location.hash !== '#reading') location.hash = '#reading';
    if (!reader.hidden) return;
    await new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => { if (!reader.hidden) finish(); });
      let settled = false;
      const timer = setTimeout(() => finish(new Error('reader-navigation-unavailable')), 8000);
      function finish(error) {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        if (error) reject(error); else resolve();
      }
      observer.observe(reader, { attributes: true, attributeFilter: ['hidden'] });
      if (!reader.hidden) finish();
    });
  }
  async function nativeFile(itemId) {
    if (!native()?.readItemChunk || !itemId) throw new Error('file-unavailable');
    const parts = [];
    let offset = 0;
    let total = -1;
    let contentType = '';
    do {
      const chunk = await native().readItemChunk({ id: itemId, offset, length: 524288 });
      const size = Number(chunk?.size);
      const next = Number(chunk?.nextOffset);
      if (!Number.isInteger(size) || size <= 0 || size > 100 * 1024 * 1024 ||
          !Number.isInteger(next) || next <= offset || next > size ||
          (total >= 0 && total !== size) || typeof chunk?.data !== 'string') {
        throw new Error('invalid-native-chunk');
      }
      total = size;
      contentType = String(chunk.contentType || contentType);
      const raw = atob(chunk.data);
      if (raw.length !== next - offset) throw new Error('invalid-native-chunk');
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      parts.push(bytes);
      offset = next;
      if (chunk.done === true && offset !== total) throw new Error('invalid-native-chunk');
    } while (offset < total);
    return new Blob(parts, { type: contentType || 'application/octet-stream' });
  }
  function properFilename(raw, mime) {
    const name = safeName(raw);
    const suffix = extensionOf(name);
    if (suffix) return name;
    if (mime === 'application/epub+zip' || /^epub$/i.test(name)) return name + '.epub';
    if (/^audio\/(mpeg|mp3)/i.test(mime)) return name + '.mp3';
    return name;
  }
  async function makeFile(opened, itemId = '') {
    if (opened?.kind === 'file') {
      let blob = null;
      const url = window.Capacitor?.convertFileSrc?.(opened.uri);
      if (url) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const candidate = await response.blob();
            if (candidate.size > 0) blob = candidate;
          }
        } catch { /* Some WKWebView file URLs are unreadable despite existing bytes. */ }
      }
      if (!blob) blob = await nativeFile(itemId);
      const reported = String(opened.contentType || blob.type || '').toLowerCase();
      const name = properFilename(opened.name, reported);
      const type = extensionOf(name) === 'mp3' ? 'audio/mpeg'
        : extensionOf(name) === 'epub' ? 'application/epub+zip'
        : reported || 'application/octet-stream';
      return new File([blob], name, { type });
    }
    const value = String(opened?.value || '');
    if (!value.trim()) throw new Error('missing-text');
    const name = safeName(opened.name).replace(/\.txt$/i, '');
    return new File([value], name + '.txt', { type: 'text/plain;charset=utf-8' });
  }
  function genericEpubName(item) {
    const name = safeName(item?.name || '').toLowerCase().trim();
    return /^(epub|epub\.epub|contenido(?:\s*\(\d+\))?\.epub|content\.epub|documento\.epub)$/.test(name) ||
      (name === 'contenido' && String(item?.contentType || '').includes('epub'));
  }
  function epubItem(item) {
    return extensionOf(item?.name) === 'epub' ||
      String(item?.contentType || '').toLowerCase() === 'application/epub+zip' ||
      /^epub$/i.test(safeName(item?.name));
  }
  async function zipEngine() {
    if (window.JSZip?.loadAsync) return window.JSZip;
    if (zipPromise) return zipPromise;
    zipPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'ios-jszip.min.js';
      script.onload = () => window.JSZip?.loadAsync ? resolve(window.JSZip) : reject(new Error('zip-unavailable'));
      script.onerror = () => reject(new Error('zip-unavailable'));
      document.head.append(script);
    });
    return zipPromise;
  }
  async function epubTitle(file) {
    if (!file?.size || file.size > 100 * 1024 * 1024) return '';
    try {
      const Zip = await zipEngine();
      const zip = await Zip.loadAsync(await file.arrayBuffer());
      const container = zip.file('META-INF/container.xml');
      if (!container) return '';
      const doc = new DOMParser().parseFromString(await container.async('string'), 'application/xml');
      const path = doc.getElementsByTagNameNS('*', 'rootfile')[0]?.getAttribute('full-path');
      if (!path || path.includes('..') || path.startsWith('/')) return '';
      const opf = zip.file(path);
      if (!opf) return '';
      const xml = new DOMParser().parseFromString(await opf.async('string'), 'application/xml');
      const value = xml.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim() || '';
      return value.slice(0, 240);
    } catch { return ''; }
  }
  function displayTitle(item) {
    const resolved = titles.get(item.id);
    if (resolved) return resolved;
    if (kindOf(item) === 'youtube') return tr('Vídeo de YouTube: ', 'YouTube video: ') + youtubeId(item.preview);
    return safeName(item.name);
  }
  async function enrichTitle(item, target) {
    if (titles.has(item.id) || titleRequests.has(item.id)) return;
    const videoId = kindOf(item) === 'youtube' ? youtubeId(item.preview) : '';
    const needsEpub = epubItem(item) && genericEpubName(item);
    if (!videoId && !needsEpub) return;
    titleRequests.add(item.id);
    try {
      let resolved = '';
      if (videoId) {
        resolved = String((await native()?.resolveYouTubeTitle?.({ videoId }))?.title || '').trim();
        if (resolved && /^(Enlace|Link)$/i.test(resolved)) resolved = '';
      } else {
        let opened;
        try {
          opened = await native().openItem({ id: item.id });
        } catch {
          opened = { id: item.id, kind: 'file', name: item.name,
            contentType: item.contentType || '', uri: '' };
        }
        const file = await makeFile(opened, item.id);
        resolved = await epubTitle(file);
      }
      if (resolved && items.some(current => current.id === item.id)) {
        titles.set(item.id, resolved);
        if (target.isConnected) target.textContent = displayTitle(item) + ' — ' + {
          youtube: tr('Vídeo de YouTube', 'YouTube video'),
          document: tr('Documento o libro', 'Document or book')
        }[kindOf(item)];
      }
    } catch { /* A missing optional title never prevents access to content. */ }
    finally { titleRequests.delete(item.id); }
  }
  async function analyzeLink(url) {
    const form = document.getElementById('download-form');
    const input = document.getElementById('download-url');
    if (!form || !input) throw new Error('download-analyzer-unavailable');
    location.hash = '#downloads-link';
    input.value = url;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
  async function act(item, operation, button, localStatus) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    localStatus.textContent = tr('Procesando el contenido…', 'Processing content…');
    try {
      if (operation === 'delete') {
        const ok = window.confirm(tr('¿Eliminar este elemento de Recibidos? No se borrará una copia ya guardada en la biblioteca.',
          'Remove this item from Received? A saved library copy will not be deleted.'));
        if (!ok) return;
        const result = await native().acknowledge({ id: item.id });
        if (result?.acknowledged !== true) throw new Error('delete-failed');
        status.textContent = tr('Elemento eliminado de Recibidos.', 'Item removed from Received.');
        await refresh(true);
        return;
      }
      let opened = null;
      try {
        opened = await native().openItem({ id: item.id });
      } catch (error) {
        if (item.kind !== 'file' || !native()?.readItemChunk) throw error;
        // A failed temporary copy must not block native reading of the
        // original App Group bytes; older already-received items work too.
        opened = { id: item.id, kind: 'file', name: item.name,
          contentType: item.contentType || '', uri: '' };
      }
      if (!opened || opened.id !== item.id) throw new Error('missing-item');
      const url = opened.kind === 'file' ? '' : externalURL(opened.value);
      const videoId = opened.kind === 'file' ? '' : youtubeId(opened.value);
      if (videoId) {
        if (!youtube()?.open) throw new Error('youtube-unavailable');
        await youtube().open({ videoId, title: safeName(item.name) });
        localStatus.textContent = tr('Vídeo abierto. El enlace se conserva en Recibidos.',
          'Video opened. The link remains in Received.');
      } else if (url) {
        if (operation === 'analyze') {
          await analyzeLink(url);
          localStatus.textContent = tr('Enlace enviado al analizador. Se conserva en Recibidos.',
            'Link sent to the analyzer. It remains in Received.');
        } else {
          const result = await native()?.openURL?.({ url });
          if (!result?.opened) throw new Error('url-not-opened');
          localStatus.textContent = tr('Enlace abierto. Se conserva en Recibidos.',
            'Link opened. It remains in Received.');
        }
      } else {
        const file = await makeFile(opened, item.id);
        await enterReader();
        const actions = window.TifloIOSBookActions;
        if (operation === 'save') {
          // The current library stores only MPEG/MP3 audio. Offer listening
          // for other compatible formats, but never show a false save.
          if (kindOf(item) === 'audio' && extensionOf(file.name) !== 'mp3') {
            throw new Error('unsupported-audio-format');
          }
          const saved = await actions?.importSharedFile?.(file);
          if (saved?.saved !== true || !saved.id) throw new Error('import-not-persisted');
          // Never delete the original until the reader verifies persisted bytes.
          const result = await native().acknowledge({ id: item.id });
          if (result?.acknowledged !== true) throw new Error('acknowledge-failed');
          localStatus.textContent = tr('Guardado en la biblioteca. Se ha retirado de Recibidos.',
            'Saved to the library. Removed from Received.');
        } else {
          const result = await actions?.readSharedFile?.(file);
          if (result?.opened !== true) throw new Error('reader-open-failed');
          // Reading or listening is NOT consent to delete a received item.
          localStatus.textContent = tr('Abierto sin guardarlo. El original sigue en Recibidos.',
            'Opened without saving. The original remains in Received.');
        }
      }
    } catch (error) {
      // If an import failed after navigation, return to the still-intact
      // Received item so VoiceOver can announce the recoverable error.
      if (location.hash === '#reading') location.hash = '#received';
      setError(error, localStatus);
    } finally {
      busy = false;
      button.disabled = false;
      await refresh();
    }
  }
  function renderItem(item) {
    const card = document.createElement('article');
    card.className = 'ios-received-item';
    const kind = kindOf(item);
    const labels = {
      document: tr('Documento o libro', 'Document or book'),
      audio: tr('Archivo de audio', 'Audio file'),
      youtube: tr('Vídeo de YouTube', 'YouTube video'),
      link: tr('Enlace web', 'Web link'),
      text: tr('Texto', 'Text')
    };
    // Native disclosure semantics: one VoiceOver stop per collapsed item.
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = displayTitle(item) + ' — ' + labels[kind];
    if (kind === 'youtube' || (epubItem(item) && genericEpubName(item))) {
      void enrichTitle(item, summary);
    }
    details.append(summary);
    card.append(details);
    const actions = document.createElement('div');
    actions.className = 'ios-received-actions';
    details.append(actions);
    const localStatus = itemStatus(details);
    const action = (label, operation) => {
      let button = null;
      button = makeButton(actions, label, () => { void act(item, operation, button, localStatus); });
    };
    if (kind === 'document' || kind === 'text') {
      action(tr('Leer ahora', 'Read now'), 'read');
      action(tr('Guardar en biblioteca', 'Save to library'), 'save');
    } else if (kind === 'audio') {
      action(tr('Escuchar', 'Listen'), 'read');
      action(tr('Guardar audio en biblioteca', 'Save audio to library'), 'save');
    } else if (kind === 'youtube') {
      action(tr('Reproducir vídeo', 'Play video'), 'open');
    } else {
      action(tr('Abrir enlace', 'Open link'), 'open');
      action(tr('Analizar para descargar', 'Analyze for download'), 'analyze');
    }
    action(tr('Eliminar de Recibidos', 'Remove from Received'), 'delete');
    return card;
  }
  function render() {
    if (heading) heading.textContent = tr('Recibidos', 'Received');
    list.replaceChildren();
    const summary = document.createElement('p');
    summary.className = 'ios-received-summary';
    summary.textContent = items.length === 0
      ? tr('No hay contenidos pendientes.', 'No pending content.')
      : tr('Elementos pendientes: ', 'Pending items: ') + items.length;
    list.append(summary);
    for (const item of items.slice(0, limit)) list.append(renderItem(item));
    if (items.length > limit) {
      makeButton(list, tr('Mostrar diez más', 'Show ten more'), () => {
        limit += 10;
        render();
      }, 'ios-received-more');
    }
  }
  async function refresh(force = false) {
    if (refreshing || busy) return;
    if (!native()?.pending) return;
    refreshing = true;
    try {
      const result = await native().pending();
      const pending = (Array.isArray(result?.items) ? result.items : [])
        .filter(item => item && /^[0-9a-f-]{36}$/i.test(item.id) &&
          ['file', 'url', 'text'].includes(item.kind))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const next = pending.map(item => [item.id, item.name, item.kind, item.contentType, item.preview].join(':')).join('|');
      items = pending;
      for (const id of titles.keys()) if (!pending.some(item => item.id === id)) titles.delete(id);
      if (force || next !== fingerprint) {
        fingerprint = next;
        render();
      }
    } catch (error) {
      status.textContent = message(error);
    } finally {
      refreshing = false;
    }
  }
  // Exposed for test harnesses and native share notifications.
  window.TifloIOSShareInbox = Object.freeze({
    refresh, youtubeId, externalURL, kindOf
  });
  const reload = () => { void refresh(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reload, { once: true });
  else reload();
  window.addEventListener('pageshow', reload);
  window.addEventListener('focus', reload);
  window.addEventListener('hashchange', reload);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reload();
  });
})();
