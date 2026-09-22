const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be'
]);

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function trimTerminalPunctuation(value) {
  let text = String(value || '').trim();
  while (text && /[.,;:!?]/.test(text.at(-1))) text = text.slice(0, -1);

  const pairs = [['(', ')'], ['[', ']'], ['{', '}']];
  let changed = true;
  while (changed && text) {
    changed = false;
    const last = text.at(-1);
    for (const [open, close] of pairs) {
      if (last !== close) continue;
      const opens = [...text].filter(char => char === open).length;
      const closes = [...text].filter(char => char === close).length;
      if (closes > opens) {
        text = text.slice(0, -1);
        changed = true;
      }
    }
  }
  return text;
}

export function extractHttpUrls(text = '') {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  const seen = new Set();
  const urls = [];
  for (const token of matches) {
    const normalized = normalizeHttpUrl(trimTerminalPunctuation(token));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

function validVideoId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}

export function youtubeVideoId(value = '') {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return '';
  const url = new URL(normalized);
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return '';

  if (host === 'youtu.be') {
    return validVideoId(url.pathname.split('/').filter(Boolean)[0]);
  }

  const queryId = validVideoId(url.searchParams.get('v'));
  if (queryId) return queryId;

  const parts = url.pathname.split('/').filter(Boolean);
  if (['shorts', 'embed', 'live'].includes(parts[0])) return validVideoId(parts[1]);
  return '';
}

export function classifySharedUrl(value, { resolveDownload = () => ({ provider: 'web' }) } = {}) {
  const url = normalizeHttpUrl(value);
  if (!url) return { kind: 'invalid', url: '' };

  const videoId = youtubeVideoId(url);
  if (videoId) return { kind: 'youtube', url, videoId };

  const local = resolveDownload(url);
  if (local?.provider && !['web', 'invalid'].includes(local.provider)) {
    return { kind: 'download', url };
  }
  if (local?.kind === 'result' && Array.isArray(local.items) && local.items.length) {
    return { kind: 'download', url };
  }
  return { kind: 'web', url };
}

export function classifySharedText(value, options = {}) {
  const text = String(value || '').trim();
  const urls = extractHttpUrls(text);
  if (!urls.length) return { kind: 'text', text, urls: [] };
  if (urls.length > 1) return { kind: 'multi-url', text, urls };
  return {
    kind: 'single-url',
    text,
    urls,
    classification: classifySharedUrl(urls[0], options)
  };
}
