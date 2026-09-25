import { youtubeVideoId } from './share-classifier.mjs';

const TYPES = new Set(['general', 'news', 'video', 'resource', 'download', 'update']);

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeHttpUrl(value) {
  const raw = text(value, 2048);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function validYoutubeId(value) {
  const id = text(value, 32);
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}

function validVersion(value) {
  const version = text(value, 64);
  return /^\d+\.\d+\.\d+$/.test(version) ? version : '';
}

export function normalizeNotificationDestination(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { type: 'general' };

  const type = text(value.tiflo_type, 32).toLowerCase();
  if (!TYPES.has(type) || type === 'general') return { type: 'general' };

  if (type === 'update') {
    const version = validVersion(value.tiflo_version);
    return version ? { type, version } : { type: 'general' };
  }

  const url = safeHttpUrl(value.tiflo_url);
  const title = text(value.tiflo_title, 200);
  const rawId = text(value.tiflo_id, 200);

  if (type === 'video') {
    const id = validYoutubeId(rawId) || youtubeVideoId(url);
    return id ? { type, id, url, title } : { type: 'general' };
  }

  if (type === 'news') {
    return (rawId || url)
      ? { type, id: rawId, url, title }
      : { type: 'general' };
  }

  if (type === 'resource') {
    return url ? { type, id: rawId, url, title } : { type: 'general' };
  }

  return url ? { type, url, title } : { type: 'general' };
}
