(() => {
  'use strict';

  const list = document.querySelector('#video-list');
  if (!list) return;

  const requestedId = new URLSearchParams(window.location.search).get('video');
  if (!requestedId || !/^[A-Za-z0-9_-]{11}$/.test(requestedId)) return;

  let opened = false;

  function openRequestedVideo() {
    if (opened) return true;
    const button = Array.from(list.querySelectorAll('button[data-video-id]'))
      .find(candidate => candidate.dataset.videoId === requestedId);
    if (!button) return false;
    opened = true;
    button.click();
    return true;
  }

  if (openRequestedVideo()) return;

  const observer = new MutationObserver(() => {
    if (openRequestedVideo()) observer.disconnect();
  });
  observer.observe(list, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 15000);
})();
