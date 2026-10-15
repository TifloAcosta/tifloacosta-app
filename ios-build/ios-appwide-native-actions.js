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
    readmore: ['Leer noticia', 'Read story'], mark: ['Ir a marca', 'Go to bookmark'],
    like: ['Me gusta o quitar Me gusta', 'Like or remove like'],
    subscribe: ['Suscribirse o cancelar suscripción', 'Subscribe or unsubscribe'],
    comment: ['Comentar', 'Comment']
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
  let videoMode = 'channel';

  function scope() {
    const path = location.pathname.toLowerCase();
    const hash = decodeURIComponent(location.hash || '');
    const byId = id => document.getElementById(id);
    // Videos has one complete native screen with its own search and catalog.
    // Never stack the generic pilot above the branded Videos experience.
    if (path.endsWith('/videos.html')) return null;
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

  const yt = () => window.Capacitor?.Plugins?.TifloYouTube;
  const videoLink = id => 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);

  function announceVideo(message) {
    let status = document.getElementById('ios-video-action-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'ios-video-action-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.querySelector('#youtube-accessible-section')?.prepend(status);
    }
    if (status) { status.textContent = message; status.tabIndex = -1; status.focus(); }
  }

  async function authorizedAccount() {
    const api = yt();
    if (!api?.authStatus || !api?.signIn) {
      announceVideo(txt('El acceso a YouTube no está disponible.', 'YouTube account access is unavailable.'));
      return false;
    }
    const status = await api.authStatus();
    if (status?.authenticated) return true;
    const signed = await api.signIn();
    return signed?.authenticated === true;
  }

  async function runVideoSocial(operation, videoId, title) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;
    const api = yt();
    if (!api) return;
    try {
      if (!(await authorizedAccount())) return;
      if (operation === 'comment') {
        showVideoCommentEditor(videoId, title);
        return;
      }
      const state = await api.accountState({ videoId });
      const actionName = operation === 'like'
        ? (state.rating === 'like' ? 'unlike' : 'like')
        : (state.subscribed ? 'unsubscribe' : 'subscribe');
      await api.accountAction({ videoId, action: actionName });
      announceVideo(txt(
        actionName === 'unlike' ? 'Se retiró Me gusta.' :
          actionName === 'like' ? 'Me gusta registrado.' :
          actionName === 'unsubscribe' ? 'Suscripción cancelada.' : 'Suscripción realizada.',
        actionName === 'unlike' ? 'Like removed.' :
          actionName === 'like' ? 'Video liked.' :
          actionName === 'unsubscribe' ? 'Subscription canceled.' : 'Subscribed.'
      ));
    } catch {
      announceVideo(txt('No se pudo completar la acción. Comprueba la sesión de YouTube.',
        'Could not complete the action. Check your YouTube session.'));
    }
  }

  function showVideoCommentEditor(videoId, title) {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', txt('Comentar vídeo', 'Comment on video'));
    const heading = document.createElement('h2');
    heading.textContent = txt('Comentar: ', 'Comment: ') + title;
    const label = document.createElement('label');
    label.textContent = txt('Comentario', 'Comment');
    const field = document.createElement('textarea');
    field.rows = 5;
    field.maxLength = 8000;
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = txt('Publicar comentario', 'Publish comment');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = txt('Cancelar', 'Cancel');
    label.append(field);
    dialog.append(heading, label, submit, cancel);
    document.body.append(dialog);
    const close = () => { dialog.close(); dialog.remove(); };
    cancel.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    submit.addEventListener('click', async () => {
      const message = field.value.trim();
      if (!message) { field.focus(); return; }
      submit.disabled = true;
      try {
        await yt().accountAction({ videoId, action: 'comment', text: message });
        close();
        announceVideo(txt('Comentario publicado.', 'Comment published.'));
      } catch {
        submit.disabled = false;
        announceVideo(txt('No se pudo publicar el comentario.', 'Could not publish the comment.'));
      }
    });
    dialog.showModal();
    field.focus();
  }

  function gatherVideoRows(root, list, isSearch) {
    const searchField = document.getElementById('youtube-accessible-search');
    const channelSearch = () => {
      videoMode = 'channel';
      lastPresentedKey = '';
      schedule();
    };
    const enterSearch = () => {
      const input = searchField;
      if (input) {
        announceVideo(txt('Escribe un título y pulsa Buscar en YouTube.',
          'Enter a title and press Search YouTube.'));
        input.focus({ preventScroll: false });
      }
    };
    if (!isSearch && available(searchField)) makeEntry(searchField, 'video-control',
      txt('Buscar en YouTube', 'Search YouTube'), ['open'], enterSearch, list);
    const rows = root.querySelectorAll(isSearch ? '.youtube-search-card' : '.video-card');
    rows.forEach(card => {
      const title = card.querySelector('h3');
      const play = card.querySelector('.video-play-button');
      if (!title || !play) return;
      const videoId = String(play.dataset.videoId || '');
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;
      const metas = [...card.querySelectorAll('.video-meta')].map(x => x.textContent.trim()).filter(Boolean);
      const label = [title.textContent?.trim(), ...metas].filter(Boolean).join('. ');
      const keys = ['play', 'youtube', 'like', 'subscribe', 'share', 'comment'];
      makeEntry(play, 'video-row', label, keys, selected => {
        if (selected === 'play') { play.click(); return; }
        if (selected === 'youtube') {
          window.open(videoLink(videoId), '_blank', 'noopener');
          return;
        }
        if (selected === 'share') { void shareURL(videoLink(videoId), title.textContent.trim()); return; }
        if (['like', 'subscribe', 'comment'].includes(selected))
          void runVideoSocial(selected, videoId, title.textContent.trim());
      }, list);
    });
    if (isSearch) {
      const more = document.getElementById('youtube-accessible-more');
      if (available(more) && !more.hidden)
        makeEntry(more, 'video-control', txt('Mostrar diez resultados más', 'Show ten more results'),
          ['open'], () => more.click(), list);
      if (available(root)) makeEntry(root, 'video-control',
        txt('Vídeos de TifloAcosta', 'TifloAcosta videos'), ['open'], channelSearch, list);
    } else {
      const sort = document.getElementById('ios-video-order-adjustable');
      if (available(sort)) makeEntry(sort, 'video-control',
        sort.textContent.trim(), ['open'], () => { sort.focus(); sort.click(); allowReshow(); }, list);
      const next = document.getElementById('video-next');
      if (available(next) && !next.hidden)
        makeEntry(next, 'video-control', txt('Mostrar diez vídeos más', 'Show ten more videos'),
          ['open'], () => next.click(), list);
    }
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
    } else if (info.kind === 'video' || info.kind === 'video-search') {
      gatherVideoRows(root, list, info.kind === 'video-search');
    } else if (info.kind === 'podcast') {
      root.querySelectorAll('.podcast-episode-card').forEach(card => {
        const title = card.querySelector('h3');
        const play = card.querySelector('button');
        if (!title || !play) return;
        const description = card.querySelector('p:not(.resource-meta)');
        makeEntry(title, 'podcast', title.textContent?.trim(),
          description ? ['play', 'description'] : ['play'],
          selected => {
            if (selected === 'play') play.click();
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


  // A dedicated native page is shown only to VoiceOver users; all video
  // operations, search, pagination and playback stay on that single page.
  // Its Close control returns HOME, not a second, larger Videos interface.
  let launchingVideos = false;
  let videosPresented = false;
  let videoLaunchAttempted = false;
  async function showUnifiedVideos() {
    if (!location.pathname.toLowerCase().endsWith('/videos.html') ||
        launchingVideos || videosPresented || videoLaunchAttempted) return;
    const items = window.TIFLO_NATIVE_VIDEO_CATALOG;
    if (!Array.isArray(items) || !items.length) return;
    const api = native();
    if (!api?.showNativeVideoSection || !api?.getVoiceOverStatus) return;
    launchingVideos = true;
    try {
      if (!(await api.getVoiceOverStatus())?.enabled) return;
      videoLaunchAttempted = true;
      await api.addListener('nativeVideoClosed', () => {
        videosPresented = false;
        location.replace('index.html');
      });
      const response = await api.showNativeVideoSection({ videos: items.slice(0, 600) });
      videosPresented = response?.presented === true;
    } catch (error) {
      // No automatic modal retry loop; the accessible HTML screen stays usable.
      videosPresented = false;
    } finally { launchingVideos = false; }
  }
  window.addEventListener('tiflo-ios-catalog-ready', () => { void showUnifiedVideos(); });
  if (window.TIFLO_NATIVE_VIDEO_CATALOG) void showUnifiedVideos();

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

  document.getElementById('youtube-accessible-form')?.addEventListener('submit', () => {
    videoMode = 'results';
    lastPresentedKey = '';
  }, true);
  document.getElementById('youtube-accessible-more')?.addEventListener('click', () => {
    videoMode = 'results'; allowReshow();
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
