(() => {
  'use strict';
  // The actions must belong to the HTML title that VoiceOver actually focuses.
  const list = document.getElementById('reading-library-list');
  if (!list) return;
  const native = () => window.Capacitor?.Plugins?.TifloReadingDocumentActions;
  let activeTitle = null;
  let focusGeneration = 0;
  const actionLabels = () => {
    const en = (document.documentElement.lang || '').startsWith('en');
    return en
      ? { openLabel: 'Open', detailsLabel: 'Document actions', deleteLabel: 'Delete' }
      : { openLabel: 'Abrir', detailsLabel: 'Acciones del documento', deleteLabel: 'Eliminar' };
  };
  function titleFromFocus(target) {
    return target?.matches?.('button.reading-library-title') ? target : null;
  }
  function clear(title) {
    if (!title || activeTitle !== title) return;
    activeTitle = null;
    ++focusGeneration;
    void native()?.clearDocumentActions?.({ documentId: title.id })?.catch?.(() => {});
  }
  list.addEventListener('focusin', event => {
    const title = titleFromFocus(event.target);
    if (!title) return;
    activeTitle = title;
    const generation = ++focusGeneration;
    // VoiceOver accessibility focus can follow DOM focus in a later run loop.
    setTimeout(() => {
      if (generation !== focusGeneration || activeTitle !== title || !title.isConnected) return;
      void native()?.setDocumentActions?.({
        documentId: title.id,
        title: title.textContent.trim(),
        ...actionLabels()
      })?.then?.(result => {
        title.dataset.nativeActions = result?.configured === true ? 'enabled' : 'unavailable';
      })?.catch?.(() => { title.dataset.nativeActions = 'unavailable'; });
    }, 120);
  });
  list.addEventListener('focusout', event => {
    const title = titleFromFocus(event.target);
    if (title) clear(title);
  });
  const onAction = ({ documentId, action } = {}) => {
    const title = activeTitle;
    if (!title?.isConnected || title.id !== documentId) return;
    const card = title.closest('.reading-library-title-card');
    if (!card) return;
    if (action === 'open') { title.click(); return; }
    const details = card.querySelector('.reading-library-title-details');
    const toggle = card.querySelector('.reading-library-details-toggle');
    if (!details || !toggle) return;
    if (details.hidden) toggle.click();
    if (action === 'details') return;
    if (action !== 'delete') return;
    const more = details.querySelector('.reading-library-more-actions');
    if (!more) return;
    const morePanel = details.querySelector('.reading-library-more-panel');
    if (morePanel?.hidden) more.click();
    morePanel?.querySelector('.reading-library-delete')?.click();
    // The existing explicit confirmation is mandatory; no destructive quick action.
  };
  void native()?.addListener?.('documentAction', onAction)?.catch?.(() => {});
  new MutationObserver(() => {
    if (activeTitle && !activeTitle.isConnected) clear(activeTitle);
  }).observe(list, { childList: true, subtree: true });
})();
