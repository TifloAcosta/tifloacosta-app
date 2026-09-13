(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_ACTUALIDAD_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const editorialStates = new Set(['source-only', 'adapted', 'withheld']);

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

  function normalizeStory(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = cleanString(raw.id);
    const lang = cleanString(raw.lang).toLowerCase();
    const title = cleanString(raw.title);
    const sourceId = cleanString(raw.sourceId);
    const sourceName = cleanString(raw.sourceName);
    const sourceUrl = cleanString(raw.sourceUrl);
    const originalUrl = cleanString(raw.originalUrl);
    const editorialState = cleanString(raw.editorialState);
    const categories = Array.isArray(raw.categories)
      ? [...new Set(raw.categories.map(cleanString).filter(Boolean))]
      : [];
    const date = new Date(raw.publishedAt);

    if (!id || !['es', 'en'].includes(lang) || !title || !sourceId || !sourceName) return null;
    if (!validHttpUrl(sourceUrl) || !validHttpUrl(originalUrl)) return null;
    if (Number.isNaN(date.getTime()) || categories.length === 0 || !editorialStates.has(editorialState)) return null;

    const featuredRank = Number.isFinite(Number(raw.featuredRank)) && raw.featuredRank !== null && raw.featuredRank !== ''
      ? Number(raw.featuredRank)
      : null;

    return {
      id,
      lang,
      title,
      sourceId,
      sourceName,
      sourceUrl,
      originalUrl,
      publishedAt: date.toISOString(),
      categories,
      editorialState,
      summary: cleanString(raw.summary),
      body: cleanString(raw.body),
      featuredRank
    };
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
      const item = normalizeStory(raw);
      if (!item || item.editorialState === 'withheld' || item.lang !== lang) continue;
      selected.push(item);
    }
    return sortStories(selected);
  }

  function homePreview(items, lang, limit = 5) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    return publicStories(items, lang).slice(0, safeLimit);
  }

  return { homePreview, normalizeStory, publicStories, sortStories };
}));
