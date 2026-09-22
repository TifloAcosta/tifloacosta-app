import { registerPlugin } from '@capacitor/core';

const NativeTifloWebFetch = registerPlugin('TifloWebFetch');
const ERROR_CODES = new Set([
  'invalid_url',
  'too_many_redirects',
  'timeout',
  'too_large',
  'unsupported_type',
  'http_error',
  'unreachable'
]);

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function codedError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

export function createWebFetchPlugin(plugin = NativeTifloWebFetch) {
  async function fetchPage({ url } = {}) {
    const normalized = validHttpUrl(url);
    if (!normalized) throw codedError('invalid_url');
    if (!plugin?.fetchPage) throw codedError('unreachable');
    try {
      const result = await plugin.fetchPage({ url: normalized });
      if (!result || result.ok !== true) throw codedError('unreachable');
      return {
        ok: true,
        finalUrl: String(result.finalUrl || normalized),
        status: Number(result.status || 0),
        contentType: String(result.contentType || ''),
        body: String(result.body || '')
      };
    } catch (error) {
      const code = ERROR_CODES.has(error?.code) ? error.code : 'unreachable';
      throw codedError(code, error?.message || code);
    }
  }

  return { fetchPage };
}

export const TifloWebFetch = createWebFetchPlugin();

export async function fetchSharedPage(url, plugin = TifloWebFetch) {
  return plugin.fetchPage({ url });
}
