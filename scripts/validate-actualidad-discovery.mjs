import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseBuscaAppsHtml } from './actualidad-feed.mjs';

const FETCH_ATTEMPTS = 3;

async function readJson(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function fetchText(source, fetchFn) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchFn(source.url, {
        headers: {
          'accept': 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5',
          'user-agent': 'TifloAcosta-Actualidad/1.0 (+https://tifloacosta.com/)'
        }
      });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Unable to fetch discovery source');
}

export function parseDiscoverySource(text, source) {
  if (source?.format === 'buscaapps-html') return parseBuscaAppsHtml(text, source);
  throw new Error(`Unsupported discovery source format: ${source?.format || 'missing'}`);
}

export async function validateDiscoverySources({ sources, fetchFn = fetch }) {
  const enabled = (Array.isArray(sources) ? sources : []).filter(source => source?.enabled !== false);
  if (enabled.length === 0) throw new Error('No enabled Actualidad discovery sources');

  const results = [];
  for (const source of enabled) {
    if (!source?.id || !source?.url || !source?.format) {
      throw new Error('Invalid Actualidad discovery source configuration');
    }

    let text;
    try {
      text = await fetchText(source, fetchFn);
    } catch (error) {
      throw new Error(`Discovery source ${source.id} unavailable: ${error?.message || error}`);
    }

    const items = parseDiscoverySource(text, source);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`Discovery source ${source.id} returned no parseable items`);
    }

    results.push({ id: source.id, count: items.length, items });
  }

  return results;
}

async function main() {
  const root = new URL('../', import.meta.url);
  const sources = await readJson(new URL('actualidad-discovery-sources.json', root));
  const results = await validateDiscoverySources({ sources, fetchFn: fetch });
  for (const result of results) console.log(`Discovery source ${result.id}: ${result.count} items.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
