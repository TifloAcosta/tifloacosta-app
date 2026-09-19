(() => {
  'use strict';

  const categories = Object.freeze({
    ringtones: Object.freeze({ es:'Tonos de llamada', en:'Ringtones', query:'ringtone phone ring' }),
    notifications: Object.freeze({ es:'Notificaciones', en:'Notifications', query:'notification alert' }),
    alarms: Object.freeze({ es:'Alarmas', en:'Alarms', query:'alarm warning' }),
    phones: Object.freeze({ es:'Teléfonos', en:'Phones', query:'telephone phone' }),
    technology: Object.freeze({ es:'Tecnología', en:'Technology', query:'technology computer digital' }),
    nature: Object.freeze({ es:'Naturaleza', en:'Nature', query:'nature ambient' }),
    animals: Object.freeze({ es:'Animales', en:'Animals', query:'animal' }),
    ambience: Object.freeze({ es:'Ambiente', en:'Ambience', query:'ambience atmosphere' }),
    funny: Object.freeze({ es:'Divertidos', en:'Funny', query:'funny cartoon' }),
    games: Object.freeze({ es:'Juegos', en:'Games', query:'game arcade' })
  });

  function validateSearch(term, category) {
    const normalizedTerm = String(term || '').trim();
    const normalizedCategory = String(category || '').trim();
    const knownCategory = categories[normalizedCategory] ? normalizedCategory : '';
    return {
      ok: Boolean(normalizedTerm || knownCategory),
      term: normalizedTerm,
      category: knownCategory
    };
  }

  function buildProviderQuery(term, category) {
    const valid = validateSearch(term, category);
    if (!valid.ok) return '';
    return [
      valid.term,
      valid.category ? categories[valid.category].query : ''
    ].filter(Boolean).join(' ');
  }

  function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function normalizeResult(raw, provider) {
    const item = raw && typeof raw === 'object' ? raw : {};
    return {
      id: item.id === null || item.id === undefined ? '' : String(item.id),
      name: String(item.name || '').trim() || 'Sound',
      provider: String(provider || item.provider || '').trim(),
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

  function mergeResults(groups, limit = 20) {
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : 20;
    const seen = new Set();
    const merged = [];
    (Array.isArray(groups) ? groups : []).forEach(group => {
      if (!Array.isArray(group)) return;
      group.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const provider = String(item.provider || '').trim();
        const id = item.id === null || item.id === undefined ? '' : String(item.id);
        const key = `${provider}:${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(item);
      });
    });
    return merged.slice(0, safeLimit);
  }

  function formatDuration(value) {
    const duration = optionalNumber(value);
    if (duration === null) return '';
    const totalSeconds = Math.round(duration);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  window.TIFLO_SOUND_CORE = Object.freeze({
    categories,
    validateSearch,
    buildProviderQuery,
    normalizeResult,
    mergeResults,
    formatDuration
  });
})();
