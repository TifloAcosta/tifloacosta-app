const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function base64url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64url(value) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid base64url');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  return base64ToBytes(padded);
}

export function randomToken(bytes = 32) {
  if (!Number.isInteger(bytes) || bytes < 1) throw new TypeError('bytes must be a positive integer');
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(data);
}

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(verifier || '')));
  return base64url(new Uint8Array(digest));
}

async function aesKey(secret) {
  if (typeof secret !== 'string' || !secret) throw new Error('session secret is required');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function seal(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(secret);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  return `${base64url(iv)}.${base64url(ciphertext)}`;
}

export async function unseal(token, secret) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) throw new Error('invalid sealed value');
    const iv = fromBase64url(parts[0]);
    const ciphertext = fromBase64url(parts[1]);
    if (iv.length !== 12) throw new Error('invalid iv');
    const key = await aesKey(secret);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(decoder.decode(plaintext));
  } catch (cause) {
    const error = new Error('SEALED_VALUE_INVALID');
    error.code = 'SEALED_VALUE_INVALID';
    error.cause = cause;
    throw error;
  }
}
