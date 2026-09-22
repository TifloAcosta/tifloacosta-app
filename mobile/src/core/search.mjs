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
  if (kind === 'app' || kind === 'media') {
    return {
      kind,
      id: String(item.id || ''),
      title: String(item.title || ''),
      subtitle: String(item.summary || item.description || item.platform || ''),
      route: 'actualidad',
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
  if (kind === 'app') return `${item.title || ''} ${item.summary || ''} ${item.description || ''} ${item.platform || ''}`;
  if (kind === 'media') return `${item.title || ''} ${item.summary || ''} ${item.description || ''} ${item.platform || ''}`;
  return `${item.title || ''} ${item.summary || ''} ${item.sourceName || ''}`;
}

function rank(result, query) {
  const title = normalize(result.title);
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  return 2;
}

export function searchResultAction(result = {}) {
  if (result.kind === 'video') {
    const id = String(result.id || result.source?.id || '').trim();
    return id ? { type: 'video', id } : null;
  }
  if (result.kind === 'resource') {
    const url = String(result.source?.openUrl || result.source?.url || '').trim();
    return /^https?:\/\//i.test(url) ? { type: 'resource', url } : null;
  }
  if (result.kind === 'news') {
    const url = String(result.source?.originalUrl || result.source?.url || '').trim();
    return /^https?:\/\//i.test(url) ? { type: 'news', url } : null;
  }
  if (result.kind === 'app' || result.kind === 'media') {
    const url = String(result.source?.url || result.source?.originalUrl || result.source?.openUrl || '').trim();
    return /^https?:\/\//i.test(url) ? { type: result.kind, url } : null;
  }
  return null;
}

export function searchContent(content = {}, query = '', lang = 'es') {
  const term = normalize(query);
  if (!term) return [];
  const language = lang === 'en' ? 'en' : 'es';
  const results = [];

  const collections = [
    ['resource', content.resources],
    ['video', content.videos],
    ['news', content.news],
    ['app', content.apps],
    ['media', content.media]
  ];

  for (const [kind, values] of collections) {
    for (const item of Array.isArray(values) ? values : []) {
      if (kind !== 'video' && !visibleForLanguage(item, language)) continue;
      if (normalize(searchableText(kind, item)).includes(term)) results.push(resultFrom(kind, item));
    }
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
