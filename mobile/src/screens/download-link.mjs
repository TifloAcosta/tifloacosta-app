import { createAnalyzerClient, formatBytes, normalizeUrl, resolveLocal } from '../core/downloads.mjs';
import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

const PROVIDER_LABELS = Object.freeze({
  'google-drive': 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  'icloud-drive': 'iCloud Drive',
  box: 'Box',
  mega: 'MEGA',
  wetransfer: 'WeTransfer',
  mediafire: 'MediaFire',
  pcloud: 'pCloud',
  direct: 'URL',
  web: 'Web'
});

function mimeFromType(type) {
  const extension = String(type || '').toLowerCase();
  const known = {
    pdf: 'application/pdf', zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json', epub: 'application/epub+zip',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
    mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm',
    apk: 'application/vnd.android.package-archive'
  };
  return known[extension] || 'application/octet-stream';
}

function providerLabel(value) {
  const key = String(value || '').trim();
  return PROVIDER_LABELS[key] || key || 'Web';
}

function errorKey(code) {
  return ({
    invalid_url: 'invalid',
    timeout: 'timeout',
    unreachable: 'unreachable',
    no_files: 'noFiles',
    unsupported: 'unsupported',
    service_unavailable: 'unavailable',
    bad_response: 'unavailable'
  })[code] || 'unavailable';
}

export function renderDownloadLink({ root, router, t, nativeActions, initialUrl = '', analyzeOnOpen = false }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('downloads.link'),
    backLabel: t('nav.back')
  });
  addParagraph(root, t('downloadsLink.intro'));

  const form = document.createElement('form');
  const label = document.createElement('label');
  const input = document.createElement('input');
  const submit = document.createElement('button');
  input.id = 'download-link-url';
  input.type = 'url';
  input.inputMode = 'url';
  input.autocomplete = 'off';
  input.placeholder = t('downloadsLink.placeholder');
  input.value = String(initialUrl || '').trim();
  label.htmlFor = input.id;
  label.textContent = t('downloadsLink.label');
  submit.type = 'submit';
  submit.textContent = t('downloadsLink.analyze');
  form.append(label, input, submit);
  root.append(form);

  const status = document.createElement('p');
  status.id = 'download-link-status';
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  root.append(status);

  const resultsSection = document.createElement('section');
  const resultsHeading = document.createElement('h2');
  const resultCount = document.createElement('p');
  const results = document.createElement('div');
  resultsHeading.textContent = t('downloadsLink.resultsHeading');
  resultsSection.hidden = true;
  resultsSection.append(resultsHeading, resultCount, results);
  root.append(resultsSection);

  const externalSection = document.createElement('section');
  externalSection.hidden = true;
  root.append(externalSection);

  const analyzer = createAnalyzerClient({
    fetchFn: (...args) => window.fetch(...args)
  });

  function setStatus(message) {
    status.textContent = message || '';
  }

  function clearOutput() {
    resultsSection.hidden = true;
    externalSection.hidden = true;
    results.replaceChildren();
    externalSection.replaceChildren();
  }

  function renderResult(item) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = item?.name || t('downloadsLink.defaultFilename');
    article.append(heading);

    const type = document.createElement('p');
    type.textContent = item?.type && item.type !== 'unknown'
      ? String(item.type).toUpperCase()
      : t('downloadsLink.unknownType');
    article.append(type);

    const size = document.createElement('p');
    const formattedSize = formatBytes(item?.size);
    size.textContent = formattedSize || t('downloadsLink.unknownSize');
    article.append(size);

    const source = document.createElement('p');
    source.textContent = `${t('downloadsLink.source')}: ${providerLabel(item?.source)}`;
    article.append(source);

    if (!item?.url) return article;
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = `${t('downloadsLink.save')}: ${item.name || t('downloadsLink.defaultFilename')}`;
    save.addEventListener('click', async () => {
      const saved = await nativeActions.saveFile({
        url: item.url,
        filename: item.name || t('downloadsLink.defaultFilename'),
        mimeType: mimeFromType(item.type)
      });
      setStatus(saved ? t('downloadsLink.saved') : t('downloadsLink.saveFailed'));
    });
    article.append(save);
    return article;
  }

  function renderResults(items) {
    const safeItems = Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : [];
    results.replaceChildren();
    externalSection.hidden = true;
    resultsSection.hidden = false;
    safeItems.forEach(item => results.append(renderResult(item)));
    resultCount.textContent = `${safeItems.length} ${t('downloadsLink.filesFound')}`;
    setStatus('');
  }

  function renderExternal(url, mode) {
    resultsSection.hidden = true;
    externalSection.hidden = false;
    externalSection.replaceChildren();

    const heading = document.createElement('h2');
    heading.textContent = mode === 'auth'
      ? t('downloadsLink.authenticationRequired')
      : mode === 'blocked'
        ? t('downloadsLink.blocked')
        : t('downloadsLink.unavailable');
    const notice = document.createElement('p');
    notice.textContent = t('downloadsLink.externalNotice');
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = t('downloadsLink.openExternal');
    open.addEventListener('click', async () => {
      const opened = await nativeActions.openExternal(url);
      if (!opened) setStatus(t('downloadsLink.unavailable'));
    });
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = t('downloadsLink.retry');
    retry.addEventListener('click', () => { void analyzeCurrent(); });
    externalSection.append(heading, notice, open, retry);
    setStatus('');
  }

  async function analyzeCurrent() {
    clearOutput();
    const normalized = normalizeUrl(input.value);
    if (!normalized) {
      setStatus(t('downloadsLink.invalid'));
      return;
    }
    input.value = normalized.href;
    setStatus(t('downloadsLink.analyzing'));

    const local = resolveLocal(normalized.href);
    if (local.kind === 'result' && local.items.length) {
      renderResults(local.items);
      return;
    }

    try {
      const payload = await analyzer.analyze(normalized.href);
      if (payload.status === 'ok' && Array.isArray(payload.items) && payload.items.length) {
        renderResults(payload.items);
        return;
      }
      if (payload.code === 'authentication_required') {
        renderExternal(normalized.href, 'auth');
        return;
      }
      if (payload.code === 'access_denied') {
        renderExternal(normalized.href, 'blocked');
        return;
      }
      setStatus(t(`downloadsLink.${errorKey(payload.code)}`));
    } catch (error) {
      if (local.provider !== 'web') {
        renderExternal(normalized.href, 'provider');
        return;
      }
      setStatus(t(`downloadsLink.${errorKey(error?.code)}`));
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    void analyzeCurrent();
  });

  if (analyzeOnOpen === true && normalizeUrl(input.value)) {
    void analyzeCurrent();
  }
}
