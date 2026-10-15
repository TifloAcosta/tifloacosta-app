(() => {
  'use strict';

  // This file is packaged ONLY in the iOS app. Native UITableView rows are
  // used throughout actionable collections, rather than trying to attach
  // VoiceOver rotor actions to unreliable WKWebView accessibility descendants.
  const native = () => window.Capacitor?.Plugins?.TifloReadingAccessibility;
  const english = () => document.documentElement.lang === 'en';
  const txt = (es, en) => english() ? en : es;
  const translations = {
    open: ['Abrir', 'Open'], play: ['Reproducir', 'Play'],
    read: ['Leer', 'Read'], youtube: ['Abrir en YouTube', 'Open in YouTube'],
    description: ['Leer descripción', 'Read description'],
    download: ['Descargar', 'Download'], share: ['Compartir', 'Share'],
    favorite: ['Añadir o quitar favorito', 'Add or remove favorite'],
    options: ['Opciones', 'Options'], copy: ['Copiar enlace', 'Copy link'],
    original: ['Abrir fuente original', 'Open original source'],
    delete: ['Eliminar', 'Delete'], rename: ['Cambiar título', 'Rename'],
    info: ['Información', 'Information'], move: ['Mover a carpeta', 'Move to folder'],
    queue: ['Añadir o quitar de cola', 'Add or remove from queue'],
    export: ['Exportar', 'Export'], translate: ['Traducir', 'Translate'],
    continue: ['Continuar lectura', 'Continue reading'],
    readmore: ['Leer noticia', 'Read story'], mark: ['Ir a marca', 'Go to bookmark']
  };
  const action = id => ({ id, label: txt(...translations[id]) });
  const available = node => Boolean(node && node.isConnected
    && !node.closest('[hidden], [aria-hidden="true"]')
    && node.getClientRects().length);
  const collection = new Map();
  const menuItems = new Map();
  let sequence = 0;
  let listenerReady = false;
  let nativeOpen = false;
  let awaitingNative = false;
  let lastPresentedKey = '';
  let scheduled = false;
  let refreshing = false;
  let currentSource = null;

  function scope() {
    const path = location.pathname.toLowerCase();
    const hash = decodeURIComponent(location.hash || '');
    const byId = id => document.getElementById(id);
    if (path.endsWith('/videos.html')) {
      const node = byId('video-list');
      return available(node) && available(byId('video-results-section'))
        ? { key: 'videos:' + (hash || 'list'), node, heading: txt('Vídeos', 'Videos'), kind: 'video' } : null;
    }
    if (path.endsWith('/podcast.html')) {
      const node = byId('podcast-episodes');
      return available(node)
        ? { key: 'podcasts:' + (hash || 'episodes'), node, heading: txt('Episodios', 'Episodes'), kind: 'podcast' } : null;
    }
    if (path.endsWith('/actualidad.html')) {
      if (!byId('news-reader')?.hidden) return null;
      let id = 'news-list', name = txt('Noticias', 'News');
      if (hash.includes('apps')) { id = 'apps-list'; name = txt('Aplicaciones accesibles', 'Accessible apps'); }
      if (hash.includes('media-accessibility')) { id = 'media-accessibility-list'; name = txt('Accesibilidad', 'Accessibility'); }
      if (hash.includes('media-technology')) { id = 'media-technology-list'; name = txt('Tecnología', 'Technology'); }
      if (hash === '#media-browser') { id = 'media-accessibility-list'; name = txt('Escuchar y ver', 'Listen and watch'); }
      const node = byId(id);
      return available(node) ? { key: 'actualidad:' + id, node, heading: name, kind: 'article' } : null;
    }
    if (!path.endsWith('/') && !path.endsWith('/index.html')) return null;
    const key = hash || '#home';
    const screens = {
      '#reading': ['reading-library-list', 'Biblioteca', 'Library', 'library'],
      '#resources': ['resource-results', 'Recursos', 'Resources', 'resource'],
      '#favorites': ['favorites-list', 'Favoritos', 'Favorites', 'resource'],
      '#news': ['news-list', 'Novedades', 'News', 'article'],
      '#guide': ['guide-chapters', 'Guía', 'Guide', 'article'],
      '#book': ['book-section', 'Mi libro', 'My book', 'article'],
      '#contact': ['contact-section', 'Contacto y redes', 'Contact and social', 'article'],
      '#privacy': ['privacy-section', 'Privacidad y accesibilidad', 'Privacy and accessibility', 'article'],
      '#downloads': ['downloads-list', 'Descargas', 'Downloads', 'article']
    };
    let info = screens[key];
    if (key === '#reading') {
      if (available(byId('reading-reader')) && !byId('reading-reader').hidden) return null;
      if (available(byId('reading-queue-web')) && !byId('reading-queue-web').hidden) {
        info = ['reading-queue-list', 'Cola de lectura', 'Reading queue', 'collection'];
      } else if (available(byId('reading-marks-web')) && !byId('reading-marks-web').hidden) {
        info = ['reading-marks-list', 'Marcas', 'Bookmarks', 'collection'];
      }
    }
    if (!info) return null;
    const node = byId(info[0]);
    return available(node) ? {
      key: key + ':' + info[0], node, heading: txt(info[1], info[2]), kind: info[3]
    } : null;
  }

  function idFor(node, kind) {
    if (kind === 'library' && node.id) return node.id;
    if (!node.dataset.tifloNativeActionId)
      node.dataset.tifloNativeActionId = 'native-across-app-' + (++sequence);
    return node.dataset.tifloNativeActionId;
  }

  function makeEntry(node, kind, title, keys, handler, list) {
    if (!available(node) || !title || !keys.length) return;
    const id = idFor(node, kind);
    const item = { id, label: title.slice(0, 450), actions: keys.map(action) };
    list.push(item);
    menuItems.set(id, item);
    collection.set(id, { node, kind, handler });
  }

  function newsEntries(root, list) {
    // Pages can contain articles, accessible app entries and media items. Use
    // actual existing links/buttons; never invent destructive operations.
    const seen = new Set();
    const nodes = root.querySelectorAll(
      '.news-card, .resource-card, article, li, .news-item, .app-card, .media-card, h3, a[href]'
    );
    for (const card of nodes) {
      const link = card.matches('a[href]') ? card : card.querySelector('a[href], button');
      if (!link || seen.has(link) || !available(link)) continue;
      seen.add(link);
      const url = link.href || '';
      const canLink = /^https?:/i.test(url);
      const title = card.querySelector('h2, h3, h4')?.textContent?.trim()
        || link.textContent?.trim() || link.getAttribute('aria-label') || '';
      if (!title) continue;
      const keys = ['open'];
      if (canLink) keys.push('share', 'copy');
      makeEntry(link, 'article', title, keys, selected => {
        if (selected === 'open') { link.click(); return; }
        if (selected === 'copy') { void copyURL(url); return; }
        if (selected === 'share') { void shareURL(url, title); }
      }, list);
    }
  }

  async function copyURL(url) {
    if (!/^https?:/i.test(url)) return;
    try { await navigator.clipboard.writeText(url); }
    catch { window.prompt?.(txt('Copia este enlace:', 'Copy this link:'), url); }
  }

  async function shareURL(url, title) {
    if (!/^https?:/i.test(url)) return;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    await copyURL(url);
  }

  function gather(info) {
    collection.clear();
    menuItems.clear();
    const list = [];
    const root = info.node;
    if (info.kind === 'library') {
      const entries = [...root.querySelectorAll('.reading-library-title')];
      for (const title of entries) {
        if (!available(title)) continue;
        const keys = ['open', 'continue', 'translate', 'queue', 'info', 'move', 'export', 'rename', 'delete'];
        // The iOS reading bridge already dispatches nativeListAction for these
        // exact DOM title IDs and keeps its deletion confirmation.
        makeEntry(title, 'library', title.textContent?.trim(), keys, null, list);
      }
    } else if (info.kind === 'video') {
      root.querySelectorAll('.video-card').forEach(card => {
        const title = card.querySelector('h3');
        const play = card.querySelector('.video-play-button');
        if (!title || !play) return;
        const keys = ['open'];
        const videoId = play.dataset.videoId || '';
        if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) keys.push('youtube');
        makeEntry(title, 'video', title.textContent?.trim(), keys, selected => {
          if (selected === 'open') play.click();
          else if (selected === 'youtube' && /^[a-zA-Z0-9_-]{11}$/.test(videoId))
            window.open('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId),
              '_blank', 'noopener,noreferrer');
        }, list);
      });
    } else if (info.kind === 'podcast') {
      root.querySelectorAll('.podcast-episode-card').forEach(card => {
        const title = card.querySelector('h3');
        const play = card.querySelector('button');
        if (!title || !play) return;
        const description = card.querySelector('p:not(.resource-meta)');
        makeEntry(title, 'podcast', title.textContent?.trim(),
          description ? ['open', 'description'] : ['open'],
          selected => {
            if (selected === 'open') play.click();
            if (selected === 'description' && description) {
              description.tabIndex = -1;
              description.focus({ preventScroll: true });
            }
          }, list);
      });
    } else if (info.kind === 'resource') {
      root.querySelectorAll('.resource-card a[aria-haspopup="dialog"]').forEach(link => {
        const keys = ['open', 'download', 'share', 'favorite', 'options'];
        makeEntry(link, 'resource', link.textContent?.trim(), keys, selected => {
          link.click();
          if (selected === 'options') return;
          const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
          const controls = dialog?.querySelector('.resource-actions');
          const index = { open: 0, download: 1, share: 2, favorite: 3 }[selected];
          const button = Number.isInteger(index) ? controls?.children[index] : null;
          button?.click();
        }, list);
      });
    } else if (info.kind === 'collection') {
      const seen = new Set();
      for (const row of root.querySelectorAll('li, article, .resource-card, .queue-item, .mark-item')) {
        const controls = [...row.querySelectorAll('button, a[href]')].filter(available);
        if (!controls.length || seen.has(controls[0])) continue;
        seen.add(controls[0]);
        const title = row.querySelector('h3, h4')?.textContent?.trim() || row.textContent?.trim().slice(0, 180);
        const operations = controls.slice(0, 8).map((node, index) => ({
          id: 'option-' + index,
          label: node.textContent?.trim() || node.getAttribute('aria-label') || txt('Acción', 'Action')
        }));
        const id = idFor(controls[0], 'collection');
        // Dynamic collection operation names must be mapped to a predefined
        // identifier to satisfy the native bridge input whitelist. Keep the
        // original controls available in HTML rather than guessing.
        if (operations.length && title) makeEntry(controls[0], 'collection', title, ['open'],
          () => controls[0].click(), list);
      }
    } else {
      newsEntries(root, list);
    }
    // Unique identifiers and bounded view to avoid overflowing native bridge.
    return list.slice(0, 200);
  }

  function routeKey(info) {
    return location.pathname + '|' + info.key + '|'
      + (english() ? 'en' : 'es');
  }

  async function ensureListeners(api) {
    if (listenerReady) return;
    listenerReady = true;
    try {
      await api.addListener('nativeListAction', ({ itemId, action: chosen }) => {
        nativeOpen = false;
        awaitingNative = false;
        const registered = collection.get(String(itemId || ''));
        if (registered && registered.kind !== 'library') {
          registered.handler?.(String(chosen || ''));
        }
      });
      await api.addListener('nativeListClosed', () => {
        nativeOpen = false;
        awaitingNative = false;
        // Closing a native content screen returns to the HTML controls for
        // filtering or searching, without immediately reopening the same list.
      });
    } catch {
      listenerReady = false;
    }
  }

  async function refresh() {
    if (refreshing || nativeOpen || awaitingNative) return;
    const api = native();
    if (!api?.showNativeActionList || !api?.getVoiceOverStatus) return;
    const info = scope();
    if (!info) {
      currentSource = null;
      return;
    }
    const key = routeKey(info);
    if (key === lastPresentedKey) return;
    refreshing = true;
    try {
      const items = gather(info);
      if (!items.length) return;
      const status = await api.getVoiceOverStatus();
      // Sighted users keep the existing screen without a forced modal.
      if (!status?.enabled) return;
      await ensureListeners(api);
      if (!listenerReady) return;
      const focused = document.activeElement?.dataset?.tifloNativeActionId
        || (document.activeElement?.classList?.contains('reading-library-title')
          ? document.activeElement.id : '');
      lastPresentedKey = key;
      awaitingNative = true;
      currentSource = info;
      try {
        await api.showNativeActionList({
          items,
          title: info.heading,
          language: english() ? 'en' : 'es',
          focusedItemId: items.some(item => item.id === focused) ? focused : items[0].id
        });
        nativeOpen = true;
      } catch {
        // Safe fallback: HTML stays functional on a native bridge failure.
        lastPresentedKey = '';
      } finally {
        awaitingNative = false;
      }
    } finally { refreshing = false; }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; void refresh(); }, 120);
  }

  function allowReshow() {
    lastPresentedKey = '';
    schedule();
  }

  // Touch users get a one-step native contextual action sheet on long press.
  // The menu is generated from the exact same registered actions as VoiceOver.
  document.addEventListener('contextmenu', event => {
    const target = event.target?.closest?.(
      '[data-tiflo-native-action-id], .reading-library-title'
    );
    if (!target) return;
    const id = target.classList.contains('reading-library-title')
      ? target.id : target.dataset.tifloNativeActionId;
    const item = menuItems.get(id);
    const api = native();
    if (!item || !api?.showNativeContextMenu) return;
    event.preventDefault();
    void ensureListeners(api).then(() => {
      if (!listenerReady) return;
      return api.showNativeContextMenu({
        item, language: english() ? 'en' : 'es'
      });
    }).catch(() => {});
  }, true);

  // A navigation opens the actual UIKit list once; changes to filters/pages
  // may reopen it on request. No temporary test button is installed.
  window.addEventListener('hashchange', allowReshow);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('focus', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule();
  });
  document.addEventListener('change', event => {
    if (event.target?.matches?.(
      '#news-category, #apps-platform, #reading-library-filter, #reading-library-query, #video-sort'
    )) allowReshow();
  }, true);
  document.addEventListener('click', event => {
    if (event.target?.closest?.(
      '#category-buttons, #video-pagination, #podcast-pagination, #reading-library-pager, #reading-queue-web, #reading-marks-web, #actualidad-sections, #media-sections'
    )) {
      allowReshow();
    }
  }, true);
  // Listen for DOM lists populated asynchronously. Observe only content/hidden
  // changes; synthetic IDs do not retrigger the observer.
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']
  });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
