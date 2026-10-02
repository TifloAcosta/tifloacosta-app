import { resolveLocal } from '../core/downloads.mjs';
import {
  RESOURCE_PLATFORMS,
  newestResources,
  resourceCategories,
  selectResources
} from '../core/resources.mjs';
import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

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

function resourceFileTarget(item, url) {
  const resolved = resolveLocal(url);
  const resolvedItem = resolved.kind === 'result' && resolved.items.length ? resolved.items[0] : null;
  const targetUrl = resolvedItem?.url || url;
  const filename = filenameForResource(item, url);
  const mimeType = resolvedItem?.type && resolvedItem.type !== 'unknown'
    ? mimeTypeFromFilename(`archivo.${resolvedItem.type}`)
    : mimeTypeFromFilename(filename);
  return { targetUrl, filename, mimeType };
}

function addSaveButton(parent, item, url, nativeActions, t) {
  if (!nativeActions?.saveFile) return;
  const { targetUrl, filename, mimeType } = resourceFileTarget(item, url);
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${t('library.download')}: ${item.title || filename}`;
  button.addEventListener('click', () => {
    void nativeActions.saveFile({ url: targetUrl, filename, mimeType });
  });
  parent.append(button);
}

function addFileShareButton(parent, item, url, nativeActions, t) {
  if (!nativeActions?.shareFile) return;
  const { targetUrl, filename, mimeType } = resourceFileTarget(item, url);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'share-button';
  button.textContent = `${t('common.share')}: ${item.title || filename}`;
  const status = document.createElement('p');
  status.className = 'muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = t('reader.preparing');
    const shared = await nativeActions.shareFile({
      url: targetUrl,
      filename,
      mimeType,
      title: item.title || filename
    });
    button.disabled = false;
    status.textContent = shared ? '' : t('share.errorHeading');
  });
  parent.append(button, status);
}

function addEndBackButton(root, router, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'end-back-button';
  button.className = 'back-button';
  button.textContent = label;
  button.addEventListener('click', () => router.back());
  root.append(button);
}

function renderResource(parent, item, favoritesStore, nativeActions, t, headingLevel='h2') {
  const article = document.createElement('article');
  article.className = 'content-card';
  const title = document.createElement(headingLevel);
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
  if (downloadUrl) {
    addSaveButton(article, item, downloadUrl, nativeActions, t);
    addFileShareButton(article, item, downloadUrl, nativeActions, t);
  }
  if (item.id) addFavoriteButton(article, item, favoritesStore, t);
  parent.append(article);
}

function favoriteIds(favoritesStore) {
  const ids = new Set();
  for (const ref of favoritesStore?.list?.() || []) {
    if (ref?.kind === 'resource' && ref.id) ids.add(String(ref.id));
  }
  return ids;
}

export function resourceMatchesPlatform(item, platform) {
  return selectResources([item], { platform:String(platform || '').toLowerCase() }).length === 1;
}

export function renderLibrary({ root, router, content, preferences, favoritesStore, nativeActions, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.library'), backLabel: t('nav.back') });

  const lang = preferences?.lang === 'en' ? 'en' : 'es';
  const allItems = Array.isArray(content?.resources) ? content.resources : [];
  const labels = lang === 'en'
    ? {
        search:'Search resources', searchLabel:'Title or keyword', searchPlaceholder:'For example: VoiceOver, Android, WhatsApp…',
        searchButton:'Search', newest:'New content', explore:'Explore resources', category:'Category',
        categoryPlaceholder:'Select a category', platform:'Platform', allPlatforms:'All platforms',
        android:'Android', iphone:'iPhone', windows:'Windows', favorites:'View favorites',
        clear:'Clear results', noResults:'No matching resources were found.',
        intro:'Search first, choose a category or platform, or open Favorites. The complete catalog is not shown automatically.'
      }
    : {
        search:'Buscar recursos', searchLabel:'Título o palabra clave', searchPlaceholder:'Por ejemplo: VoiceOver, Android, WhatsApp…',
        searchButton:'Buscar', newest:'Novedades', explore:'Explorar recursos', category:'Categoría',
        categoryPlaceholder:'Seleccionar una categoría', platform:'Plataforma', allPlatforms:'Todas las plataformas',
        android:'Android', iphone:'iPhone', windows:'Windows', favorites:'Ver favoritos',
        clear:'Limpiar resultados', noResults:'No se encontraron recursos coincidentes.',
        intro:'Busca primero, elige una categoría o plataforma, o abre Favoritos. El catálogo completo no se muestra automáticamente.'
      };

  addParagraph(root, labels.intro, 'muted');

  const searchHeading = document.createElement('h2');
  searchHeading.textContent = labels.search;
  const form = document.createElement('form');
  form.className = 'search-form';
  const searchLabel = document.createElement('label');
  const searchInput = document.createElement('input');
  searchInput.id = 'library-search-input';
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchInput.placeholder = labels.searchPlaceholder;
  searchLabel.htmlFor = searchInput.id;
  searchLabel.textContent = labels.searchLabel;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = labels.searchButton;
  form.append(searchLabel, searchInput, submit);

  const newest = newestResources(allItems, { lang, limit:3 });
  const newestHeading = document.createElement('h2');
  newestHeading.textContent = labels.newest;
  const newestList = document.createElement('div');
  newestList.className = 'content-list';
  for (const item of newest) renderResource(newestList, item, favoritesStore, nativeActions, t, 'h3');

  const exploreHeading = document.createElement('h2');
  exploreHeading.textContent = labels.explore;

  const categoryField = document.createElement('div');
  categoryField.className = 'settings-field';
  const categoryLabel = document.createElement('label');
  categoryLabel.htmlFor = 'library-category-filter';
  categoryLabel.textContent = labels.category;
  const categorySelect = document.createElement('select');
  categorySelect.id = 'library-category-filter';
  const categoryPlaceholder = document.createElement('option');
  categoryPlaceholder.value = '';
  categoryPlaceholder.textContent = labels.categoryPlaceholder;
  categorySelect.append(categoryPlaceholder);
  for (const category of resourceCategories(allItems, lang)) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  }
  categoryField.append(categoryLabel, categorySelect);

  const platformField = document.createElement('div');
  platformField.className = 'settings-field';
  const platformLabel = document.createElement('label');
  platformLabel.htmlFor = 'library-platform-filter';
  platformLabel.textContent = labels.platform;
  const platformSelect = document.createElement('select');
  platformSelect.id = 'library-platform-filter';
  const platformNames = { all:labels.allPlatforms, android:labels.android, iphone:labels.iphone, windows:labels.windows };
  for (const platform of RESOURCE_PLATFORMS) {
    const option = document.createElement('option');
    option.value = platform;
    option.textContent = platformNames[platform] || platform;
    platformSelect.append(option);
  }
  platformField.append(platformLabel, platformSelect);

  const actions = document.createElement('div');
  actions.className = 'action-group';
  const favorites = document.createElement('button');
  favorites.type = 'button';
  favorites.textContent = labels.favorites;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = labels.clear;
  clear.hidden = true;
  actions.append(favorites, clear);

  const status = document.createElement('p');
  status.className = 'muted';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  status.setAttribute('aria-atomic','true');

  const list = document.createElement('div');
  list.className = 'content-list';
  list.hidden = true;

  function renderResults(items) {
    list.replaceChildren();
    list.hidden = false;
    clear.hidden = false;
    status.textContent = items.length
      ? (lang === 'en' ? `${items.length} resource${items.length===1?'':'s'} found.` : `${items.length} recurso${items.length===1?'':'s'} encontrado${items.length===1?'':'s'}.`)
      : labels.noResults;
    if (!items.length) addParagraph(list, labels.noResults, 'empty-state');
    for (const item of items) renderResource(list, item, favoritesStore, nativeActions, t);
    const target = list.querySelector('h2, .empty-state');
    if (target) {
      target.tabIndex = -1;
      queueMicrotask(() => target.focus());
    }
  }

  function currentSelection(extra={}) {
    return selectResources(allItems, {
      lang,
      platform:platformSelect.value || 'all',
      category:categorySelect.value,
      query:searchInput.value.trim(),
      ...extra
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    renderResults(currentSelection());
  });

  categorySelect.addEventListener('change', () => {
    if (!categorySelect.value) {
      list.hidden = true;
      clear.hidden = true;
      status.textContent = '';
      return;
    }
    renderResults(currentSelection({ query:'' }));
  });

  platformSelect.addEventListener('change', () => {
    if (platformSelect.value === 'all' && !categorySelect.value && !searchInput.value.trim()) {
      list.hidden = true;
      clear.hidden = true;
      status.textContent = '';
      return;
    }
    renderResults(currentSelection());
  });

  favorites.addEventListener('click', () => {
    renderResults(selectResources(allItems, {
      lang,
      platform:platformSelect.value || 'all',
      category:categorySelect.value,
      favoriteIds:favoriteIds(favoritesStore)
    }));
  });

  clear.addEventListener('click', () => {
    searchInput.value = '';
    categorySelect.value = '';
    platformSelect.value = 'all';
    list.replaceChildren();
    list.hidden = true;
    clear.hidden = true;
    status.textContent = '';
    searchInput.focus();
  });

  root.append(searchHeading, form);
  if (newest.length) root.append(newestHeading, newestList);
  root.append(exploreHeading, categoryField, platformField, actions, status, list);
  addEndBackButton(root, router, t('nav.back'));
}
