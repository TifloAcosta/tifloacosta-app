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
      .trim();
  }

  function filterVideos(videos, query) {
    const items = Array.isArray(videos) ? videos : [];
    const term = normalizeText(query);
    if (!term) return [...items];
    return items.filter(video => {
      const haystack = normalizeText(`${video.title || ''} ${video.description || ''} ${video.excerpt || ''}`);
      return haystack.includes(term);
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
    const start = (page - 1) * size;
    return {
      items: items.slice(start, start + size),
      page,
      pageSize: size,
      totalPages,
      totalItems: items.length
    };
  }

  return { normalizeText, filterVideos, sortVideos, paginate };
});
