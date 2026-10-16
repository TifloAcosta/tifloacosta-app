(() => {
  'use strict';
  // Runs only inside the packaged iOS app; the site and Android stay unchanged.
  const plugin = () => window.Capacitor?.Plugins?.TifloReadingAccessibility;
  const en = () => document.documentElement.lang === 'en';
  const tr = (es, english) => en() ? english : es;
  const targetsById = new Map();
  let counter = 0;
  let lastSent = '';
  let listening = false;
  let scheduled = false;

  const visible = element => element.isConnected && !element.closest('[hidden], [aria-hidden="true"]')
    && element.getClientRects().length > 0;
  const action = (id, es, english) => ({ id, label: tr(es, english) });
  function findTargets() {
    const targets = [];
    targetsById.clear();

    const register = (element, kind, actions) => {
      if (!element || !visible(element)) return;
      const label = (element.getAttribute('aria-label') || element.textContent || '').trim();
      if (!label || !actions.length) return;
      if (!element.dataset.iosRotorTarget) element.dataset.iosRotorTarget = 'ios-rotor-' + (++counter);
      const id = element.dataset.iosRotorTarget;
      targetsById.set(id, { element, kind });
      targets.push({ id, label, actions });
    };

    // These are the existing titles and buttons, not new disclosure controls.
    document.querySelectorAll('#video-list .video-card').forEach(card => {
      const title = card.querySelector('h3');
      const play = card.querySelector('.video-play-button');
      const actions = [action('play', 'Reproducir vídeo', 'Play video')];
      if (play?.dataset.videoId) actions.push(action('youtube', 'Abrir en YouTube', 'Open in YouTube'));
      register(title, 'video', actions);
      register(play, 'video', actions);
    });
    document.querySelectorAll('#podcast-episodes .podcast-episode-card').forEach(card => {
      const actions = [action('play', 'Reproducir episodio', 'Play episode')];
      if (card.querySelector('p:not(.resource-meta)')) {
        actions.push(action('description', 'Ir a la descripción', 'Go to description'));
      }
      register(card.querySelector('h3'), 'podcast', actions);
      register(card.querySelector('button'), 'podcast', actions);
    });
    // Existing news, guide, book and download links keep their own visual
    // presentation. Add focus-bound rotor actions instead of full-screen lists.
    const contentLinks = [
      '#news-list a[href]', '#guide-chapters a[href]',
      '#actualidad-home-list a[href]', '#downloads-list a[href]',
      '#book-section a[href]', '#contact-section a[href]',
      '#privacy-section a[href]'
    ];
    document.querySelectorAll(contentLinks.join(',')).forEach(link => {
      const href = String(link.href || '');
      const actions = [action('open', 'Abrir', 'Open')];
      if (/^https?:\/\//i.test(href)) {
        actions.push(action('share', 'Compartir enlace', 'Share link'));
        actions.push(action('copy', 'Copiar enlace', 'Copy link'));
      }
      register(link, 'article', actions);
    });

    // The app already provides working document operations in a dialog.
    // The rotor invokes those exact existing actions without additional UI.
    document.querySelectorAll('.resource-card h3 a[aria-haspopup="dialog"]').forEach(link => {
      const actions = [
        action('open', 'Abrir documento', 'Open document'),
        action('download', 'Descargar documento', 'Download document'),
        action('share', 'Compartir documento', 'Share document'),
        action('favorite', 'Añadir o quitar favorito', 'Add or remove favorite'),
        action('options', 'Opciones del documento', 'Document options')
      ];
      register(link, 'resource', actions);
    });
    return targets.slice(0, 250);
  }

  function runTarget(id, choice) {
    const target = targetsById.get(id);
    const element = target?.element;
    if (!element || !visible(element)) return;
    if (target.kind === 'video') {
      const card = element.closest('.video-card');
      const play = card?.querySelector('.video-play-button');
      if (choice === 'play') play?.click();
      if (choice === 'youtube') {
        const videoId = play?.dataset.videoId || '';
        if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          window.open('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId),
            '_blank', 'noopener,noreferrer');
        }
      }
      return;
    }
    if (target.kind === 'podcast') {
      const card = element.closest('.podcast-episode-card');
      if (choice === 'play') card?.querySelector('button')?.click();
      if (choice === 'description') {
        const paragraph = card?.querySelector('p:not(.resource-meta)');
        if (paragraph) {
          paragraph.tabIndex = -1;
          paragraph.focus({ preventScroll: true });
        }
      }
      return;
    }
    if (target.kind === 'article') {
      const link = element.closest('a[href]');
      if (!link) return;
      if (choice === 'open') { link.click(); return; }
      const href = String(link.href || '');
      if (!/^https?:\/\//i.test(href)) return;
      if (choice === 'share') {
        void window.TifloIOSShare?.shareURL?.({ url:href,
          title:String(link.textContent || '').trim() });
      }
      if (choice === 'copy') {
        void navigator.clipboard?.writeText?.(href);
      }
      return;
    }
    if (target.kind === 'resource') {
      const link = element.closest('a[aria-haspopup="dialog"]');
      if (!link) return;
      link.click();
      if (choice === 'options') return;
      const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
      const buttons = dialog?.querySelector('.resource-actions');
      if (!buttons) return;
      const index = ({ open: 0, download: 1, share: 2, favorite: 3 })[choice];
      const control = Number.isInteger(index) ? buttons.children[index] : null;
      control?.click();
    }
  }

  async function refresh() {
    const native = plugin();
    if (!native?.registerAccessibleTargets) return;
    if (!listening && native.addListener) {
      listening = true;
      try {
        await native.addListener('targetAction', ({ targetId, action: selected }) => {
          runTarget(String(targetId || ''), String(selected || ''));
        });
      } catch { listening = false; }
    }
    const targets = findTargets();
    const serialized = JSON.stringify(targets);
    if (serialized === lastSent) return;
    try {
      await native.registerAccessibleTargets({ targets });
      lastSent = serialized;
    } catch { lastSent = ''; }
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; void refresh(); }, 80);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRefresh, { once: true });
  } else scheduleRefresh();
  window.addEventListener('load', scheduleRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh();
  });
  document.addEventListener('tiflo-ios-folder-change', scheduleRefresh);
  new MutationObserver(scheduleRefresh).observe(document.documentElement,
    { childList: true, subtree: true, characterData: true });
})();
