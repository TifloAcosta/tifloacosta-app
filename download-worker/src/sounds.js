const FREESOUND_SEARCH_URL = 'https://freesound.org/apiv2/search/';
const FIELDS = 'id,name,username,license,duration,type,filesize,tags,previews';
const REQUEST_TIMEOUT_MS = 8000;
const PAGE_SIZE = 20;

const CATEGORY_FALLBACKS = Object.freeze({
  ringtones: 'ringtone phone ring',
  notifications: 'notification alert',
  alarms: 'alarm warning',
  phones: 'telephone phone',
  technology: 'technology computer digital',
  nature: 'nature ambient',
  animals: 'animal',
  ambience: 'ambience atmosphere',
  funny: 'funny cartoon',
  games: 'game arcade'
});

function errorPayload(code, message) {
  return { status: 'error', code, message };
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeRequest(input) {
  const body = input && typeof input === 'object' ? input : {};
  const query = String(body.query || '').trim();
  const category = String(body.category || '').trim();
  const fallback = CATEGORY_FALLBACKS[category] || '';
  const effectiveQuery = query || fallback;
  const requestedPage = Number(body.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return { query: effectiveQuery, category, page };
}

function mapSound(sound) {
  const source = sound && typeof sound === 'object' ? sound : {};
  const id = source.id === null || source.id === undefined ? '' : String(source.id);
  const previews = source.previews && typeof source.previews === 'object' ? source.previews : {};
  return {
    id,
    name: String(source.name || '').trim() || 'Sound',
    provider: 'freesound',
    pageUrl: id ? `https://freesound.org/s/${encodeURIComponent(id)}/` : null,
    previewUrl: previews['preview-hq-mp3'] || previews['preview-lq-mp3'] || null,
    downloadUrl: null,
    duration: optionalNumber(source.duration),
    format: source.type || null,
    size: optionalNumber(source.filesize),
    license: source.license || null,
    author: source.username || null,
    tags: Array.isArray(source.tags) ? source.tags.map(value => String(value)) : []
  };
}

export async function searchFreesound(input, env = {}, fetchImpl = fetch) {
  const request = normalizeRequest(input);
  if (!request.query) return errorPayload('invalid_search', 'Enter a search term or choose a category.');
  if (!env?.FREESOUND_API_KEY) return errorPayload('provider_unavailable', 'Freesound search is temporarily unavailable.');

  const url = new URL(FREESOUND_SEARCH_URL);
  url.searchParams.set('query', request.query);
  url.searchParams.set('page', String(request.page));
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('fields', FIELDS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.href, {
      method: 'GET',
      headers: {
        Authorization: `Token ${env.FREESOUND_API_KEY}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    if (!response?.ok) return errorPayload('provider_unavailable', 'Freesound did not accept the search request.');

    let payload;
    try { payload = await response.json(); }
    catch (error) { return errorPayload('provider_unavailable', 'Freesound returned an invalid response.'); }

    if (!payload || !Array.isArray(payload.results)) {
      return errorPayload('provider_unavailable', 'Freesound returned an invalid response.');
    }

    const items = payload.results.map(mapSound).filter(item => item.id && item.pageUrl);
    return {
      status: 'ok',
      provider: 'freesound',
      items,
      count: optionalNumber(payload.count) ?? items.length
    };
  } catch (error) {
    return errorPayload('provider_unavailable', 'Freesound search is temporarily unavailable.');
  } finally {
    clearTimeout(timer);
  }
}
