(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_APP_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeSearchText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function resourceMatches(item, query) {
    const term = normalizeSearchText(query);
    if (!term) return false;
    const text = normalizeSearchText(`${item.title || ''} ${item.category || ''}`);
    if (term.length <= 2) return text.split(/[^a-z0-9]+/).includes(term);
    return text.includes(term);
  }

  function compareNewsItems(a, b) {
    const key = item => [item.title, item.category, item.id].map(normalizeSearchText).join('\u0000');
    const aKey = key(a);
    const bKey = key(b);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  }

  function getStorage(target) {
    try { return target.localStorage; }
    catch (error) { return undefined; }
  }

  function readStoredJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStoredJson(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { return false; }
  }

  function readStoredValue(storage, key, fallback) {
    try { return storage.getItem(key) || fallback; }
    catch (error) { return fallback; }
  }

  function writeStoredValue(storage, key, value) {
    try { storage.setItem(key, value); return true; }
    catch (error) { return false; }
  }

  return { compareNewsItems, getStorage, normalizeSearchText, readStoredJson, readStoredValue, resourceMatches, writeStoredJson, writeStoredValue };
}));
