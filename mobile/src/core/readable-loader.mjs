import { classifySharedUrl } from './share-classifier.mjs';
import { extractReadablePage } from './readable-page.mjs';

function fetchPage(webFetch, url) {
  if (typeof webFetch === 'function') return webFetch(url);
  if (webFetch?.fetchPage) return webFetch.fetchPage({ url });
  throw Object.assign(new Error('Native page fetch is unavailable'), { code: 'unreachable' });
}

export function readablePageFromNewsItem(item = {}) {
  const body = String(item?.body || '').trim();
  if (!body) return null;

  const url = String(item?.originalUrl || item?.url || '').trim();
  const page = extractReadablePage({
    html: body,
    url,
    contentType: 'text/plain'
  });

  return {
    ...page,
    title: String(item?.title || page.title || '').trim(),
    source: String(item?.sourceName || page.source || '').trim(),
    reliable: true
  };
}

export async function loadReadableTarget({ url = '', resolveDownload, webFetch } = {}) {
  const first = classifySharedUrl(url, { resolveDownload });
  if (first.kind !== 'web') return { kind: first.kind, classification: first };

  const payload = await fetchPage(webFetch, first.url);
  const finalUrl = String(payload?.finalUrl || first.url);
  const finalClassification = classifySharedUrl(finalUrl, { resolveDownload });
  if (finalClassification.kind !== 'web') {
    return { kind: finalClassification.kind, classification: finalClassification, payload };
  }

  const page = extractReadablePage({
    html: String(payload?.body || ''),
    url: finalClassification.url,
    contentType: String(payload?.contentType || '')
  });

  return {
    kind: page.reliable ? 'readable' : 'unreliable',
    classification: finalClassification,
    payload,
    page
  };
}
