const clean = value => String(value ?? '').trim();
const fold = value => clean(value).toLocaleLowerCase();

export const RESOURCE_PLATFORMS = Object.freeze(['all','android','iphone','windows']);

export function resourceMatchesPlatform(item, platform='all') {
  const key = fold(platform);
  if (!key || key === 'all') return true;
  const text = fold(`${item?.category || ''} ${item?.title || ''}`);
  if (key === 'android') return /\bandroid\b|\btalkback\b|\bjieshuo\b/u.test(text);
  if (key === 'iphone') return /\biphone\b|\bipad\b|\bios\b|\batajos?\b|\bshortcuts?\b/u.test(text);
  if (key === 'windows') return /\bwindows\b|\bjaws\b|\bnvda\b/u.test(text);
  return true;
}

export function resourcesForLanguage(items=[], lang='es') {
  const language = fold(lang) === 'en' ? 'en' : 'es';
  return (Array.isArray(items) ? items : []).filter(item => !item?.lang || fold(item.lang) === language);
}

export function resourceCategories(items=[], lang='es') {
  return [...new Set(resourcesForLanguage(items, lang)
    .map(item => clean(item?.category))
    .filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, fold(lang)==='en'?'en':'es'));
}

export function resourceMatchesQuery(item, query='') {
  const q = fold(query);
  if (!q) return true;
  return fold(`${item?.title || ''} ${item?.category || ''}`).includes(q);
}

export function selectResources(items=[], {
  lang='es',
  platform='all',
  category='',
  query='',
  favoriteIds=null
}={}) {
  const favorites = favoriteIds instanceof Set ? favoriteIds : null;
  return resourcesForLanguage(items, lang).filter(item => {
    if (!resourceMatchesPlatform(item, platform)) return false;
    if (clean(category) && clean(item?.category) !== clean(category)) return false;
    if (clean(query) && !resourceMatchesQuery(item, query)) return false;
    if (favorites && !favorites.has(String(item?.id || ''))) return false;
    return true;
  });
}

export function newestResources(items=[], { lang='es', limit=3 }={}) {
  return resourcesForLanguage(items, lang)
    .filter(item => item?.new === true || item?.isNew === true)
    .slice(0, Math.max(0, Number(limit) || 0));
}
