import fs from 'node:fs';
import path from 'node:path';

function decodeEntities(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const digits = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(digits, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function normalizeTitle(value = '') {
  return decodeEntities(String(value))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function htmlToSearchText(html = '') {
  return decodeEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleFromHtml(html = '') {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
}

export function buildSearchIndex(videos, overrides = {}, adaptations = []) {
  const items = Array.isArray(videos) ? videos : [];
  const index = { videos: {} };
  const idsByTitle = new Map();

  for (const video of items) {
    const id = String(video && video.id || '').trim();
    const key = normalizeTitle(video && video.title || '');
    if (!id || !key) continue;
    const ids = idsByTitle.get(key) || [];
    ids.push(id);
    idsByTitle.set(key, ids);
  }

  for (const [id, extra] of Object.entries(overrides || {})) {
    if (!items.some(video => String(video && video.id || '') === id)) continue;
    const entry = {};
    if (Array.isArray(extra?.keywords)) {
      entry.keywords = [...new Set(extra.keywords.map(value => String(value).trim()).filter(Boolean))];
    }
    if (typeof extra?.searchText === 'string' && extra.searchText.trim()) entry.searchText = extra.searchText.trim();
    if (Object.keys(entry).length) index.videos[id] = entry;
  }

  for (const adaptation of Array.isArray(adaptations) ? adaptations : []) {
    const key = normalizeTitle(adaptation && adaptation.title || '');
    const text = String(adaptation && adaptation.text || '').replace(/\s+/g, ' ').trim();
    if (!key || !text) continue;
    for (const id of idsByTitle.get(key) || []) {
      const current = index.videos[id] || {};
      current.adaptedText = current.adaptedText ? `${current.adaptedText} ${text}` : text;
      index.videos[id] = current;
    }
  }

  return index;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function collectAdaptations(root = 'docs/es') {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter(name => /^video-text-.*\.html$/i.test(name))
    .map(name => {
      const html = fs.readFileSync(path.join(root, name), 'utf8');
      return { title: titleFromHtml(html), text: htmlToSearchText(html) };
    })
    .filter(item => item.title && item.text);
}

export function buildIndexFromFiles({
  catalogFile = 'videos.json',
  overridesFile = 'video-search-overrides.json',
  adaptationsDir = 'docs/es',
  outputFile = 'video-search-index.js'
} = {}) {
  const catalog = readJson(catalogFile, { videos: [] });
  const overrides = readJson(overridesFile, {});
  const adaptations = collectAdaptations(adaptationsDir);
  const index = buildSearchIndex(catalog.videos, overrides, adaptations);
  const output = `window.TIFLO_VIDEO_SEARCH_INDEX = ${JSON.stringify(index, null, 2)};\n`;
  fs.writeFileSync(outputFile, output, 'utf8');
  return index;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = buildIndexFromFiles();
  console.log(`Video search index updated: ${Object.keys(index.videos).length} enriched videos.`);
}
