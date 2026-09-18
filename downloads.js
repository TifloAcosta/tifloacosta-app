(() => {
  'use strict';

  const core = window.TIFLO_DOWNLOAD_CORE;
  if (!core) return;
  const config = window.TIFLO_DOWNLOAD_CONFIG || { endpoint: '' };
  const PENDING_KEY = 'tifloDownloadPendingV1';
  const PROVIDER_LABELS = {
    'google-drive': 'Google Drive', dropbox: 'Dropbox', onedrive: 'OneDrive',
    'icloud-drive': 'iCloud Drive', box: 'Box', mega: 'MEGA', wetransfer: 'WeTransfer',
    mediafire: 'MediaFire', pcloud: 'pCloud', direct: 'Enlace directo', web: 'Página web'
  };

  const copyByLanguage = {
    es: {
      launcher: 'Descargar desde un enlace', heading: 'Descargar desde un enlace',
      intro: 'Pega un enlace público o compartido y TifloAcosta intentará localizar los archivos descargables disponibles.',
      back: 'Volver al inicio', label: 'Pega aquí el enlace', placeholder: 'https://…', analyze: 'Analizar enlace',
      analyzing: 'Analizando enlace…', invalid: 'El enlace no es válido. Utiliza una dirección que empiece por http:// o https://.',
      resultsHeading: 'Archivos encontrados', resultSearch: 'Buscar entre los archivos encontrados', type: 'Tipo de archivo', all: 'Todos',
      found: (visible, total) => visible === total ? `${total} archivo${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}.` : `${visible} de ${total} archivos visibles.`,
      noFiltered: 'No hay archivos que coincidan con ese filtro.', download: 'Descargar', unknownType: 'Tipo no identificado', unknownSize: 'Tamaño desconocido', source: 'Procedencia',
      noFiles: 'No se encontraron archivos descargables en ese enlace.', unavailable: 'El análisis avanzado no está disponible temporalmente. Los enlaces directos, Google Drive y Dropbox siguen funcionando.',
      badResponse: 'El analizador devolvió una respuesta que TifloAcosta no pudo interpretar.', timeout: 'El análisis tardó demasiado y se detuvo.', unreachable: 'No se pudo acceder a la página indicada.', unsupported: 'Este enlace no puede analizarse automáticamente.',
      auth: 'Este recurso necesita identificación en el servicio externo.',
      externalHeading: 'Continuar en un servicio externo',
      externalText: 'Vas a salir de TifloAcosta para continuar en un servicio externo. La accesibilidad y el funcionamiento de la página que se abra dependen de ese servicio. TifloAcosta no recibe ni guarda tus credenciales.',
      externalButton: 'Continuar en el servicio externo', retry: 'Reintentar análisis', pending: 'Tienes un enlace pendiente. Puedes reintentar el análisis.',
      genericNeedsAnalyzer: 'Para examinar una página web y localizar todos sus archivos hace falta el analizador avanzado.'
    },
    en: {
      launcher: 'Download from a link', heading: 'Download from a link',
      intro: 'Paste a public or shared link and TifloAcosta will try to locate the downloadable files that are available.',
      back: 'Back to home', label: 'Paste the link here', placeholder: 'https://…', analyze: 'Analyze link',
      analyzing: 'Analyzing link…', invalid: 'The link is not valid. Use an address beginning with http:// or https://.',
      resultsHeading: 'Files found', resultSearch: 'Search within the files found', type: 'File type', all: 'All',
      found: (visible, total) => visible === total ? `${total} file${total === 1 ? '' : 's'} found.` : `${visible} of ${total} files visible.`,
      noFiltered: 'No files match that filter.', download: 'Download', unknownType: 'Type not identified', unknownSize: 'Size unknown', source: 'Source',
      noFiles: 'No downloadable files were found at that link.', unavailable: 'Advanced analysis is temporarily unavailable. Direct links, Google Drive, and Dropbox still work.',
      badResponse: 'The analyzer returned a response TifloAcosta could not interpret.', timeout: 'The analysis took too long and was stopped.', unreachable: 'The specified page could not be reached.', unsupported: 'This link cannot be analyzed automatically.',
      auth: 'This resource requires sign-in on the external service.',
      externalHeading: 'Continue on an external service',
      externalText: 'You are leaving TifloAcosta to continue on an external service. Accessibility and operation on the destination page are the responsibility of that service. TifloAcosta does not receive or store your credentials.',
      externalButton: 'Continue on the external service', retry: 'Retry analysis', pending: 'You have a pending link. You can retry the analysis.',
      genericNeedsAnalyzer: 'Advanced analysis is required to inspect a web page and locate all of its files.'
    }
  };

  let allResults = [];
  let launcher;
  let section;
  let form;
  let urlInput;
  let status;
  let resultsSection;
  let resultsHeading;
  let resultSearch;
  let typeFilter;
  let resultCount;
  let results;
  let externalPanel;

  function currentLanguage() { return document.documentElement.lang === 'en' ? 'en' : 'es'; }
  function t() { return copyByLanguage[currentLanguage()]; }
  function providerLabel(provider) { return PROVIDER_LABELS[provider] || provider || t().unknownType; }

  function element(tag, options = {}) {
    const node = document.createElement(tag);
    if (options.id) node.id = options.id;
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    return node;
  }

  function makeBackButton() {
    const wrapper = element('p');
    const button = element('button', { className: 'button-link back-link', text: t().back });
    button.type = 'button';
    button.dataset.downloadBack = 'true';
    button.addEventListener('click', () => { window.location.hash = '#home'; });
    wrapper.append(button);
    return wrapper;
  }

  function buildSurface() {
    const nav = document.querySelector('#home-blocks .resource-actions');
    const main = document.getElementById('main');
    if (!nav || !main || document.getElementById('downloads-section')) return false;

    launcher = element('button', { id: 'home-open-downloads', className: 'button-link', text: t().launcher });
    launcher.type = 'button';
    launcher.addEventListener('click', () => { window.location.hash = '#downloads'; });
    nav.append(launcher);

    section = element('section', { id: 'downloads-section' });
    section.hidden = true;
    section.tabIndex = -1;
    section.setAttribute('aria-labelledby', 'downloads-heading');
    section.append(makeBackButton());

    const heading = element('h2', { id: 'downloads-heading', text: t().heading });
    section.append(heading);
    const intro = element('p', { id: 'downloads-intro', className: 'download-tool-intro', text: t().intro });
    section.append(intro);

    form = element('form', { id: 'download-form' });
    const label = element('label', { text: t().label });
    label.htmlFor = 'download-url';
    form.append(label);
    const row = element('div', { className: 'search-row' });
    urlInput = element('input', { id: 'download-url' });
    urlInput.type = 'url';
    urlInput.inputMode = 'url';
    urlInput.autocomplete = 'off';
    urlInput.placeholder = t().placeholder;
    const analyze = element('button', { id: 'download-analyze', text: t().analyze });
    analyze.type = 'submit';
    row.append(urlInput, analyze);
    form.append(row);
    section.append(form);

    status = element('p', { id: 'download-status', className: 'muted' });
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    section.append(status);

    resultsSection = element('section', { id: 'download-results-section' });
    resultsSection.hidden = true;
    resultsSection.setAttribute('aria-labelledby', 'download-results-heading');
    resultsHeading = element('h3', { id: 'download-results-heading', text: t().resultsHeading });
    resultsHeading.tabIndex = -1;
    resultsSection.append(resultsHeading);

    const controls = element('div', { className: 'download-controls' });
    const searchWrap = element('div');
    const searchLabel = element('label', { text: t().resultSearch });
    searchLabel.htmlFor = 'download-result-search';
    resultSearch = element('input', { id: 'download-result-search' });
    resultSearch.type = 'search';
    resultSearch.autocomplete = 'off';
    searchWrap.append(searchLabel, resultSearch);

    const filterWrap = element('div');
    const filterLabel = element('label', { text: t().type });
    filterLabel.htmlFor = 'download-type-filter';
    typeFilter = element('select', { id: 'download-type-filter' });
    filterWrap.append(filterLabel, typeFilter);
    controls.append(searchWrap, filterWrap);
    resultsSection.append(controls);

    resultCount = element('p', { id: 'download-result-count', className: 'muted' });
    resultCount.setAttribute('aria-live', 'polite');
    results = element('div', { id: 'download-results', className: 'download-results' });
    resultsSection.append(resultCount, results);
    section.append(resultsSection);

    externalPanel = element('div', { id: 'download-external-panel', className: 'panel download-external-panel' });
    externalPanel.hidden = true;
    section.append(externalPanel);
    section.append(makeBackButton());
    main.append(section);

    form.addEventListener('submit', event => { event.preventDefault(); analyzeUrl(urlInput.value); });
    resultSearch.addEventListener('input', applyFilters);
    typeFilter.addEventListener('change', applyFilters);
    return true;
  }

  function setStatus(message, focus = false) {
    status.textContent = message;
    if (focus && message) {
      status.tabIndex = -1;
      status.focus();
    }
  }

  function typeOptions(items) {
    const types = [...new Set(items.map(item => String(item.type || 'unknown').toLowerCase()))].sort();
    typeFilter.replaceChildren();
    const all = element('option', { text: t().all });
    all.value = 'all';
    typeFilter.append(all);
    types.forEach(type => {
      const option = element('option', { text: type === 'unknown' ? t().unknownType : type.toUpperCase() });
      option.value = type;
      typeFilter.append(option);
    });
  }

  function resultCard(item) {
    const card = element('article', { className: 'download-result-card' });
    const name = element('h4', { text: item.name || 'Archivo' });
    const type = element('p', { className: 'download-result-meta', text: item.type && item.type !== 'unknown' ? item.type.toUpperCase() : t().unknownType });
    const size = element('p', { className: 'download-result-meta', text: item.size ? core.formatBytes(item.size) : t().unknownSize });
    const source = element('p', { className: 'download-result-meta', text: `${t().source}: ${providerLabel(item.source)}` });
    const link = element('a', { className: 'button-link', text: `${t().download}: ${item.name || 'Archivo'}` });
    link.href = item.url;
    link.rel = 'noopener noreferrer';
    card.append(name, type, size, source, link);
    return card;
  }

  function renderResults(items, moveFocus = true) {
    allResults = Array.isArray(items) ? items : [];
    externalPanel.hidden = true;
    resultsSection.hidden = false;
    resultSearch.value = '';
    typeOptions(allResults);
    applyFilters();
    setStatus('');
    if (moveFocus) resultsHeading.focus();
  }

  function applyFilters() {
    const visible = core.filterResults(allResults, resultSearch.value, typeFilter.value || 'all');
    results.replaceChildren();
    visible.forEach(item => results.append(resultCard(item)));
    resultCount.textContent = visible.length ? t().found(visible.length, allResults.length) : t().noFiltered;
  }

  function savePending(url, provider) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ url, provider, timestamp: Date.now() })); }
    catch (error) { /* local storage is optional */ }
  }

  function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); }
    catch (error) { /* optional */ }
  }

  function renderExternalNotice(provider, url, authenticationRequired = false) {
    resultsSection.hidden = true;
    externalPanel.replaceChildren();
    externalPanel.hidden = false;
    const heading = element('h3', { text: t().externalHeading });
    heading.tabIndex = -1;
    const reason = element('p', { text: authenticationRequired ? t().auth : `${providerLabel(provider)}.` });
    const warning = element('p', { text: t().externalText });
    const actions = element('div', { className: 'inline-actions' });
    const link = element('a', { className: 'button-link', text: t().externalButton });
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => savePending(url, provider));
    const retry = element('button', { text: t().retry });
    retry.type = 'button';
    retry.addEventListener('click', () => analyzeUrl(url));
    actions.append(link, retry);
    externalPanel.append(heading, reason, warning, actions);
    setStatus('');
    heading.focus();
  }

  function mapError(code) {
    const c = t();
    return ({ invalid_url:c.invalid, authentication_required:c.auth, timeout:c.timeout, unreachable:c.unreachable,
      no_files:c.noFiles, unsupported:c.unsupported, bad_response:c.badResponse, service_unavailable:c.unavailable })[code] || c.badResponse;
  }

  async function callAnalyzer(url) {
    if (!config.endpoint) throw Object.assign(new Error('service unavailable'), { code: 'service_unavailable' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      const payload = await response.json();
      if (!payload || typeof payload !== 'object') throw Object.assign(new Error('bad response'), { code: 'bad_response' });
      if (!response.ok && !payload.code) throw Object.assign(new Error(`HTTP ${response.status}`), { code: 'service_unavailable' });
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw Object.assign(error, { code: 'timeout' });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function analyzeUrl(value) {
    const normalized = core.normalizeUrl(value);
    if (!normalized) {
      resultsSection.hidden = true;
      externalPanel.hidden = true;
      setStatus(t().invalid, true);
      return;
    }
    urlInput.value = normalized.href;
    setStatus(t().analyzing);
    resultsSection.hidden = true;
    externalPanel.hidden = true;
    const local = core.resolveLocal(normalized.href);
    if (local.kind === 'result' && local.items.length) {
      clearPending();
      renderResults(local.items);
      return;
    }

    try {
      const payload = await callAnalyzer(normalized.href);
      if (payload.status === 'ok' && Array.isArray(payload.items) && payload.items.length) {
        clearPending();
        renderResults(payload.items);
        return;
      }
      if (payload.code === 'authentication_required') {
        renderExternalNotice(local.provider, normalized.href, true);
        return;
      }
      if (payload.code === 'no_files') {
        setStatus(t().noFiles, true);
        return;
      }
      setStatus(mapError(payload.code || 'bad_response'), true);
    } catch (error) {
      if (local.provider !== 'web') {
        renderExternalNotice(local.provider, normalized.href, false);
      } else {
        setStatus(error?.code === 'timeout' ? t().timeout : `${t().unavailable} ${t().genericNeedsAnalyzer}`, true);
      }
    }
  }

  function restorePending() {
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
      if (!pending?.url) return;
      urlInput.value = pending.url;
      setStatus(t().pending);
    } catch (error) { /* ignore invalid local state */ }
  }

  function localize() {
    if (!section) return;
    launcher.textContent = t().launcher;
    section.querySelector('#downloads-heading').textContent = t().heading;
    section.querySelector('#downloads-intro').textContent = t().intro;
    section.querySelector('label[for="download-url"]').textContent = t().label;
    urlInput.placeholder = t().placeholder;
    section.querySelector('#download-analyze').textContent = t().analyze;
    resultsHeading.textContent = t().resultsHeading;
    section.querySelector('label[for="download-result-search"]').textContent = t().resultSearch;
    section.querySelector('label[for="download-type-filter"]').textContent = t().type;
    section.querySelectorAll('[data-download-back]').forEach(button => { button.textContent = t().back; });
    if (!resultsSection.hidden) { typeOptions(allResults); applyFilters(); }
  }

  function applyVisibility() {
    if (!section) return;
    const active = window.location.hash.replace(/^#/, '') === 'downloads';
    section.hidden = !active;
    if (!active) return;
    ['home-hero','home-blocks','global-search-section','resources-view','news-view','book-section','contact-section','privacy-section','config-section']
      .forEach(id => { const node = document.getElementById(id); if (node) node.hidden = true; });
    document.querySelectorAll('.site-header,.site-footer,.skip-link').forEach(node => { node.hidden = true; });
    section.hidden = false;
    section.focus();
  }

  if (!buildSurface()) return;
  localize();
  restorePending();
  applyVisibility();
  window.addEventListener('hashchange', applyVisibility);
  window.addEventListener('pageshow', restorePending);
  document.getElementById('lang-es')?.addEventListener('click', () => setTimeout(localize, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => setTimeout(localize, 0));
})();
