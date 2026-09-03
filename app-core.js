(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_APP_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const featuredNewsIds = {
    es: [
      'es-1xT5cXyLJ1IoRq5wYrYmzqxVeHBwJmXdb',
      'es-1FKsaxZ_-NgKsHWWBI_i25X8rEqwQHTgN',
      'es-1sxkdwNWtbDitDu-GVRNDOwvNX4n6CaG6'
    ],
    en: [
      'en-1pOu-JfqCibjFb8EoURlQXpqtmRvhcuoZ',
      'en-177Ni4DvWPtzmP6C7U4LbjB5GMTLiLzR4',
      'en-1Gcty0-OWwfAD--XruEZYzUO_9kTatGBC'
    ]
  };
  const featuredRanks = new Map(
    Object.values(featuredNewsIds).flatMap(ids => ids.map((id, index) => [id, index]))
  );

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
    const aRank = featuredRanks.has(a.id) ? featuredRanks.get(a.id) : Number.POSITIVE_INFINITY;
    const bRank = featuredRanks.has(b.id) ? featuredRanks.get(b.id) : Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    const key = item => [item.title, item.category, item.id].map(normalizeSearchText).join('\u0000');
    const aKey = key(a);
    const bKey = key(b);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  }

  function getFeaturedNewsIds(lang) {
    return [...(featuredNewsIds[lang] || [])];
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

  function detectInstallPlatform(navigatorLike) {
    const nav = navigatorLike || {};
    const ua = String(nav.userAgent || '').toLowerCase();
    const platform = String(nav.platform || '').toLowerCase();
    const touchPoints = Number(nav.maxTouchPoints || 0);
    if (/iphone|ipad|ipod/.test(ua) || /iphone|ipad|ipod/.test(platform) || (platform === 'macintel' && touchPoints > 1)) return 'ios';
    if (ua.includes('android') || platform.includes('android')) return 'android';
    if (ua.includes('windows') || platform.startsWith('win')) return 'windows';
    if (ua.includes('macintosh') || platform.startsWith('mac')) return 'macos';
    return 'other';
  }

  function platformAnalyticsLabel(platform) {
    return ({ ios: 'iOS', android: 'Android', windows: 'Windows', macos: 'macOS', other: 'Other' })[platform] || 'Other';
  }

  function getInstallAnalyticsEvents({ standalone, installedNow, alreadyTracked, platform }) {
    const normalizedPlatform = ['ios', 'android', 'windows', 'macos'].includes(platform) ? platform : 'other';
    const label = platformAnalyticsLabel(normalizedPlatform);
    const events = [];
    if (!alreadyTracked && (standalone || installedNow)) {
      events.push({ path: `pwa-install-${normalizedPlatform}`, title: `PWA install · ${label}` });
    }
    if (standalone) {
      events.push({ path: `pwa-open-${normalizedPlatform}`, title: `PWA open · ${label}` });
    }
    return events;
  }

  return { compareNewsItems, detectInstallPlatform, getFeaturedNewsIds, getInstallAnalyticsEvents, getStorage, normalizeSearchText, readStoredJson, readStoredValue, resourceMatches, writeStoredJson, writeStoredValue };
}));
