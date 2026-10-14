(() => {
  'use strict';
  // In WKWebView, selecting an HTML <select> can raise a native VoiceOver
  // context menu and interrupt the reading flow. Use ordinary accessible
  // buttons instead, including for dynamically inserted reader controls.
  const section = document.getElementById('reading-section');
  if (!section) return;
  function install(select) {
    if (!(select instanceof HTMLSelectElement) || select.dataset.iosAccessibleChoice) return;
    select.dataset.iosAccessibleChoice = '1';
    const label = select.id ? section.querySelector('label[for="' + select.id + '"]') : null;
    const fallbackLabel = label?.textContent?.trim() || select.getAttribute('aria-label') || 'Opción de lectura';
    const name = fallbackLabel.replace(/\s+/g, ' ').trim();
    // VoiceOver exposes range inputs as adjustable controls: flick up/down
    // instead of entering the web select popup. Reserve this for ordered values.
    const adjustableIds = new Set([
      'ios-reading-library-sort', 'ios-reading-book-export-format', 'ios-reading-book-folder',
      'reading-navigation-unit',
      'reading-document-progress-percent',
      'ios-reading-default-unit',
      'reading-default-navigation',
      'reading-audio-speed', 'reading-audio-file-speed',
      'reading-daisy-chapter-select', 'reading-library-filter',
      'reading-voice-language', 'reading-voice', 'reading-external-voice-language',
      'reading-default-navigation', 'reading-text-size', 'reading-font-family',
      'reading-font-weight', 'reading-line-spacing', 'reading-paragraph-spacing',
      'reading-width', 'reading-theme', 'reading-document-voice-language',
      'reading-document-voice', 'reading-document-text-size',
      'reading-document-font-family', 'reading-document-font-weight',
      'reading-document-line-spacing', 'reading-document-paragraph-spacing',
      'reading-document-width', 'reading-document-theme', 'reading-document-timer',
      'reading-translation-source', 'reading-translation-target', 'reading-marks-new-type'
    ]);
    if (adjustableIds.has(select.id)) {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'ios-reader-adjustable';
      slider.min = '0';
      slider.max = String(select.options.length - 1);
      slider.step = '1';
      slider.setAttribute('aria-label', name);
      function syncFromSelect() {
        slider.max = String(Math.max(0, select.options.length - 1));
        slider.value = String(Math.max(0, select.selectedIndex));
        const choice = select.selectedOptions[0];
        slider.setAttribute('aria-valuetext', choice?.textContent?.trim() || '');
        slider.title = name + ': ' + (choice?.textContent?.trim() || '');
      }
      function selectBySlider() {
        const index = Math.max(0, Math.min(select.options.length - 1, Number(slider.value) || 0));
        if (select.selectedIndex !== index) {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncFromSelect();
      }
      slider.addEventListener('input', selectBySlider);
      slider.addEventListener('change', selectBySlider);
      select.addEventListener('change', syncFromSelect);
      new MutationObserver(syncFromSelect).observe(select, { childList: true, subtree: true });
      select.hidden = true;
      select.style.display = 'none';
      select.tabIndex = -1;
      select.setAttribute('aria-hidden', 'true');
      if (label) label.hidden = true;
      select.insertAdjacentElement('afterend', slider);
      syncFromSelect();
      return;
    }
    const chooser = document.createElement('button');
    chooser.type = 'button';
    chooser.className = 'button-link ios-reader-choice';
    const options = document.createElement('div');
    options.className = 'resource-actions ios-reader-choice-options';
    options.id = (select.id || 'reading-select') + '-accessible-options';
    chooser.setAttribute('aria-controls', options.id);
    chooser.setAttribute('aria-expanded', 'false');
    let expanded = false;
    function selectedName() {
      return select.selectedOptions?.[0]?.textContent?.trim() || 'Sin seleccionar';
    }
    function update() {
      chooser.textContent = name + ': ' + selectedName();
    }
    function close() {
      expanded = false;
      chooser.setAttribute('aria-expanded', 'false');
      options.hidden = true;
      options.style.display = 'none';
      options.replaceChildren();
      chooser.focus({ preventScroll: true });
    }
    function show() {
      const choices = [...select.options];
      options.replaceChildren();
      if (choices.length > 25) {
        const searchLabel = document.createElement('label');
        searchLabel.textContent = 'Buscar opción';
        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Escribe para filtrar';
        searchLabel.append(search);
        options.append(searchLabel);
        search.addEventListener('input', () => {
          const value = search.value.trim().toLocaleLowerCase();
          for (const button of options.querySelectorAll('button[data-value]')) {
            button.hidden = !button.textContent.toLocaleLowerCase().includes(value);
          }
        });
      }
      for (const option of choices) {
        const item = document.createElement('button');
        item.type = 'button';
        item.dataset.value = option.value;
        item.textContent = option.textContent;
        item.disabled = option.disabled;
        item.setAttribute('aria-pressed', String(option.value === select.value));
        item.addEventListener('click', () => {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          update();
          close();
        });
        options.append(item);
      }
      expanded = true;
      chooser.setAttribute('aria-expanded', 'true');
      options.hidden = false;
      options.style.display = '';
      const first = options.querySelector('input, button:not([disabled])');
      first?.focus({ preventScroll: true });
    }
    chooser.addEventListener('click', () => expanded ? close() : show());
    select.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(select, {childList:true,subtree:true,characterData:true});
    select.hidden = true;
    select.style.display = 'none';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    if (label) label.hidden = true;
    select.insertAdjacentElement('afterend', chooser);
    chooser.insertAdjacentElement('afterend', options);
    options.hidden = true;
    options.style.display = 'none';
    update();
  }
  const scan = () => section.querySelectorAll('select').forEach(install);
  scan();
  document.addEventListener('DOMContentLoaded', scan);
  window.addEventListener('load', scan);
  const observer = new MutationObserver(() => scan());
  observer.observe(section, { childList:true, subtree:true });
})();
