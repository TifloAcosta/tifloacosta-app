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

  // WKWebView is a fallback when UIKit cannot be presented. The fallback
  // must still expose precisely one VoiceOver stop per channel video.
  function describeChannelVideos() {
    const list = byId('video-list');
    if (!list) return;
    for (const card of list.querySelectorAll('.video-card')) {
      if (card.dataset.iosSingleRow === '1') continue;
      const title = card.querySelector('h3');
      const play = card.querySelector('.video-play-button');
      if (!title || !play) continue;
      const videoTitle = title.textContent.trim();
      const date = card.querySelector('.video-meta')?.textContent?.trim() || '';
      if (!videoTitle) continue;

      // Preserve the original click handler. Do not build a second player.
      play.textContent = videoTitle;
      play.setAttribute('aria-label', [videoTitle, date].filter(Boolean).join('. '));
      play.setAttribute('aria-description', tr(
        'Doble toque para abrir el reproductor.',
        'Double tap to open the video player.'
      ));
      play.classList.add('ios-video-row-action');

      // The visual metadata can remain on the card, but must not create
      // extra swipe stops in VoiceOver.
      title.hidden = true;
      title.setAttribute('aria-hidden', 'true');
      for (const node of card.querySelectorAll('.video-thumbnail, .video-description')) {
        node.hidden = true;
        node.setAttribute('aria-hidden', 'true');
      }
      const metadata = card.querySelector('.video-meta');
      if (metadata) metadata.setAttribute('aria-hidden', 'true');
      card.dataset.iosSingleRow = '1';
    }
  }

  const iosListStyle = document.createElement('style');
  iosListStyle.textContent = `
    #video-list .video-card[data-ios-single-row="1"] {
      padding: 0.35rem 0.6rem;
      border-width: 0 0 1px;
      border-radius: 0;
    }
    #video-list .video-card .ios-video-row-action {
      display: block;
      width: 100%;
      padding: 0.8rem;
      text-align: left;
      line-height: 1.45;
      font-weight: 600;
      white-space: normal;
    }
    #video-list .video-card .ios-video-row-action:focus-visible {
      outline: 3px solid currentColor;
      outline-offset: 2px;
    }
  `;
  document.head.append(iosListStyle);

  function setup() {
    arrange();
    describeSearchResults();
    describeChannelVideos();
    const searchList = byId('youtube-accessible-results');
    if (searchList) new MutationObserver(describeSearchResults)
      .observe(searchList, { childList: true, subtree: true });
    const channelList = byId('video-list');
    if (channelList) new MutationObserver(describeChannelVideos)
      .observe(channelList, { childList: true });
    byId('lang-es')?.addEventListener('click', () => {
      setTimeout(() => { arrange(); describeChannelVideos(); }, 0);
    });
    byId('lang-en')?.addEventListener('click', () => {
      setTimeout(() => { arrange(); describeChannelVideos(); }, 0);
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
