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
    if (/file-unavailable|missing-file-url|No se puede preparar el archivo/i.test(code)) {
      return tr('No se ha podido abrir este archivo. Se conserva en Recibidos para reintentarlo.',
        'This file could not be opened. It remains in Received for another attempt.');
    }
    if (/import-not-persisted|not-saved|readback-failed/i.test(code)) {
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
  async function makeFile(opened) {
    if (opened?.kind === 'file') {
      const url = window.Capacitor?.convertFileSrc?.(opened.uri);
      if (!url) throw new Error('missing-file-url');
      const response = await fetch(url);
      if (!response.ok) throw new Error('file-unavailable');
      const blob = await response.blob();
      return new File([blob], safeName(opened.name), { type: blob.type || 'application/octet-stream' });
    }
    const value = String(opened?.value || '');
    if (!value.trim()) throw new Error('missing-text');
    const name = safeName(opened.name).replace(/\.txt$/i, '');
    return new File([value], name + '.txt', { type: 'text/plain;charset=utf-8' });
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
      const opened = await native().openItem({ id: item.id });
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
        const file = await makeFile(opened);
        await enterReader();
        const actions = window.TifloIOSBookActions;
        if (operation === 'save') {
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
    summary.textContent = safeName(item.name) + ' — ' + labels[kind];
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
      const next = pending.map(item => [item.id, item.name, item.kind, item.contentType].join(':')).join('|');
      items = pending;
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
