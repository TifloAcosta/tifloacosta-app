(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_ACTUALIDAD_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const editorialStates = new Set(['source-only', 'selected', 'adapted', 'withheld']);
  const contentTypes = new Set(['news', 'app', 'audio', 'video']);
  const DAY_MS = 24 * 60 * 60 * 1000;

  function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (error) {
      return false;
    }
  }

  function normalizedLocale(value) {
    if (!value || typeof value !== 'object') return null;
    const title = cleanString(value.title);
    if (!title) return null;
    return {
      title,
      summary: cleanString(value.summary),
      body: cleanString(value.body)
    };
  }

  function legacyToLogical(raw) {
    const lang = cleanString(raw?.lang).toLowerCase();
    if (!['es', 'en'].includes(lang)) return null;
    return {
      ...raw,
      type: 'news',
      originalLanguage: lang,
      locales: {
        [lang]: {
          title: cleanString(raw.title),
          summary: cleanString(raw.summary),
          body: cleanString(raw.body)
        }
      },
      media: null
    };
  }

  function normalizeContent(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const isLegacy = !raw.locales && !raw.originalLanguage;
    const candidate = isLegacy ? legacyToLogical(raw) : raw;
    if (!candidate) return null;

    const id = cleanString(candidate.id);
    const type = cleanString(candidate.type || 'news').toLowerCase();
    const sourceId = cleanString(candidate.sourceId);
    const sourceName = cleanString(candidate.sourceName);
    const sourceUrl = cleanString(candidate.sourceUrl);
    const originalUrl = cleanString(candidate.originalUrl);
    const originalLanguage = cleanString(candidate.originalLanguage).toLowerCase();
    const editorialState = cleanString(candidate.editorialState);
    const categories = Array.isArray(candidate.categories)
      ? [...new Set(candidate.categories.map(cleanString).filter(Boolean))]
      : [];
    const date = new Date(candidate.publishedAt);

    if (!id || !contentTypes.has(type) || !sourceId || !sourceName) return null;
    if (!validHttpUrl(sourceUrl) || !validHttpUrl(originalUrl)) return null;
    if (!['es', 'en'].includes(originalLanguage)) return null;
    if (Number.isNaN(date.getTime()) || categories.length === 0 || !editorialStates.has(editorialState)) return null;

    const locales = {};
    for (const lang of ['es', 'en']) {
      const locale = normalizedLocale(candidate.locales?.[lang]);
      if (locale) locales[lang] = locale;
    }

    if (!locales[originalLanguage]) return null;
    if (!isLegacy && editorialState === 'adapted' && (!locales.es || !locales.en)) return null;

    const featuredRank = Number.isFinite(Number(candidate.featuredRank)) && candidate.featuredRank !== null && candidate.featuredRank !== ''
      ? Number(candidate.featuredRank)
      : null;

    return {
      id,
      type,
      sourceId,
      sourceName,
      sourceUrl,
      originalUrl,
      originalLanguage,
      publishedAt: date.toISOString(),
      categories,
      editorialState,
      featuredRank,
      locales,
      media: candidate.media && typeof candidate.media === 'object' ? { ...candidate.media } : null
    };
  }

  function localizedStory(raw, lang) {
    const requestedLanguage = cleanString(lang).toLowerCase();
    if (!['es', 'en'].includes(requestedLanguage)) return null;

    const item = normalizeContent(raw);
    const locale = item?.locales?.[requestedLanguage];
    if (!item || !locale) return null;

    return {
      id: item.id,
      lang: requestedLanguage,
      title: locale.title,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      originalUrl: item.originalUrl,
      publishedAt: item.publishedAt,
      categories: item.categories,
      editorialState: item.editorialState,
      summary: locale.summary,
      body: locale.body,
      featuredRank: item.featuredRank,
      type: item.type,
      originalLanguage: item.originalLanguage,
      media: item.media
    };
  }

  function normalizeStory(raw) {
    const lang = cleanString(raw?.lang || raw?.originalLanguage).toLowerCase();
    return localizedStory(raw, lang);
  }

  function sortStories(items) {
    return [...items].sort((a, b) => {
      const aRank = a.featuredRank === null ? Number.POSITIVE_INFINITY : a.featuredRank;
      const bRank = b.featuredRank === null ? Number.POSITIVE_INFINITY : b.featuredRank;
      if (aRank !== bRank) return aRank - bRank;

      const dateDelta = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (dateDelta) return dateDelta;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function publicStories(items, lang) {
    const selected = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const item = localizedStory(raw, lang);
      if (!item || item.editorialState === 'withheld') continue;
      selected.push(item);
    }
    return sortStories(selected);
  }

  function isFeaturedEligible(item, now = new Date(), maxAgeDays = 5) {
    const published = new Date(item?.publishedAt).getTime();
    const reference = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const safeDays = Number(maxAgeDays);
    if (Number.isNaN(published) || Number.isNaN(reference) || !Number.isFinite(safeDays) || safeDays < 0) return false;
    const age = reference - published;
    return age >= 0 && age <= safeDays * DAY_MS;
  }

  function homePreview(items, lang, limit = 5, now = new Date()) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    const ordered = publicStories(items, lang).filter(item => isFeaturedEligible(item, now));
    const selected = [];
    const deferred = [];
    const sourceCounts = new Map();
    const maxPerSource = 2;

    for (const item of ordered) {
      const count = sourceCounts.get(item.sourceId) || 0;
      if (count < maxPerSource && selected.length < safeLimit) {
        selected.push(item);
        sourceCounts.set(item.sourceId, count + 1);
      } else {
        deferred.push(item);
      }
    }

    for (const item of deferred) {
      if (selected.length >= safeLimit) break;
      selected.push(item);
    }

    return selected.slice(0, safeLimit);
  }

  return { homePreview, isFeaturedEligible, localizedStory, normalizeContent, normalizeStory, publicStories, sortStories };
}));
