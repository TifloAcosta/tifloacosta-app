(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_CONTEXTUAL_SEARCH = api;
  if (root.TIFLO_GLOBAL_SEARCH) api.enhanceSearchApi(root.TIFLO_GLOBAL_SEARCH);
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const stopWords = {
    es: new Set(['a','al','algo','como','con','de','del','el','en','es','esta','este','la','las','lo','los','me','mi','no','o','para','por','que','quiero','se','si','su','un','una','y','ponga']),
    en: new Set(['a','an','and','are','as','at','be','does','for','from','how','i','in','is','it','me','my','no','not','of','on','or','someone','the','to','when','with'])
  };

  const concepts = {
    es: [
      {
        triggers: ['llamada','llamadas','suena','suenan','sonar','timbre','mudo','muda'],
        related: ['llamada','llamadas','sonar','sonido','sonidos','timbre','volumen','silencio','notificacion','notificaciones','concentracion']
      },
      {
        triggers: ['dictar','dictado','dictando','puntuacion','coma','comas'],
        related: ['dictar','dictado','voz','escribir','escritura','historia','historias','puntuacion','punto','puntos','coma','comas','signo','signos']
      },
      {
        triggers: ['limpiar','limpio','espacio','almacenamiento','liberar'],
        related: ['limpiar','espacio','almacenamiento','liberar','borrar','archivo','archivos','files','android']
      },
      {
        triggers: ['descargar','descarga','descargas','extension','extensiones'],
        related: ['descargar','descarga','descargas','archivo','archivos','pdf','zip','guardar','enlace','enlaces']
      }
    ],
    en: [
      {
        triggers: ['call','calls','ring','ringing','ringtone','mute','muted'],
        related: ['call','calls','ring','ringing','ringtone','sound','sounds','volume','silent','notification','notifications','focus','phone','iphone']
      },
      {
        triggers: ['dictate','dictation','punctuation','comma','commas'],
        related: ['dictate','dictation','voice','write','writing','story','stories','punctuation','period','periods','comma','commas']
      },
      {
        triggers: ['clean','space','storage','free'],
        related: ['clean','space','storage','free','delete','file','files','android']
      },
      {
        triggers: ['download','downloads','extension','extensions'],
        related: ['download','downloads','file','files','pdf','zip','save','link','links']
      }
    ]
  };

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function words(value) {
    return normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);
  }

  function meaningfulWords(value, lang) {
    const ignored = stopWords[lang] || stopWords.es;
    return words(value).filter(word => word.length > 1 && !ignored.has(word));
  }

  function relatedTerms(query, lang) {
    const queryWords = meaningfulWords(query, lang);
    const expanded = new Set();
    for (const concept of concepts[lang] || []) {
      const active = concept.triggers.some(trigger => queryWords.some(word => word === trigger || word.startsWith(trigger) || trigger.startsWith(word)));
      if (!active) continue;
      concept.related.forEach(term => expanded.add(term));
    }
    return [...expanded];
  }

  function resultKey(item) {
    return `${item?.kind || ''}\u0000${item?.id || ''}\u0000${item?.href || ''}`;
  }

  function titleHas(item, term) {
    return normalizeText(item?.title).includes(normalizeText(term));
  }

  function enhanceSearchApi(searchApi) {
    if (!searchApi || typeof searchApi.searchAcrossSources !== 'function') return searchApi;
    if (searchApi.__contextualSearchEnhanced) return searchApi;

    const baseSearch = searchApi.searchAcrossSources.bind(searchApi);

    searchApi.searchAcrossSources = function contextualSearchAcrossSources(sources = {}, query = '', lang = 'es') {
      const language = lang === 'en' ? 'en' : 'es';
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) return [];

      const directWords = meaningfulWords(normalizedQuery, language);
      const expanded = relatedTerms(normalizedQuery, language);
      const candidates = new Map();
      let seen = 0;

      function addMatches(term, points, bucket) {
        if (!term) return;
        const matches = baseSearch(sources, term, language);
        for (const item of matches) {
          const key = resultKey(item);
          let candidate = candidates.get(key);
          if (!candidate) {
            candidate = { item, exact: 0, direct: 0, contextual: 0, firstSeen: seen++ };
            candidates.set(key, candidate);
          }
          const weighted = points + (titleHas(item, term) ? 4 : 0);
          candidate[bucket] += weighted;
        }
      }

      addMatches(normalizedQuery, 100, 'exact');
      if (directWords.length > 1) addMatches(directWords.join(' '), 70, 'exact');
      directWords.forEach(word => addMatches(word, 12, 'direct'));
      expanded.forEach(term => addMatches(term, 3, 'contextual'));

      const kept = [...candidates.values()].filter(candidate => {
        if (candidate.exact > 0) return true;
        if (directWords.length <= 1) return candidate.direct > 0;
        if (candidate.direct >= 16) return true;
        if (candidate.direct > 0 && candidate.contextual >= 6) return true;
        return candidate.contextual >= 12;
      });

      kept.sort((a, b) => {
        const aScore = a.exact + a.direct + a.contextual;
        const bScore = b.exact + b.direct + b.contextual;
        if (aScore !== bScore) return bScore - aScore;
        return a.firstSeen - b.firstSeen;
      });

      return kept.map(candidate => candidate.item);
    };

    Object.defineProperty(searchApi, '__contextualSearchEnhanced', { value: true, enumerable: false });
    return searchApi;
  }

  return { enhanceSearchApi, meaningfulWords, relatedTerms };
}));
