import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runAutomaticEditorial } from './actualidad-auto-adapt.mjs';
import { mergeEditorial } from './actualidad-editorial.mjs';
import { normalizeFeedEntry, parseCtiNewsHtml, parseFeedXml } from './actualidad-feed.mjs';
import { createActualidadAIClient } from './openai-actualidad-client.mjs';

const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');
const STORY_RETENTION_DAYS = 90;
const STORY_RETENTION_MS = STORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const SOURCE_FETCH_ATTEMPTS = 3;

function sourceKey(source) {
  return String(source?.id || '');
}

function retentionCutoff(now) {
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(timestamp)) throw new Error('Invalid Actualidad reference date');
  return timestamp - STORY_RETENTION_MS;
}

function sourceEntries(text, source) {
  if (source?.format === 'cti-html') return parseCtiNewsHtml(text, source);
  return parseFeedXml(text, source);
}

function searchableKeywordText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function configuredKeywords(source, field) {
  return Array.isArray(source?.[field])
    ? source[field].map(searchableKeywordText).filter(Boolean)
    : [];
}

function includesKeyword(haystack, keyword) {
  return ` ${haystack} `.includes(` ${keyword} `);
}

function matchesSourceKeywords(item, source) {
  const includeKeywords = configuredKeywords(source, 'includeKeywords');
  const excludeKeywords = configuredKeywords(source, 'excludeKeywords');
  const haystack = searchableKeywordText(`${item?.title || ''} ${item?.summary || ''}`);

  if (excludeKeywords.some(keyword => includesKeyword(haystack, keyword))) return false;
  if (!includeKeywords.length) return true;
  return includeKeywords.some(keyword => includesKeyword(haystack, keyword));
}

function limitSourceItems(items, source) {
  const maxItems = Number.isInteger(source?.maxItems) && source.maxItems > 0 ? source.maxItems : null;
  const sorted = [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return maxItems ? sorted.slice(0, maxItems) : sorted;
}

async function fetchSourceOnce(source, fetchFn) {
  const response = await fetchFn(source.feedUrl, {
    headers: {
      'accept': source?.format === 'cti-html'
        ? 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5'
        : 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      'user-agent': 'TifloAcosta-Actualidad/1.0 (+https://tifloacosta.com/)'
    }
  });
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'} for ${source.id}`);
  const text = await response.text();
  const normalized = sourceEntries(text, source)
    .map(entry => normalizeFeedEntry(entry, source))
    .filter(Boolean)
    .filter(item => matchesSourceKeywords(item, source));
  return limitSourceItems(normalized, source);
}

async function fetchSource(source, fetchFn) {
  let lastError;
  for (let attempt = 1; attempt <= SOURCE_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchSourceOnce(source, fetchFn);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unable to fetch ${source.id}`);
}

export async function syncActualidad({ sources, editorial, fetchFn = fetch, now = new Date(), automaticEditorial = null }) {
  const enabled = (Array.isArray(sources) ? sources : [])
    .filter(source => source?.enabled !== false && source?.id && source?.feedUrl)
    .sort((a, b) => sourceKey(a).localeCompare(sourceKey(b)));

  if (enabled.length === 0) throw new Error('No enabled Actualidad sources');

  const failedSources = [];
  const candidates = [];

  for (const source of enabled) {
    try {
      candidates.push(...await fetchSource(source, fetchFn));
    } catch (error) {
      failedSources.push(source.id);
    }
  }

  if (failedSources.length === enabled.length) {
    throw new Error('All enabled Actualidad sources failed');
  }

  const uniqueByUrl = new Map();
  for (const story of candidates) {
    if (!uniqueByUrl.has(story.originalUrl)) uniqueByUrl.set(story.originalUrl, story);
  }

  const sourceStories = [...uniqueByUrl.values()];
  let effectiveEditorial = Array.isArray(editorial) ? editorial : [];
  let automaticResult = null;
  let automaticError = '';

  if (typeof automaticEditorial === 'function') {
    try {
      automaticResult = await automaticEditorial(sourceStories);
      if (Array.isArray(automaticResult?.editorial)) effectiveEditorial = automaticResult.editorial;
    } catch (error) {
      automaticError = String(error?.message || error);
    }
  }

  const cutoff = retentionCutoff(now);
  const merged = mergeEditorial(sourceStories, effectiveEditorial);
  const stories = core.sortStories(
    merged
      .map(item => core.normalizeContent(item))
      .filter(item => item && item.editorialState !== 'withheld')
      .filter(item => new Date(item.publishedAt).getTime() >= cutoff)
  );

  return { stories, failedSources, editorial: effectiveEditorial, automaticResult, automaticError };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJsonIfChanged(path, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  let previous = '';
  try { previous = await readFile(path, 'utf8'); } catch (error) { /* first generation */ }
  if (previous !== next) await writeFile(path, next, 'utf8');
  return previous !== next;
}

async function main() {
  const root = new URL('../', import.meta.url);
  const now = new Date();
  const [sources, editorial, state, config, guidelines] = await Promise.all([
    readJson(new URL('actualidad-sources.json', root)),
    readJson(new URL('actualidad-editorial.json', root)),
    readJson(new URL('actualidad-auto-state.json', root)),
    readJson(new URL('actualidad-auto-config.json', root)),
    readFile(new URL('docs/actualidad-editorial-guidelines.md', root), 'utf8')
  ]);

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const aiClient = apiKey ? createActualidadAIClient({ apiKey, model: config.model }) : null;
  const automaticEditorial = aiClient
    ? sourceStories => runAutomaticEditorial({ stories: sourceStories, sources, editorial, state, aiClient, config, guidelines, now })
    : null;

  const result = await syncActualidad({ sources, editorial, fetchFn: fetch, now, automaticEditorial });
  const outputChanged = await writeJsonIfChanged(new URL('actualidad.json', root), result.stories);
  let editorialChanged = false;
  let stateChanged = false;

  if (result.automaticResult) {
    editorialChanged = await writeJsonIfChanged(new URL('actualidad-editorial.json', root), result.automaticResult.editorial);
    stateChanged = await writeJsonIfChanged(new URL('actualidad-auto-state.json', root), result.automaticResult.state);
  }

  if (!apiKey) console.log('Actualidad automatic adaptation: skipped (OPENAI_API_KEY not configured).');
  if (result.automaticError) console.warn(`Actualidad automatic adaptation unavailable: ${result.automaticError}`);
  if (result.failedSources.length) console.warn(`Actualidad sources unavailable: ${result.failedSources.join(', ')}`);
  if (result.automaticResult?.stats) console.log(`Actualidad automatic editorial: ${JSON.stringify(result.automaticResult.stats)}`);
  console.log(`Actualidad stories: ${result.stories.length}. Changed: ${outputChanged || editorialChanged || stateChanged ? 'yes' : 'no'}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
