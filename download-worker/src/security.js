function stripIpv6Brackets(hostname) {
  return String(hostname || '').replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

function parseIpv4(hostname) {
  const parts = String(hostname || '').split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part))) return null;
  const nums = parts.map(Number);
  if (nums.some(value => value < 0 || value > 255)) return null;
  return nums;
}

function isPrivateIpv4(parts) {
  if (!parts) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 || (a === 100 && b === 100);
}

function isPrivateIpv6(hostname) {
  const host = stripIpv6Brackets(hostname);
  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1') return true;
  const first = host.split(':')[0];
  return /^f[cd][0-9a-f]{2}$/i.test(first) || /^fe[89ab][0-9a-f]?$/i.test(first);
}

function blockedHostname(hostname) {
  const host = stripIpv6Brackets(hostname).replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === 'metadata.google.internal' || host === 'metadata.google.internal.') return true;
  if (host === '100.100.100.200') return true;
  return isPrivateIpv4(parseIpv4(host)) || isPrivateIpv6(host);
}

export function validatePublicUrl(value) {
  try {
    const url = value instanceof URL ? new URL(value.href) : new URL(String(value || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, code: 'invalid_url' };
    if (url.username || url.password) return { ok: false, code: 'invalid_url' };
    if (blockedHostname(url.hostname)) return { ok: false, code: 'blocked_destination' };
    return { ok: true, url };
  } catch (error) {
    return { ok: false, code: 'invalid_url' };
  }
}

export function safeRedirectTarget(value) {
  return validatePublicUrl(value);
}
