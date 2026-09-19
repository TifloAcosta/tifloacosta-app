import { safeRedirectTarget, validatePublicUrl } from './security.js';
import { dedupeCandidates, detectProvider, fileTypeFrom, isLikelyDownloadLink, nameFromHeaders } from './providers.js';
import { searchFreesound } from './sounds.js';

const ALLOWED_ORIGINS = new Set(['https://tifloacosta.com', 'https://tifloacosta.github.io', 'https://localhost']);
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_CANDIDATES = 200;
const MAX_SIZE_PROBES = 20;
const MAX_SIZE_PROBE_REDIRECTS = 1;

function corsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(payload, status = 200, origin = '') {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders(origin) });
}

function errorPayload(code, message) {
  return { status: 'error', code, message };
}

function isHtmlContentType(contentType) {
  const type = String(contentType || '').toLowerCase();
  return type.includes('text/html') || type.includes('application/xhtml+xml');
}

function numericSize(value) {
  if (value === null || value === undefined || value === '') return null;
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

async function readTextLimited(response, limit) {
  const announced = Number(response.headers.get('content-length'));
  if (Number.isFinite(announced) && announced > limit) {
    response.body?.cancel();
    throw Object.assign(new Error('HTML is too large'), { code: 'unsupported' });
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw Object.assign(new Error('HTML is too large'), { code: 'unsupported' });
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function fetchPublicUrl(initialUrl, signal, options = {}) {
  const method = options.method || 'GET';
  const maxRedirects = Number.isInteger(options.maxRedirects) ? options.maxRedirects : MAX_REDIRECTS;
  let current = initialUrl instanceof URL ? initialUrl : new URL(initialUrl);
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(current.href, {
      method,
      redirect: 'manual',
      signal,
      headers: {
        'Accept': '*/*',
        'User-Agent': 'TifloAcosta-Download-Analyzer/1.0'
      }
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount === maxRedirects) {
        response.body?.cancel();
        throw Object.assign(new Error('Too many redirects'), { code: 'unreachable' });
      }
      const location = response.headers.get('location');
      response.body?.cancel();
      if (!location) throw Object.assign(new Error('Redirect without location'), { code: 'unreachable' });
      const next = new URL(location, current);
      const checked = safeRedirectTarget(next);
      if (!checked.ok) throw Object.assign(new Error('Blocked redirect'), { code: 'unreachable' });
      current = checked.url;
      continue;
    }

    return { response, finalUrl: current };
  }
  throw Object.assign(new Error('Too many redirects'), { code: 'unreachable' });
}

async function extractCandidates(html, baseUrl) {
  const candidates = [];
  const handler = {
    element(element) {
      if (candidates.length >= MAX_CANDIDATES) return;
      const href = element.getAttribute('href');
      if (!href) return;
      let url;
      try { url = new URL(href, baseUrl); }
      catch (error) { return; }
      const checked = validatePublicUrl(url);
      if (!checked.ok) return;
      const download = element.getAttribute('download');
      const provider = detectProvider(checked.url);
      if (!isLikelyDownloadLink(checked.url, { download }) && provider === 'web') return;
      let name = download || checked.url.pathname.split('/').filter(Boolean).pop() || 'archivo';
      try { name = decodeURIComponent(name); }
      catch (error) { /* keep undecoded */ }
      candidates.push({
        name,
        url: checked.url.href,
        type: fileTypeFrom(name, ''),
        size: null,
        source: provider
      });
    }
  };

  const rewritten = new HTMLRewriter().on('a[href]', handler).transform(
    new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  );
  await rewritten.text();
  return dedupeCandidates(candidates).slice(0, MAX_CANDIDATES);
}

async function probeCandidateSize(item, signal) {
  try {
    const { response } = await fetchPublicUrl(item.url, signal, {
      method: 'HEAD',
      maxRedirects: MAX_SIZE_PROBE_REDIRECTS
    });
    if (!response.ok) {
      response.body?.cancel();
      return null;
    }
    const size = numericSize(response.headers.get('content-length'));
    response.body?.cancel();
    return size;
  } catch (error) {
    return null;
  }
}

async function enrichCandidateSizes(items, signal) {
  const enriched = items.map(item => ({ ...item }));
  const probeCount = Math.min(enriched.length, MAX_SIZE_PROBES);
  const sizes = await Promise.all(
    enriched.slice(0, probeCount).map(item => probeCandidateSize(item, signal))
  );
  sizes.forEach((size, index) => {
    if (size !== null) enriched[index].size = size;
  });
  return enriched;
}

async function analyze(target) {
  const checked = validatePublicUrl(target);
  if (!checked.ok) return errorPayload('invalid_url', 'The supplied URL is not allowed.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const { response, finalUrl } = await fetchPublicUrl(checked.url, controller.signal);
    if (response.status === 401) {
      response.body?.cancel();
      return errorPayload('authentication_required', 'The resource requires authentication.');
    }
    if (response.status === 403) {
      response.body?.cancel();
      return errorPayload('access_denied', 'The page refused automated analysis or requires additional permission.');
    }
    if (!response.ok) {
      response.body?.cancel();
      return errorPayload('unreachable', `The remote server returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    const contentDisposition = response.headers.get('content-disposition') || '';
    const provider = detectProvider(finalUrl);
    const directByHeader = /attachment/i.test(contentDisposition) || (contentType && !isHtmlContentType(contentType));
    const directByUrl = isLikelyDownloadLink(finalUrl, { download: null });

    if (directByHeader || directByUrl) {
      const name = nameFromHeaders(finalUrl, response.headers);
      const item = {
        name,
        url: finalUrl.href,
        type: fileTypeFrom(name, contentType),
        size: numericSize(response.headers.get('content-length')),
        source: provider === 'web' ? 'direct' : provider
      };
      response.body?.cancel();
      return { status: 'ok', provider: item.source, items: [item] };
    }

    if (!isHtmlContentType(contentType)) {
      response.body?.cancel();
      return errorPayload('unsupported', 'The remote response is not an analyzable HTML page.');
    }

    const html = await readTextLimited(response, MAX_HTML_BYTES);
    const candidates = await extractCandidates(html, finalUrl);
    if (!candidates.length) return errorPayload('no_files', 'No downloadable files were found.');
    const items = await enrichCandidateSizes(candidates, controller.signal);
    return { status: 'ok', provider, items };
  } catch (error) {
    if (error?.name === 'AbortError') return errorPayload('timeout', 'The request timed out.');
    return errorPayload(error?.code || 'unreachable', 'The resource could not be analyzed.');
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('origin') || '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(errorPayload('forbidden_origin', 'Origin not allowed.'), 403, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') return json(errorPayload('method_not_allowed', 'Use POST.'), 405, origin);

    const pathname = new URL(request.url).pathname;
    if (pathname !== '/analyze' && pathname !== '/sounds/search') {
      return json(errorPayload('not_found', 'Unknown endpoint.'), 404, origin);
    }

    let body;
    try { body = await request.json(); }
    catch (error) {
      const code = pathname === '/sounds/search' ? 'invalid_search' : 'invalid_url';
      return json(errorPayload(code, 'Invalid JSON body.'), 400, origin);
    }

    if (pathname === '/sounds/search') {
      const result = await searchFreesound(body, env);
      return json(result, result.status === 'ok' ? 200 : 422, origin);
    }

    if (!body || typeof body.url !== 'string') return json(errorPayload('invalid_url', 'Missing URL.'), 400, origin);
    const result = await analyze(body.url);
    return json(result, result.status === 'ok' ? 200 : 422, origin);
  }
};
