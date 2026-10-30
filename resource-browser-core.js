(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_RESOURCE_BROWSER = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

  function filterAndSort(resources, search='', sort='title', lang='es') {
    const term = normalize(search);
    const items = (Array.isArray(resources) ? resources : []).filter(item => {
      if (!term) return true;
      return normalize([item.title, item.searchText, item.keywords?.join(' ')].join(' ')).includes(term);
    });
    const collator = new Intl.Collator(lang === 'en' ? 'en' : 'es', { sensitivity:'base', numeric:true });
    return items.sort((a,b) => {
      if (sort === 'recent') {
        const dateDiff = (Date.parse(b.newsDate || '') || 0) - (Date.parse(a.newsDate || '') || 0);
        if (dateDiff) return dateDiff;
      }
      return collator.compare(String(a.title||''),String(b.title||''));
    });
  }

  function latestPublications(resources, lang='es') {
    const language = lang === 'en' ? 'en' : 'es';
    const items = (Array.isArray(resources) ? resources : []).filter(item =>
      item && item.lang === language && item.new === true && item.title && item.url
    );
    return items.sort((a,b) => {
      const diff=(Date.parse(b.newsDate||'')||0)-(Date.parse(a.newsDate||'')||0);
      return diff || String(a.title).localeCompare(String(b.title), language);
    });
  }

  return { filterAndSort, latestPublications };
}));
