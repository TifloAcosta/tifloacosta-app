(() => {
  'use strict';
  // iOS only. The Android and public web video sections stay unchanged.
  const es = () => document.documentElement.lang !== 'en';
  const tr = (spanish, english) => es() ? spanish : english;
  const byId = id => document.getElementById(id);

  function arrange() {
    const youtube = byId('youtube-accessible-section');
    const channel = byId('video-controls-section');
    if (!youtube || !channel) return;
    if (youtube.parentElement === channel.parentElement)
      channel.parentElement.insertBefore(youtube, channel);

    // The all-YouTube search is the only visible search field.
    const oldSearch = byId('video-search-form');
    if (oldSearch) oldSearch.hidden = true;
    const ownHeader = byId('video-controls-heading');
    if (ownHeader) ownHeader.textContent = tr('Vídeos de TifloAcosta', 'TifloAcosta videos');
    const ownListHeader = byId('video-results-heading');
    if (ownListHeader) ownListHeader.textContent = tr('Vídeos del canal', 'Channel videos');
    const searchHeader = byId('youtube-accessible-heading');
    if (searchHeader) searchHeader.textContent = tr('Buscar en YouTube', 'Search YouTube');

    const order = byId('video-sort');
    if (!order || byId('ios-video-order-adjustable')) return;
    const control = document.createElement('div');
    control.id = 'ios-video-order-adjustable';
    control.className = 'button-link';
    control.tabIndex = 0;
    control.setAttribute('role', 'spinbutton');
    control.setAttribute('aria-valuemin', '0');
    control.setAttribute('aria-valuemax', '1');
    control.setAttribute('aria-label', tr('Orden de vídeos', 'Video order'));
    const sync = () => {
      const latest = order.value !== 'oldest';
      control.setAttribute('aria-valuenow', latest ? '0' : '1');
      control.setAttribute('aria-valuetext', tr(
        latest ? 'Más recientes primero' : 'Más antiguos primero',
        latest ? 'Newest first' : 'Oldest first'
      ));
      control.textContent = tr('Orden: ', 'Order: ') + (latest
        ? tr('Más recientes primero', 'Newest first')
        : tr('Más antiguos primero', 'Oldest first'));
    };
    const change = direction => {
      // There are only two options; one swipe changes the current value.
      const next = direction > 0 ? 'oldest' : 'newest';
      if (order.value !== next) {
        order.value = next;
        order.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync();
    };
    control.addEventListener('keydown', event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault(); change(1);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault(); change(-1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); change(order.value === 'oldest' ? -1 : 1);
      }
    });
    control.addEventListener('click', () => change(order.value === 'oldest' ? -1 : 1));
    order.addEventListener('change', sync);
    const visualChoices = order.nextElementSibling;
    if (visualChoices?.classList.contains('ios-choice-buttons'))
      visualChoices.style.display = 'none';
    order.style.display = 'none';
    const orderLabel = byId('video-sort-label');
    if (orderLabel) orderLabel.hidden = true;
    order.parentElement?.append(control);
    sync();
  }

  function describeSearchResults() {
    const list = byId('youtube-accessible-results');
    if (!list) return;
    for (const card of list.querySelectorAll('.youtube-search-card')) {
      const title = card.querySelector('h3');
      const play = card.querySelector('.video-play-button');
      if (!title || !play || card.dataset.iosSingleRow === '1') continue;
      const metadata = [...card.querySelectorAll('.video-meta')]
        .map(element => element.textContent.trim()).filter(Boolean);
      const spoken = [title.textContent.trim(), ...metadata].join('. ');
      play.setAttribute('aria-label', spoken);
      play.setAttribute('title', spoken);
      play.textContent = title.textContent.trim();
      // One focusable title per item. The full details remain in the native player.
      for (const child of card.children) {
        if (child !== card.querySelector('.youtube-search-actions'))
          child.setAttribute('aria-hidden', 'true');
      }
      const external = card.querySelector('a.button-link');
      if (external) {
        external.tabIndex = -1;
        external.setAttribute('aria-hidden', 'true');
      }
      card.dataset.iosSingleRow = '1';
    }
  }

  function setup() {
    arrange();
    describeSearchResults();
    const list = byId('youtube-accessible-results');
    if (list) new MutationObserver(describeSearchResults)
      .observe(list, { childList: true, subtree: true });
    byId('lang-es')?.addEventListener('click', () => setTimeout(arrange, 0));
    byId('lang-en')?.addEventListener('click', () => setTimeout(arrange, 0));
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
