(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TifloVideoCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function normalizeText(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function indexedMetadata(video) {
    const index = typeof globalThis !== 'undefined' ? globalThis.TIFLO_VIDEO_SEARCH_INDEX : null;
    const videos = index && typeof index === 'object' && index.videos && typeof index.videos === 'object'
      ? index.videos
      : {};
    const extra = videos[video && video.id];
    return extra && typeof extra === 'object' ? extra : {};
  }

  function keywordText(value) {
    if (Array.isArray(value)) return value.join(' ');
    return String(value || '');
  }

  function supplementalText(video) {
    const extra = indexedMetadata(video);
    return [
      keywordText(video && video.keywords),
      keywordText(extra.keywords),
      video && video.searchText,
      extra.searchText,
      video && video.adaptedText,
      extra.adaptedText
    ].filter(Boolean).join(' ');
  }

  function filterVideos(videos, query) {
    const items = Array.isArray(videos) ? videos : [];
    const term = normalizeText(query);
    if (!term) return [...items];
    const words = term.split(' ').filter(Boolean);
    return items.filter(video => {
      const haystack = normalizeText(`${video.title || ''} ${video.description || ''} ${video.excerpt || ''} ${supplementalText(video)}`);
      return words.every(word => haystack.includes(word));
    });
  }

  function applySearchIndex(videos, index) {
    const items = Array.isArray(videos) ? videos : [];
    const entries = index && typeof index === 'object' && index.videos && typeof index.videos === 'object'
      ? index.videos
      : {};
    return items.map(video => {
      const extra = entries[video && video.id];
      return extra && typeof extra === 'object' ? { ...video, ...extra } : { ...video };
    });
  }

  function sortVideos(videos, order = 'newest') {
    const items = Array.isArray(videos) ? [...videos] : [];
    const direction = order === 'oldest' ? 1 : -1;
    return items.sort((a, b) => {
      const aTime = Date.parse(a.publishedAt || '') || 0;
      const bTime = Date.parse(b.publishedAt || '') || 0;
      if (aTime !== bTime) return (aTime - bTime) * direction;
      return String(a.id || '').localeCompare(String(b.id || '')) * direction;
    });
  }

  function paginate(videos, requestedPage = 1, pageSize = 10) {
    const items = Array.isArray(videos) ? videos : [];
    const size = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Math.floor(Number(pageSize)) : 10;
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const rawPage = Number.isFinite(Number(requestedPage)) ? Math.floor(Number(requestedPage)) : 1;
    const page = Math.min(totalPages, Math.max(1, rawPage));
    const offset = (page - 1) * size;
    const pageItems = items.slice(offset, offset + size);
    return {
      items: pageItems,
      page,
      pageSize: size,
      totalPages,
      totalItems: items.length,
      start: items.length ? offset + 1 : 0,
      end: items.length ? offset + pageItems.length : 0
    };
  }

  return { normalizeText, filterVideos, applySearchIndex, sortVideos, paginate };
});

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('script[data-tiflo-search-accessibility]')) return;
    const script = document.createElement('script');
    script.src = new URL('search-accessibility.js?v=1.0', document.baseURI).href;
    script.dataset.tifloSearchAccessibility = 'true';
    document.head.append(script);
  }, { once: true });
}
