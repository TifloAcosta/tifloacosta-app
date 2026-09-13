function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

function score(item, query) {
  const title = normalize(item.title);
  if (title.startsWith(query)) return 0;
  if (title.includes(query)) return 1;
  const extra = normalize([
    item.category,
    item.description,
    item.excerpt,
    item.summary,
    item.sourceName,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).join(' '));
  return extra.includes(query) ? 2 : Number.POSITIVE_INFINITY;
}

function toResult(kind, item) {
  const routes = { resource: 'library', video: 'videos', news: 'actualidad' };
  return {
    kind,
    id: String(item.id),
    title: item.title || '',
    subtitle: item.category || item.excerpt || item.description || item.sourceName || '',
    route: routes[kind],
    source: item
  };
}

export function searchContent(content, query, lang) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const candidates = [
    ...(content?.resources || [])
      .filter(item => item.lang === lang)
      .map(item => ({ kind: 'resource', item })),
    ...(content?.news || [])
      .filter(item => !item.lang || item.lang === lang)
      .map(item => ({ kind: 'news', item })),
    ...(content?.videos || []).map(item => ({ kind: 'video', item }))
  ];

  return candidates
    .map(candidate => ({ ...candidate, rank: score(candidate.item, normalizedQuery) }))
    .filter(candidate => Number.isFinite(candidate.rank))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const titleOrder = String(a.item.title || '').localeCompare(String(b.item.title || ''), lang, { sensitivity: 'base' });
      if (titleOrder) return titleOrder;
      return String(a.item.id).localeCompare(String(b.item.id));
    })
    .map(({ kind, item }) => toResult(kind, item));
}

export { normalize as normalizeSearchText };
