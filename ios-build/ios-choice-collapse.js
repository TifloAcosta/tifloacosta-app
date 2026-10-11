(() => {
  'use strict';
  // iOS: expose category buttons only while the filter chooser is open.
  // Otherwise VoiceOver must swipe through all categories before the results.
  const fields = [
    { id: 'news-category', results: 'news-list', status: 'news-status' },
    { id: 'apps-platform', results: 'apps-list', status: 'apps-status' }
  ];
  for (const field of fields) {
    const select = document.getElementById(field.id);
    const group = select?.nextElementSibling;
    if (!(select instanceof HTMLSelectElement) ||
        !group?.classList?.contains('ios-choice-buttons')) continue;

    const label = document.querySelector('label[for="' + field.id + '"]');
    group.id = field.id + '-ios-options';
    const chooser = document.createElement('button');
    chooser.type = 'button';
    chooser.className = 'button-link ios-filter-chooser';
    chooser.setAttribute('aria-controls', group.id);
    chooser.setAttribute('aria-expanded', 'false');
    group.insertAdjacentElement('beforebegin', chooser);

    let expanded = false;
    function update() {
      const usable = select.options.length >= 2 && select.options.length <= 40;
      chooser.hidden = !usable;
      if (!usable) return;
      const selected = select.selectedOptions[0]?.textContent?.trim() || '';
      chooser.textContent = (label?.textContent?.trim() || 'Filtro') + ': ' + selected;
      chooser.setAttribute('aria-expanded', String(expanded));
      group.hidden = !expanded;
      // Explicit display is needed when a theme's .resource-actions sets display.
      group.style.display = expanded ? '' : 'none';
    }
    chooser.addEventListener('click', () => {
      expanded = !expanded;
      update();
      if (expanded) {
        const selected = [...group.querySelectorAll('button')]
          .find(button => button.getAttribute('aria-pressed') === 'true');
        (selected || group.querySelector('button'))?.focus();
      } else chooser.focus();
    });
    group.addEventListener('click', event => {
      if (!event.target.closest('button[data-value]')) return;
      expanded = false;
      update();
      requestAnimationFrame(() => {
        const first = document.getElementById(field.results)?.querySelector('article h3, .news-item h3, .news-item h4');
        const target = first || document.getElementById(field.status) || chooser;
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
      });
    });
    select.addEventListener('change', update);
    new MutationObserver(update).observe(group, { childList: true });
    update();
  }
})();
