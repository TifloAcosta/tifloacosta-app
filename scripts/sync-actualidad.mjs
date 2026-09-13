import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mergeEditorial } from './actualidad-editorial.mjs';
import { normalizeFeedEntry, parseFeedXml } from './actualidad-feed.mjs';

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

async function fetchSourceOnce(source, fetchFn) {
  const response = await fetchFn(source.feedUrl, {
    headers: {
      'accept': 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      'user-agent': 'TifloAcosta-Actualidad/1.0 (+https://tifloacosta.com/)'
    }
  });
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'} for ${source.id}`);
  const xml = await response.text();
  return parseFeedXml(xml, source)
    .map(entry => normalizeFeedEntry(entry, source))
    .filter(Boolean);
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

export async function syncActualidad({ sources, editorial, fetchFn = fetch, now = new Date() }) {
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

  const cutoff = retentionCutoff(now);
  const merged = mergeEditorial([...uniqueByUrl.values()], editorial);
  const stories = core.sortStories(
    merged
      .map(story => core.normalizeStory(story))
      .filter(story => story && story.editorialState !== 'withheld')
      .filter(story => new Date(story.publishedAt).getTime() >= cutoff)
  );

  return { stories, failedSources };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const root = new URL('../', import.meta.url);
  const [sources, editorial] = await Promise.all([
    readJson(new URL('actualidad-sources.json', root)),
    readJson(new URL('actualidad-editorial.json', root))
  ]);

  const { stories, failedSources } = await syncActualidad({ sources, editorial, fetchFn: fetch });
  const outputUrl = new URL('actualidad.json', root);
  const next = `${JSON.stringify(stories, null, 2)}\n`;
  let previous = '';
  try { previous = await readFile(outputUrl, 'utf8'); } catch (error) { /* first generation */ }

  if (previous !== next) await writeFile(outputUrl, next, 'utf8');
  if (failedSources.length) console.warn(`Actualidad sources unavailable: ${failedSources.join(', ')}`);
  console.log(`Actualidad stories: ${stories.length}. Changed: ${previous !== next ? 'yes' : 'no'}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
