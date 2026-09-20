import { seal, unseal } from './security.js';

export const SESSION_COOKIE = '__Host-tiflo_youtube';
export const OAUTH_COOKIE = '__Host-tiflo_youtube_oauth';

function cookieValue(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const prefix = `${name}=`;
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return '';
}

function cookieAttributes(maxAge) {
  return `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
}

async function createProtectedCookie(name, payload, secret, maxAge) {
  const token = await seal(payload, secret);
  return `${name}=${token}; ${cookieAttributes(maxAge)}`;
}

async function readProtectedCookie(request, name, secret) {
  const token = cookieValue(request, name);
  if (!token) return null;
  try {
    const payload = await unseal(token, secret);
    if (!payload || typeof payload !== 'object') return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionCookie(session, secret) {
  const seconds = Number.isFinite(session?.exp)
    ? Math.min(30 * 24 * 60 * 60, Math.max(0, (session.exp - Date.now()) / 1000))
    : 30 * 24 * 60 * 60;
  return createProtectedCookie(SESSION_COOKIE, session, secret, seconds);
}

export function readSession(request, secret) {
  return readProtectedCookie(request, SESSION_COOKIE, secret);
}

export async function createOauthCookie(data, secret) {
  const seconds = Number.isFinite(data?.exp)
    ? Math.min(10 * 60, Math.max(0, (data.exp - Date.now()) / 1000))
    : 10 * 60;
  return createProtectedCookie(OAUTH_COOKIE, data, secret, seconds);
}

export function readOauthCookie(request, secret) {
  return readProtectedCookie(request, OAUTH_COOKIE, secret);
}

export function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function assertCsrf(request, session) {
  const expected = typeof session?.csrf === 'string' ? session.csrf : '';
  const actual = request.headers.get('X-CSRF-Token') || '';
  if (!expected || !actual || actual !== expected) {
    const error = new Error('CSRF_INVALID');
    error.code = 'CSRF_INVALID';
    throw error;
  }
}
