(() => {
  'use strict';
  // Installed only in TifloAcosta iOS. Never put a YouTube link in My Library.
  const native = () => window.Capacitor?.Plugins?.TifloShareInbox;
  const youtube = () => window.Capacitor?.Plugins?.TifloYouTube;
  const accessibility = () => window.Capacitor?.Plugins?.TifloReadingAccessibility;
  const tr = (es, en) => document.documentElement.lang === 'en' ? en : es;
  const reader = document.getElementById('reading-section');
  const home = document.getElementById('home-blocks');
  if (!reader || !home) return;
  let busy = false;
  let refreshing = false;
  let items = [];
  let previousItems = '';
  let hadQueryError = false;
  let renderedItems = '';
  let renderedHome = '';

  // Exact host names only: no lookalikes such as youtube.com.example.
  const ytHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com',
    'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be']);
  function urlsInText(raw) {
    const text = String(raw || '');
    return (text.match(/https?:\/\/[^\s<>"']+/gi) || [])
      .map(value => value.replace(/[)\]},;.!?]+$/g, ''));
  }
  function youtubeId(raw) {
    for (const candidate of urlsInText(raw)) {
      try {
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) ||
            !ytHosts.has(url.hostname.toLowerCase())) continue;
        const path = url.pathname.split('/').filter(Boolean);
        const id = ['youtu.be', 'www.youtu.be'].includes(url.hostname.toLowerCase())
          ? path[0] : path[0] === 'watch' ? url.searchParams.get('v')
          : ['shorts', 'live', 'embed', 'v'].includes(path[0]) ? path[1] : null;
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
  function safeName(value) {
    return String(value || 'Contenido').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 160);
  }
  function kindOf(item) {
    if (item.kind === 'file') return 'document';
    if (youtubeId(item.preview || '')) return 'youtube';
    if (externalURL(item.preview || '')) return 'link';
    return 'document';
  }
  function readerVisible() {
    return !reader.hidden && document.getElementById('reading-reader')?.hidden !== false;
  }
  function region(id, label) {
    const root = document.createElement('section');
    root.id = id;
    root.hidden = true;
    root.setAttribute('aria-label', label);
    root.classList.add('ios-share-inbox');
    const heading = document.createElement('h3');
    const list = document.createElement('div');
    list.classList.add('ios-share-inbox-items');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.tabIndex = -1;
    root.append(heading, list, status);
    return {root, heading, list, status};
  }
  const documentRegion = region('ios-share-inbox', tr('Documentos recibidos por Compartir', 'Documents received via Share'));
  const homeRegion = region('ios-shared-received', tr('Contenido recibido por Compartir', 'Content received via Share'));
  const status = documentRegion.status;
  const list = documentRegion.list;

  function mount() {
    const anchor = document.getElementById('ios-reading-import') ||
      document.getElementById('reading-file-label');
    if (anchor && anchor.nextElementSibling !== documentRegion.root) {
      anchor.after(documentRegion.root);
    }
    const nav = home.querySelector('nav');
    if (nav && homeRegion.root.nextElementSibling !== nav) {
      nav.before(homeRegion.root);
    }
  }
  async function exposeInbox(showDiagnostic = false) {
    if (!readerVisible() || (!items.some(item => kindOf(item) === 'document') && !showDiagnostic)) return;
    try {
      const result = await accessibility()?.dismissNativeActionList?.();
      if (result?.dismissed) {
        (list.querySelector('button') || status).focus({preventScroll: true});
      }
    } catch {}
  }
  function explain(error, dest) {
    const message = String(error?.message || error || '');
    const label = /App Group/i.test(message)
      ? tr('El grupo compartido de iOS no está disponible. El contenido no se ha eliminado.',
          'The iOS App Group is unavailable. The received content has not been deleted.')
      : tr('No se pudo completar esta operación. El contenido sigue disponible para reintentar.',
          'Could not complete this action. The content remains available to retry.');
    dest.textContent = label;
  }
  // A single activation from Home must complete the import, not merely navigate.
  // Wait for the actual router to expose the reader instead of guessing a delay.
  async function enterReaderSection() {
    if (!reader.hidden) return;
    if (location.hash !== '#reading') location.hash = '#reading';
    if (!reader.hidden) return;
    await new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      const finish = error => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        if (error) reject(error); else resolve();
      };
      const observer = new MutationObserver(() => {
        if (!reader.hidden) finish();
      });
      observer.observe(reader, {attributes:true, attributeFilter:['hidden']});
      timer = setTimeout(() => finish(new Error('reader-navigation-unavailable')), 8000);
      if (!reader.hidden) finish();
    });
  }
  async function importDocument(item, opened, targetStatus) {
    let file;
    if (opened.kind === 'file') {
      const uri = window.Capacitor?.convertFileSrc?.(opened.uri);
      if (!uri) throw new Error('missing-file-url');
      const response = await fetch(uri);
      if (!response.ok) throw new Error('file-unavailable');
      const blob = await response.blob();
      file = new File([blob], safeName(opened.name), {
        type: blob.type || 'application/octet-stream'
      });
    } else {
      const content = String(opened.value || '').trim();
      if (!content) throw new Error('missing-text');
      const name = safeName(opened.name).replace(/\.txt$/i, '');
      file = new File([content], name + '.txt', {type:'text/plain;charset=utf-8'});
    }
    const actions = window.TifloIOSBookActions;
    if (!actions?.importSharedFile) throw new Error('reader-unavailable');
    const imported = await actions.importSharedFile(file);
    // The reader must return the persisted book ID after reading it back.
    // A boolean from a temporary/open-only import must never delete the source.
    if (imported?.saved !== true || !imported.id) throw new Error('import-not-persisted');
    await native().acknowledge({id:item.id});
    targetStatus.textContent = tr('Documento incorporado a TifloLector.',
      'Document saved in TifloLector.');
  }
  async function execute(item, button, targetStatus) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    const mode = kindOf(item);
    targetStatus.textContent = mode === 'youtube'
      ? tr('Abriendo el vídeo compartido…', 'Opening shared video…')
      : mode === 'link'
      ? tr('Abriendo el enlace compartido…', 'Opening shared link…')
      : tr('Importando documento compartido…', 'Importing shared document…');
    try {
      // openItem is authoritative even when a source exposes only a short preview.
      const opened = await native().openItem({id:item.id});
      const raw = opened.kind === 'file' ? '' : String(opened.value || '');
      const id = youtubeId(raw);
      const address = externalURL(raw);
      if (id) {
        if (!youtube()?.open) throw new Error('youtube-player-unavailable');
        await youtube().open({videoId:id, title:tr('Vídeo compartido', 'Shared video')});
        // The native player promise resolves when it is closed.
        await native().acknowledge({id:item.id});
        targetStatus.textContent = tr('Vídeo abierto en el reproductor accesible.',
          'Video opened in the accessible player.');
      } else if (address) {
        if (!native()?.openURL) throw new Error('url-opener-unavailable');
        const result = await native().openURL({url:address});
        if (!result?.opened) throw new Error('url-not-opened');
        await native().acknowledge({id:item.id});
        targetStatus.textContent = tr('Enlace abierto.', 'Link opened.');
      } else {
        await enterReaderSection();
        await importDocument(item, opened, targetStatus);
      }
    } catch (error) {
      explain(error, targetStatus);
    } finally {
      busy = false;
      button.disabled = false;
      await refresh();
    }
  }
  function buttonFor(item, mode, target) {
    const control = document.createElement('button');
    control.type = 'button';
    control.classList.add('ios-share-inbox-item');
    const name = safeName(item.name);
    control.textContent = mode === 'youtube'
      ? tr('Reproducir vídeo compartido', 'Play shared video')
      : mode === 'link'
      ? tr('Abrir enlace compartido', 'Open shared link')
      : target === 'home'
      ? tr('Importar en TifloLector: ', 'Import in TifloLector: ') + name
      : tr('Importar ', 'Import ') + name;
    const dest = target === 'home' ? homeRegion.status : documentRegion.status;
    control.addEventListener('click', () => { void execute(item, control, dest); });
    return control;
  }
  function draw() {
    mount();
    const docs = items.filter(item => kindOf(item) === 'document');
    const readerKey = docs.map(i => i.id + ':' + i.kind + ':' + i.name).join('|');
    const allKey = items.map(i => i.id + ':' + i.kind + ':' + i.name + ':' + kindOf(i)).join('|');
    if (renderedItems !== readerKey || documentRegion.root.hidden !== (docs.length === 0)) {
      renderedItems = readerKey;
      documentRegion.root.hidden = docs.length === 0;
      documentRegion.heading.textContent = tr('Recibidos por Compartir: ', 'Received via Share: ') + docs.length;
      documentRegion.list.replaceChildren();
      for (const item of docs) documentRegion.list.append(buttonFor(item, 'document', 'reader'));
    }
    if (renderedHome !== allKey || homeRegion.root.hidden !== (items.length === 0)) {
      renderedHome = allKey;
      homeRegion.root.hidden = items.length === 0;
      homeRegion.heading.textContent = tr('Recibidos por Compartir: ', 'Received via Share: ') + items.length;
      homeRegion.list.replaceChildren();
      for (const item of items) homeRegion.list.append(buttonFor(item, kindOf(item), 'home'));
    }
  }
  async function refresh() {
    if (refreshing || busy) return;
    const inbox = native();
    if (!inbox?.pending) return;
    refreshing = true;
    try {
      const result = await inbox.pending();
      items = (Array.isArray(result?.items) ? result.items : []).filter(item =>
        item && /^[0-9a-f-]{36}$/i.test(item.id) &&
        ['file','url','text'].includes(item.kind));
      if (hadQueryError) {
        documentRegion.status.textContent = '';
        homeRegion.status.textContent = '';
        hadQueryError = false;
      }
      draw();
      const fingerprint = items.map(item => item.id).join('|');
      if (fingerprint !== previousItems) {
        previousItems = fingerprint;
        window.dispatchEvent(new Event('tiflo-share-inbox-changed'));
      }
      await exposeInbox();
    } catch (error) {
      hadQueryError = true;
      mount();
      documentRegion.root.hidden = false;
      documentRegion.heading.textContent = tr('Recibidos por Compartir', 'Received via Share');
      explain(error, documentRegion.status);
      await exposeInbox(true);
    } finally {
      refreshing = false;
    }
  }

  window.TifloIOSShareInbox = Object.freeze({refresh, youtubeId, externalURL, kindOf});
  const reload = () => {void refresh();};
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', reload, {once:true});
  else reload();
  window.addEventListener('load', reload);
  window.addEventListener('pageshow', reload);
  window.addEventListener('focus', reload);
  window.addEventListener('hashchange', reload);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reload();
  });
  setTimeout(reload, 450);
  setTimeout(reload, 1600);
})();