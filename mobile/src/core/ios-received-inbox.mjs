/**
 * App Group inbox for the single iOS mobile screen.
 * The native extension owns original file bytes. Listing, reading and opening
 * never remove them. A receipt can be acknowledged only after verified import.
 */
const MAX_BYTES = 32 * 1024 * 1024;
const CHUNK_BYTES = 524288;

function isReceipt(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function isWebAddress(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.host) &&
      !url.username && !url.password;
  } catch { return false; }
}

export function youtubeIdFromReceivedText(value) {
  const candidates = String(value || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.replace(/[)\]},;.!?]+$/, ''));
      const host = url.hostname.toLowerCase();
      if (!['https:', 'http:'].includes(url.protocol) ||
          !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
            'youtu.be', 'www.youtu.be'].includes(host)) continue;
      const segments = url.pathname.split('/').filter(Boolean);
      const id = host.includes('youtu.be') ? segments[0]
        : segments[0] === 'watch' ? url.searchParams.get('v')
        : ['shorts', 'live', 'embed'].includes(segments[0]) ? segments[1] : null;
      if (/^[a-z0-9_-]{11}$/i.test(id || '')) return id;
    } catch { /* Ignore non-URL text. */ }
  }
  return '';
}

export function createIosReceivedInbox({ native = null, library = null, decodeBase64 = globalThis.atob,
  BlobType = globalThis.Blob } = {}) {
  async function pending() {
    if (!native?.pending) return { items: [], available: false };
    try {
      const response = await native.pending();
      const items = Array.isArray(response?.items) ? response.items : [];
      return { available: true, items: items.filter(item => isReceipt(item?.id)) };
    } catch { return { available: false, items: [] }; }
  }

  async function details(item) {
    if (!isReceipt(item?.id) || !native?.openItem || item.kind === 'file') return null;
    try {
      const opened = await native.openItem({ id: item.id });
      if (opened?.id !== item.id || opened.kind === 'file') return null;
      return { ...item, kind: opened.kind, value: String(opened.value || '') };
    } catch { return null; }
  }

  async function readFile(item) {
    if (!isReceipt(item?.id) || item?.kind !== 'file' || !native?.readItemChunk) {
      throw Error('invalid-received-file');
    }
    const parts = [];
    let offset = 0;
    let total = 0;
    let contentType = '';
    while (true) {
      const reply = await native.readItemChunk({ id: item.id, offset, length: CHUNK_BYTES });
      const size = Number(reply?.size);
      const next = Number(reply?.nextOffset);
      if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES ||
          !Number.isInteger(next) || next <= offset || next > size ||
          (total !== 0 && size !== total) || typeof reply?.data !== 'string') {
        throw Error('invalid-inbox-chunk');
      }
      const raw = decodeBase64(reply.data);
      if (raw.length !== next - offset) throw Error('invalid-inbox-chunk-size');
      const bytes = new Uint8Array(raw.length);
      for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
      parts.push(bytes);
      contentType = String(reply?.contentType || contentType || 'application/octet-stream');
      total = size;
      offset = next;
      if (reply.done === true && offset !== total) throw Error('invalid-inbox-chunk-complete');
      if (offset === total) {
        if (reply.done !== true) throw Error('missing-inbox-final-marker');
        break;
      }
    }
    return new BlobType(parts, { type: contentType });
  }

  async function saveFile(item) {
    if (!library?.importReceivedBlob || !native?.acknowledge) {
      return { saved: false, acknowledged: false, reason: 'bridge-unavailable' };
    }
    try {
      const blob = await readFile(item);
      const saved = await library.importReceivedBlob({ name: item.name, blob });
      if (saved?.saved !== true || !saved.id) {
        return { saved: false, acknowledged: false, reason: saved?.reason || 'import-failed' };
      }
      // This is the only automatic acknowledge path, after IndexedDB readback.
      const acknowledged = await native.acknowledge({ id: item.id });
      return { saved: true, id: saved.id, acknowledged: acknowledged?.acknowledged === true };
    } catch {
      return { saved: false, acknowledged: false, reason: 'read-or-save-failed' };
    }
  }

  async function openLink(item) {
    if (!isReceipt(item?.id) || item?.kind === 'file' || !native?.openItem || !native?.openURL) {
      return { opened: false };
    }
    try {
      const entry = await native.openItem({ id: item.id });
      const value = String(entry?.value || '').trim();
      if (!isWebAddress(value)) return { opened: false };
      const opened = await native.openURL({ url: value });
      // Opening a link is not permission to delete it from Received.
      return { opened: opened?.opened === true };
    } catch { return { opened: false }; }
  }

  async function resolveYouTubeTitle(item) {
    const videoId = youtubeIdFromReceivedText(item?.preview || '');
    if (!videoId || typeof native?.resolveYouTubeTitle !== 'function') return '';
    try {
      const response = await native.resolveYouTubeTitle({ videoId });
      return String(response?.title || '').trim().slice(0, 240);
    } catch { return ''; }
  }

  async function deleteConfirmed(item) {
    if (!isReceipt(item?.id) || !native?.acknowledge) return false;
    try { return (await native.acknowledge({ id: item.id }))?.acknowledged === true; }
    catch { return false; }
  }

  return { pending, details, readFile, saveFile, openLink, resolveYouTubeTitle, deleteConfirmed };
}
