export const SOUND_CATEGORIES = Object.freeze({
  ringtones: Object.freeze({ es: 'Tonos de llamada', en: 'Ringtones', query: 'ringtone phone ring' }),
  notifications: Object.freeze({ es: 'Notificaciones', en: 'Notifications', query: 'notification alert' }),
  alarms: Object.freeze({ es: 'Alarmas', en: 'Alarms', query: 'alarm warning' }),
  phones: Object.freeze({ es: 'Teléfonos', en: 'Phone sounds', query: 'telephone phone' }),
  technology: Object.freeze({ es: 'Tecnología', en: 'Technology', query: 'technology computer digital' }),
  nature: Object.freeze({ es: 'Naturaleza', en: 'Nature', query: 'nature ambient' }),
  animals: Object.freeze({ es: 'Animales', en: 'Animals', query: 'animal' }),
  ambience: Object.freeze({ es: 'Ambiente', en: 'Ambience', query: 'ambience atmosphere' }),
  funny: Object.freeze({ es: 'Divertidos', en: 'Fun', query: 'funny cartoon' }),
  games: Object.freeze({ es: 'Juegos', en: 'Games', query: 'game arcade' })
});

function codedError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function validateSearch(term, category) {
  const normalizedTerm = String(term || '').trim();
  const normalizedCategory = String(category || '').trim();
  const knownCategory = SOUND_CATEGORIES[normalizedCategory] ? normalizedCategory : '';
  return {
    ok: Boolean(normalizedTerm || knownCategory),
    term: normalizedTerm,
    category: knownCategory
  };
}

export function buildProviderQuery(term, category) {
  const valid = validateSearch(term, category);
  if (!valid.ok) return '';
  return [
    valid.term,
    valid.category ? SOUND_CATEGORIES[valid.category].query : ''
  ].filter(Boolean).join(' ');
}

export function normalizeSound(raw) {
  const item = raw && typeof raw === 'object' ? raw : {};
  return {
    id: item.id === null || item.id === undefined ? '' : String(item.id),
    name: String(item.name || '').trim() || 'Sound',
    provider: String(item.provider || '').trim(),
    pageUrl: item.pageUrl || null,
    previewUrl: item.previewUrl || null,
    downloadUrl: item.downloadUrl || null,
    duration: optionalNumber(item.duration),
    format: item.format || null,
    size: optionalNumber(item.size),
    license: item.license || null,
    author: item.author || null,
    tags: Array.isArray(item.tags) ? item.tags.map(value => String(value)) : []
  };
}

export function formatDuration(value) {
  const duration = optionalNumber(value);
  if (duration === null) return '';
  const totalSeconds = Math.round(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function createSoundSearchClient({
  fetchFn = (...args) => fetch(...args),
  endpoint = 'https://download.tifloacosta.com/sounds/search',
  timeoutMs = 10_000
} = {}) {
  async function search({ term = '', category = '', page = 1, query = '' } = {}) {
    const valid = validateSearch(term, category);
    const providerQuery = String(query || '').trim() || buildProviderQuery(valid.term, valid.category);
    if (!providerQuery) throw codedError('invalid_search');
    const requestedPage = Number(page);
    const safePage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: providerQuery,
          category: valid.category,
          page: safePage
        }),
        signal: controller.signal
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw codedError('bad_response');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw codedError('bad_response');

      if (payload.code === 'provider_unavailable') {
        return { status: 'unavailable', code: 'provider_unavailable', items: [] };
      }
      if (!response.ok && !payload.code) throw codedError('service_unavailable');
      if (payload.status !== 'ok' || !Array.isArray(payload.items)) {
        return { status: 'error', code: payload.code || 'service_unavailable', items: [] };
      }
      return {
        status: 'ok',
        provider: payload.provider || '',
        count: optionalNumber(payload.count) ?? payload.items.length,
        items: payload.items.map(normalizeSound)
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw codedError('timeout');
      if (error?.code) throw error;
      throw codedError('service_unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  return { search };
}
