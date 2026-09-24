import { resolveLocal } from '../core/downloads.mjs';
import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';

function addFavoriteButton(parent, item, favoritesStore, t) {
  const ref = { kind: 'resource', id: String(item.id || '') };
  const button = document.createElement('button');
  button.type = 'button';

  function update() {
    const active = favoritesStore.has(ref);
    button.ariaPressed = String(active);
    button.textContent = active ? t('favorites.remove') : t('favorites.add');
  }

  button.addEventListener('click', () => {
    favoritesStore.toggle(ref);
    update();
  });
  update();
  parent.append(button);
}

function filenameFromUrl(url, fallbackId) {
  try {
    const pathname = new URL(url).pathname;
    const name = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || '');
    if (name) return name;
  } catch {}
  return `${String(fallbackId || 'recurso')}.bin`;
}

function filenameForResource(item, url) {
  const filename = filenameFromUrl(url, '');
  const genericNames = new Set(['view', 'uc', 'download']);
  if (filename && !genericNames.has(filename.toLowerCase()) && !filename.endsWith('.bin')) return filename;
  return String(item?.title || item?.id || 'recurso').trim() || 'recurso';
}

function mimeTypeFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function addSaveButton(parent, item, url, nativeActions, t) {
  if (!nativeActions?.saveFile) return;
  const resolved = resolveLocal(url);
  const resolvedItem = resolved.kind === 'result' && resolved.items.length ? resolved.items[0] : null;
  const targetUrl = resolvedItem?.url || url;
  const filename = filenameForResource(item, url);
  const mimeType = resolvedItem?.type && resolvedItem.type !== 'unknown'
    ? mimeTypeFromFilename(`archivo.${resolvedItem.type}`)
    : mimeTypeFromFilename(filename);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${t('library.download')}: ${item.title || filename}`;
  button.addEventListener('click', () => {
    void nativeActions?.saveFile({
      url: targetUrl,
      filename,
      mimeType
    });
  });
  parent.append(button);
}

function platformSearchText(item) {
  return `${String(item?.category || '')} ${String(item?.title || '')}`.toLowerCase();
}

export function resourceMatchesPlatform(item, platform) {
  if (!platform) return true;
  const text = platformSearchText(item);

  if (platform === 'Android') {
    return /\bandroid\b|\btalkback\b|\bjieshuo\b/.test(text);
  }
  if (platform === 'iPhone') {
    return /\biphone\b|\bipad\b|\bios\b|\bvoiceover\b|\bapple watch\b|\batajos?\b/.test(text);
  }
  if (platform === 'Windows') {
    return /\bwindows\b|\bjaws\b|\bnvda\b/.test(text);
  }
  return false;
}

function addEndBackButton(root, router, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'end-back-button';
  button.className = 'back-button';
  button.textContent = label;
  button.addEventListener('click', () => router.back());
  root.append(button);
  return button;
}

function renderResource(parent, item, favoritesStore, nativeActions, t) {
  const article = document.createElement('article');
  article.className = 'content-card';
  const title = document.createElement('h2');
  title.textContent = item.title || '';
  article.append(title);
  if (item.category) addParagraph(article, item.category, 'muted');

  const openUrl = item.openUrl || item.url || '';
  const downloadUrl = item.url || item.openUrl || '';
  if (openUrl) {
    addExternalLink(article, {
      href: openUrl,
      label: `${t('library.open')}: ${item.title || ''}`,
      onOpen: nativeActions?.openExternal
    });
  }
  if (downloadUrl) addSaveButton(article, item, downloadUrl, nativeActions, t);

  const shareUrl = openUrl || downloadUrl;
  if (shareUrl) {
    addShareButton(article, {
      label: t('common.share'),
      title: item.title || '',
      text: item.category || '',
      url: shareUrl,
      onShare: nativeActions?.share
    });
  }
  if (item.id) addFavoriteButton(article, item, favoritesStore, t);
  parent.append(article);
}

export function renderLibrary({ root, router, content, preferences, favoritesStore, nativeActions, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.library'), backLabel: t('nav.back') });

  const lang = preferences?.lang === 'en' ? 'en' : 'es';
  const items = (Array.isArray(content?.resources) ? content.resources : []).filter(item => !item.lang || item.lang === lang);
  if (!items.length) {
    addParagraph(root, t('library.empty'), 'empty-state');
    addEndBackButton(root, router, t('nav.back'));
    return;
  }

  let activePlatform = '';
  const filters = document.createElement('div');
  filters.className = 'library-platform-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', t('screen.library'));

  const filterButtons = new Map();
  const choices = [
    ['', lang === 'en' ? 'All' : 'Todos'],
    ['Android', 'Android'],
    ['iPhone', 'iPhone'],
    ['Windows', 'Windows']
  ];

  const list = document.createElement('div');
  list.className = 'content-list';

  function updateFilterState() {
    for (const [platform, button] of filterButtons) {
      button.ariaPressed = String(activePlatform === platform);
    }
  }

  function renderList() {
    list.replaceChildren();
    const visibleItems = activePlatform
      ? items.filter(item => resourceMatchesPlatform(item, activePlatform))
      : items;

    if (!visibleItems.length) {
      addParagraph(list, t('library.empty'), 'empty-state');
      return;
    }

    for (const item of visibleItems) {
      renderResource(list, item, favoritesStore, nativeActions, t);
    }
  }

  function focusFilteredResults() {
    const target = list.querySelector('h2, .empty-state');
    if (!target) return;
    target.tabIndex = -1;
    target.focus();
  }

  for (const [platform, label] of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = platform ? `library-filter-${platform.toLowerCase()}` : 'library-filter-all';
    button.textContent = label;
    button.ariaPressed = String(activePlatform === platform);
    button.addEventListener('click', () => {
      activePlatform = platform;
      updateFilterState();
      renderList();
      focusFilteredResults();
    });
    filterButtons.set(platform, button);
    filters.append(button);
  }

  root.append(filters, list);
  renderList();
  addEndBackButton(root, router, t('nav.back'));
}
