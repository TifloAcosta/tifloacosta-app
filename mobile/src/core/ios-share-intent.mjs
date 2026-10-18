import { youtubeIdFromReceivedText } from './ios-received-inbox.mjs';

const DOCUMENT_EXTENSIONS = new Set([
  'txt','html','htm','md','markdown','rtf','fb2','epub','pdf',
  'docx','pptx','xlsx','odt','daisy','zip'
]);
const AUDIO_EXTENSIONS = new Set(['mp3','m4a','aac','wav','aiff','flac','m4b']);
const IMAGE_EXTENSIONS = new Set(['png','jpg','jpeg','webp']);
const IMMEDIATELY_IMPORTABLE = new Set(['txt','html','htm','md','markdown','rtf','fb2','mp3']);

function extension(filename) {
  return String(filename || '').trim().toLowerCase().split('.').at(-1) || '';
}

export function httpUrlFromReceivedText(text) {
  const candidates = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.replace(/[)\]},;.!?]+$/, ''));
      if (['http:','https:'].includes(url.protocol) && url.hostname &&
          !url.username && !url.password) return url.href;
    } catch { /* Treat malformed text as plain text. */ }
  }
  return '';
}

export function classifyIosReceived(item = {}, fullText = '') {
  const kind = String(item.kind || '').toLowerCase();
  const name = String(item.name || '').trim();
  if (kind === 'file') {
    const ext = extension(name);
    const mime = String(item.contentType || '').toLowerCase();
    const audio = AUDIO_EXTENSIONS.has(ext) || mime.startsWith('audio/');
    const image = IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/');
    const document = DOCUMENT_EXTENSIONS.has(ext) || mime.startsWith('application/') || mime.startsWith('text/');
    return { type: audio ? 'audio' : image ? 'image' : document ? 'document' : 'file',
      canImport: IMMEDIATELY_IMPORTABLE.has(ext), filename: name };
  }
  const text = String(fullText || item.preview || '').trim();
  const videoId = youtubeIdFromReceivedText(text);
  if (videoId) return {
    type: 'youtube', videoId, url: `https://www.youtube.com/watch?v=${videoId}`,
    title: name && !/^(enlace|link|contenido|texto)$/i.test(name) ? name : ''
  };
  const url = httpUrlFromReceivedText(text);
  if (url) return { type: 'web', url };
  return { type: 'text', text };
}

export function freshestUnseenReceipt(items, {
  now = Date.now(), lastSeenId = '', maxAgeMs = 5 * 60 * 1000
} = {}) {
  const eligible = (Array.isArray(items) ? items : [])
    .filter(item => item?.id && item.id !== lastSeenId &&
      Number.isFinite(Date.parse(item.createdAt)) &&
      Date.parse(item.createdAt) <= now &&
      now - Date.parse(item.createdAt) <= maxAgeMs)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return eligible[0] || null;
}
