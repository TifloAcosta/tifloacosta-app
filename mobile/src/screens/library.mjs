import { resolveLocal } from '../core/downloads.mjs';
import {
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
    void nativeActions?.saveFile({ url: targetUrl, filename, mimeType });
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
    const shared = await nativeActions?.shareFile({
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
        intro:'Choose a category to browse the resources available in TifloAcosta.',
        category:'Category',
        categoryPlaceholder:'Select a category',
        noResults:'No resources are available in this category.',
        found:n => `${n} resource${n === 1 ? '' : 's'}.`
      }
    : {
        intro:'Elige una categoría para consultar los recursos disponibles en TifloAcosta.',
        category:'Categoría',
        categoryPlaceholder:'Seleccionar una categoría',
        noResults:'No hay recursos disponibles en esta categoría.',
        found:n => `${n} recurso${n === 1 ? '' : 's'}.`
      };

  addParagraph(root, labels.intro, 'muted');

  const categoryField = document.createElement('div');
  categoryField.className = 'settings-field';
  const categoryLabel = document.createElement('label');
  categoryLabel.htmlFor = 'library-category-filter';
  categoryLabel.textContent = labels.category;
  const categorySelect = document.createElement('select');
  categorySelect.id = 'library-category-filter';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = labels.categoryPlaceholder;
  categorySelect.append(placeholder);

  for (const category of resourceCategories(allItems, lang)) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  }
  categoryField.append(categoryLabel, categorySelect);

  const status = document.createElement('p');
  status.className = 'muted';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const list = document.createElement('div');
  list.className = 'content-list';
  list.hidden = true;

  function renderCategory(category) {
    list.replaceChildren();
    if (!category) {
      list.hidden = true;
      status.textContent = '';
      return;
    }

    const items = selectResources(allItems, { lang, category });
    list.hidden = false;
    status.textContent = items.length ? labels.found(items.length) : labels.noResults;

    if (!items.length) {
      addParagraph(list, labels.noResults, 'empty-state');
      return;
    }
    for (const item of items) renderResource(list, item, favoritesStore, nativeActions, t);
  }

  categorySelect.addEventListener('change', () => {
    renderCategory(categorySelect.value);
  });

  root.append(categoryField, status, list);
  addEndBackButton(root, router, t('nav.back'));
}
