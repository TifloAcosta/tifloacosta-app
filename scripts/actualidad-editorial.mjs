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
    if (!overlay) return { ...story };

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
  });
}
