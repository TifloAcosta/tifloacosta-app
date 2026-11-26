(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_RESOURCE_BROWSER = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

  function filterAndSort(resources, search='', sort='title', lang='es') {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    const items = (Array.isArray(resources) ? resources : []).filter(item => {
      if (!terms.length) return true;
      const text = normalize([item.title, item.category, ...folderPath(item), item.searchText,
        item.description, item.summary, item.keywords?.join(' ')].join(' '));
      return terms.every(term => text.includes(term));
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

  function folderPath(item) {
    return Array.isArray(item?.folderPath) ? item.folderPath.filter(part => typeof part === 'string' && part.trim()).map(part => part.trim()) : [];
  }

  function folderGroups(items, path = [], lang = 'es') {
    const direct = [], folders = new Map();
    for (const item of items) {
      const parts = folderPath(item);
      if (parts.length < path.length || !path.every((part, index) => parts[index] === part)) continue;
      if (parts.length === path.length) direct.push(item);
      else {
        const name = parts[path.length];
        if (!folders.has(name)) folders.set(name, []);
        folders.get(name).push(item);
      }
    }
    const collator = new Intl.Collator(lang === 'en' ? 'en' : 'es', { sensitivity:'base', numeric:true });
    return { direct, folders: [...folders.entries()].sort(([a],[b]) => collator.compare(a,b))
      .map(([name, items]) => ({ name, items })) };
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

  return { filterAndSort, latestPublications, folderPath, folderGroups };
}));
