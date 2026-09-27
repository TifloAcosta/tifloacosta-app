import { addScreenHeader, clearScreen } from './shared.mjs';

const PAGE_SIZE = 10;

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    String(template || '')
  );
}

function batchHasResults(batch) {
  return Boolean(
    batch && (
      (Array.isArray(batch.imported) && batch.imported.length) ||
      (Array.isArray(batch.duplicates) && batch.duplicates.length) ||
      (Array.isArray(batch.rejected) && batch.rejected.length)
    )
  );
}

function importSummary(batch, t) {
  if (!batchHasResults(batch)) return '';
  return format(t('readingLibrary.importSummary'), {
    imported: batch.imported?.length || 0,
    duplicates: batch.duplicates?.length || 0,
    rejected: batch.rejected?.length || 0
  });
}

function stateLabel(book, t) {
  if (book?.state === 'read') return t('readingLibrary.stateRead');
  if (book?.state === 'in-reading') return t('readingLibrary.stateInReading');
  return t('readingLibrary.stateNotRead');
}

function progressLabel(book, t) {
  return format(t('readingLibrary.progress'), {
    percent: Math.round(Math.max(0, Math.min(100, Number(book?.percent) || 0)))
  });
}

function makeButton(label, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

export function renderReadingLibrary({
  root,
  router,
  client,
  t,
  onOpenBook,
  initialImportBatch = null
}) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('screen.readingLibrary'),
    backLabel: t('nav.back')
  });

  let page = 1;
  let query = '';
  let listGeneration = 0;
  let currentImportBatch = initialImportBatch;

  const status = document.createElement('p');
  status.className = 'reading-library-status';
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  if (batchHasResults(currentImportBatch)) status.textContent = importSummary(currentImportBatch, t);

  const importButton = makeButton(t('readingLibrary.import'), async () => {
    importButton.disabled = true;
    const batch = await client.pickDocuments();
    importButton.disabled = false;
    if (batch?.cancelled) return;
    currentImportBatch = batch;
    status.textContent = importSummary(batch, t);
    page = 1;
    await refresh();
  });
  importButton.id = 'reading-library-import';
  root.append(importButton, status);

  const openNowHost = document.createElement('div');
  openNowHost.className = 'reading-library-open-now';
  root.append(openNowHost);

  function renderOpenNow() {
    openNowHost.replaceChildren();
    const imported = Array.isArray(currentImportBatch?.imported) ? currentImportBatch.imported : [];
    if (imported.length === 1) {
      const book = imported[0];
      openNowHost.append(makeButton(t('readingLibrary.openNow'), () => onOpenBook?.(book.id)));
    }
  }
  renderOpenNow();

  const continueSection = document.createElement('section');
  continueSection.className = 'reading-library-continue';
  const continueHeading = document.createElement('h2');
  continueHeading.textContent = t('readingLibrary.continueReading');
  continueSection.append(continueHeading);
  const continueContent = document.createElement('div');
  continueSection.append(continueContent);
  root.append(continueSection);

  const searchForm = document.createElement('form');
  searchForm.className = 'reading-library-search';
  const searchLabel = document.createElement('label');
  searchLabel.htmlFor = 'reading-library-query';
  searchLabel.textContent = t('readingLibrary.searchLabel');
  const searchInput = document.createElement('input');
  searchInput.id = 'reading-library-query';
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchInput.placeholder = t('readingLibrary.searchPlaceholder');
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.textContent = t('readingLibrary.searchSubmit');
  searchForm.append(searchLabel, searchInput, searchButton);
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    query = searchInput.value.trim();
    page = 1;
    void refreshList();
  });
  root.append(searchForm);

  const librarySection = document.createElement('section');
  const libraryHeading = document.createElement('h2');
  libraryHeading.textContent = t('readingLibrary.myLibrary');
  librarySection.append(libraryHeading);

  const list = document.createElement('div');
  list.className = 'content-list reading-library-list';
  librarySection.append(list);

  const pagination = document.createElement('nav');
  pagination.className = 'reading-library-pagination';
  pagination.setAttribute('aria-label', t('readingLibrary.pagination'));
  librarySection.append(pagination);
  root.append(librarySection);

  async function refreshLatest() {
    const book = await client.getLatestInProgress();
    continueContent.replaceChildren();
    if (!book) {
      continueSection.hidden = true;
      return;
    }
    continueSection.hidden = false;
    const button = makeButton(book.title || t('readingLibrary.untitled'), () => onOpenBook?.(book.id));
    const detail = document.createElement('p');
    detail.className = 'muted';
    detail.textContent = `${stateLabel(book, t)}. ${progressLabel(book, t)}`;
    continueContent.append(button, detail);
  }

  function renderBook(item) {
    const article = document.createElement('article');
    article.className = 'content-card reading-library-item';

    const title = makeButton(item.title || t('readingLibrary.untitled'), () => onOpenBook?.(item.id), 'reading-library-title');
    article.append(title);

    const detail = document.createElement('p');
    detail.className = 'muted';
    detail.textContent = `${stateLabel(item, t)}. ${progressLabel(item, t)}`;
    article.append(detail);

    const options = makeButton(
      format(t('readingLibrary.options'), { title: item.title || t('readingLibrary.untitled') }),
      () => {
        const expanded = options.getAttribute('aria-expanded') === 'true';
        options.setAttribute('aria-expanded', String(!expanded));
        actions.hidden = expanded;
        if (expanded) confirmHost.replaceChildren();
      }
    );
    options.setAttribute('aria-expanded', 'false');
    article.append(options);

    const actions = document.createElement('div');
    actions.hidden = true;
    const confirmHost = document.createElement('div');

    const deleteButton = makeButton(t('readingLibrary.delete'), () => {
      confirmHost.replaceChildren();
      const confirm = makeButton(
        format(t('readingLibrary.confirmDelete'), { title: item.title || t('readingLibrary.untitled') }),
        async () => {
          confirm.disabled = true;
          const deleted = await client.deleteBook(item.id);
          if (!deleted) {
            confirm.disabled = false;
            status.textContent = t('readingLibrary.deleteFailed');
            return;
          }
          status.textContent = t('readingLibrary.deleted');
          await refresh();
        }
      );
      const cancel = makeButton(t('readingLibrary.cancelDelete'), () => confirmHost.replaceChildren());
      confirmHost.append(confirm, cancel);
    });

    actions.append(deleteButton, confirmHost);
    article.append(actions);
    return article;
  }

  function renderPagination(result) {
    pagination.replaceChildren();
    const pages = Math.max(1, Number(result?.pages) || 1);
    const currentPage = Math.min(pages, Math.max(1, Number(result?.page) || page));
    page = currentPage;

    const previous = makeButton(t('readingLibrary.previousPage'), () => {
      if (page <= 1) return;
      page -= 1;
      void refreshList();
    });
    previous.disabled = page <= 1;

    const pageStatus = document.createElement('span');
    pageStatus.className = 'reading-library-page-status';
    pageStatus.textContent = format(t('readingLibrary.pageStatus'), { page, pages });

    const next = makeButton(t('readingLibrary.nextPage'), () => {
      if (page >= pages) return;
      page += 1;
      void refreshList();
    });
    next.disabled = page >= pages;

    pagination.append(previous, pageStatus, next);
  }

  async function refreshList() {
    const generation = ++listGeneration;
    const result = await client.listBooks({ page, pageSize: PAGE_SIZE, query });
    if (generation !== listGeneration) return;

    list.replaceChildren();
    if (!result.items?.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = t('readingLibrary.empty');
      list.append(empty);
    } else {
      for (const item of result.items) list.append(renderBook(item));
    }
    renderPagination(result);
  }

  async function refresh() {
    renderOpenNow();
    await Promise.all([refreshLatest(), refreshList()]);
  }

  void refresh();
}
