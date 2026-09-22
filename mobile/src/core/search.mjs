function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleForLanguage(item, lang) {
  return !item?.lang || item.lang === lang;
}

function resultFrom(kind, item) {
  if (kind === 'resource') {
    return {
      kind,
      id: String(item.id || ''),
      title: String(item.title || ''),
      subtitle: String(item.category || ''),
      route: 'library',
      source: item
    };
  }
  if (kind === 'video') {
    return {
      kind,
      id: String(item.id || ''),
      title: String(item.title || ''),
      subtitle: String(item.excerpt || item.description || ''),
      route: 'videos',
      source: item
    };
  }
  return {
    kind: 'news',
    id: String(item.id || ''),
    title: String(item.title || ''),
    subtitle: String(item.summary || item.sourceName || ''),
    route: 'actualidad',
    source: item
  };
}

function searchableText(kind, item) {
  if (kind === 'resource') return `${item.title || ''} ${item.category || ''}`;
  if (kind === 'video') return `${item.title || ''} ${item.description || ''} ${item.excerpt || ''}`;
  return `${item.title || ''} ${item.summary || ''} ${item.sourceName || ''}`;
}

function rank(result, query) {
  const title = normalize(result.title);
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  return 2;
}

function httpUrl(value = '') {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}

export function searchResultAction(result = {}) {
  const kind = String(result.kind || '');
  if (kind === 'video') {
    const id = String(result.id || '').trim();
    return id ? { type: 'video', id } : null;
  }
  if (kind === 'resource') {
    const url = httpUrl(result.source?.openUrl || result.source?.url);
    return url ? { type: 'resource', url } : null;
  }
  if (kind === 'news') {
    const url = httpUrl(result.source?.originalUrl || result.source?.url);
    return url ? { type: 'news', url } : null;
  }
  return null;
}

export function searchContent(content = {}, query = '', lang = 'es') {
  const term = normalize(query);
  if (!term) return [];
  const language = lang === 'en' ? 'en' : 'es';
  const results = [];

  for (const item of Array.isArray(content.resources) ? content.resources : []) {
    if (!visibleForLanguage(item, language)) continue;
    if (normalize(searchableText('resource', item)).includes(term)) results.push(resultFrom('resource', item));
  }
  for (const item of Array.isArray(content.videos) ? content.videos : []) {
    if (normalize(searchableText('video', item)).includes(term)) results.push(resultFrom('video', item));
  }
  for (const item of Array.isArray(content.news) ? content.news : []) {
    if (!visibleForLanguage(item, language)) continue;
    if (normalize(searchableText('news', item)).includes(term)) results.push(resultFrom('news', item));
  }

  return results.sort((a, b) => {
    const score = rank(a, term) - rank(b, term);
    if (score) return score;
    const title = normalize(a.title).localeCompare(normalize(b.title), language);
    if (title) return title;
    return String(a.id).localeCompare(String(b.id));
  });
}

export { normalize as normalizeSearchText };
