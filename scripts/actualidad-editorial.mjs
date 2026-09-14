function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanCategories(value) {
  if (!Array.isArray(value)) return null;
  const categories = [...new Set(value.map(cleanString).filter(Boolean))];
  return categories.length ? categories : null;
}

function normalizedRank(value, fallback) {
  if (value === null) return null;
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanLocale(value) {
  if (!value || typeof value !== 'object') return null;
  const title = cleanString(value.title);
  if (!title) return null;
  return {
    title,
    summary: cleanString(value.summary),
    body: cleanString(value.body)
  };
}

function completeAdaptation(locales) {
  return Boolean(
    locales?.es?.title && locales?.es?.body &&
    locales?.en?.title && locales?.en?.body
  );
}

function sourceToLogical(story) {
  const originalLanguage = cleanString(story?.lang).toLowerCase();
  if (!['es', 'en'].includes(originalLanguage)) return { ...story };

  const sourceLocale = cleanLocale({
    title: story.title,
    summary: story.summary,
    body: story.body
  });

  return {
    id: story.id,
    type: 'news',
    sourceId: story.sourceId,
    sourceName: story.sourceName,
    sourceUrl: story.sourceUrl,
    originalUrl: story.originalUrl,
    originalLanguage,
    publishedAt: story.publishedAt,
    categories: Array.isArray(story.categories) ? [...story.categories] : [],
    editorialState: story.editorialState || 'source-only',
    featuredRank: story.featuredRank ?? null,
    locales: sourceLocale ? { [originalLanguage]: sourceLocale } : {},
    media: null
  };
}

function mergeLocales(baseLocales, overlayLocales) {
  const locales = { ...baseLocales };
  for (const lang of ['es', 'en']) {
    const locale = cleanLocale(overlayLocales?.[lang]);
    if (locale) locales[lang] = locale;
  }
  return locales;
}

function isLegacyOverlay(overlay) {
  return !overlay?.locales && Boolean(
    cleanString(overlay?.lang) || cleanString(overlay?.title) ||
    overlay?.summary !== undefined || overlay?.body !== undefined
  );
}

function mergeLegacyOverlay(story, overlay) {
  const categories = cleanCategories(overlay.categories);
  const requestedState = cleanString(overlay.editorialState);
  const requestedBody = overlay.body === undefined ? story.body : cleanString(overlay.body);

  let editorialState = story.editorialState;
  if (requestedState === 'withheld') editorialState = 'withheld';
  else if (requestedState === 'adapted') editorialState = requestedBody ? 'adapted' : 'source-only';
  else if (requestedState === 'source-only') editorialState = 'source-only';

  return {
    ...story,
    lang: cleanString(overlay.lang) || story.lang,
    title: cleanString(overlay.title) || story.title,
    summary: overlay.summary === undefined ? story.summary : cleanString(overlay.summary),
    body: editorialState === 'adapted' ? requestedBody : '',
    categories: categories || story.categories,
    featuredRank: normalizedRank(overlay.featuredRank, story.featuredRank),
    editorialState
  };
}

export function mergeEditorial(stories, editorialRecords) {
  const records = Array.isArray(editorialRecords) ? editorialRecords : [];
  const byId = new Map();
  const byUrl = new Map();

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const id = cleanString(record.id);
    const url = cleanString(record.originalUrl);
    if (id) byId.set(id, record);
    if (url) byUrl.set(url, record);
  }

  return (Array.isArray(stories) ? stories : []).map(story => {
    const overlay = byId.get(story.id) || byUrl.get(story.originalUrl);

    if (overlay && isLegacyOverlay(overlay)) {
      return mergeLegacyOverlay(story, overlay);
    }

    const logical = sourceToLogical(story);
    if (!overlay) return logical;

    const categories = cleanCategories(overlay.categories);
    const requestedState = cleanString(overlay.editorialState);
    const locales = mergeLocales(logical.locales, overlay.locales);

    let editorialState = logical.editorialState;
    if (requestedState === 'withheld') editorialState = 'withheld';
    else if (requestedState === 'source-only') editorialState = 'source-only';
    else if (requestedState === 'selected') editorialState = 'selected';
    else if (requestedState === 'adapted') editorialState = completeAdaptation(locales) ? 'adapted' : 'selected';

    return {
      ...logical,
      categories: categories || logical.categories,
      featuredRank: normalizedRank(overlay.featuredRank, logical.featuredRank),
      locales,
      editorialState
    };
  });
}
