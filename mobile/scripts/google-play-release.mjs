import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function jsonOrText(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { text }; }
}

function httpError(response, body) {
  const detail = typeof body?.error?.message === 'string'
    ? body.error.message.slice(0, 300)
    : typeof body?.text === 'string' ? body.text.slice(0, 300) : '';
  return new Error(`Google Play API request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
}

export function chooseNextVersionCode({ playCodes = [], localCode = 0 } = {}) {
  const codes = [...playCodes, Number(localCode) || 0]
    .map(Number)
    .filter(value => Number.isInteger(value) && value >= 0);
  return Math.max(0, ...codes) + 1;
}

export async function createGoogleAccessToken(serviceAccount, fetchImpl = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  const clientEmail = String(serviceAccount?.client_email || '').trim();
  const privateKey = String(serviceAccount?.private_key || '').trim();
  if (!clientEmail || !privateKey) throw new Error('Google Play service account is incomplete');

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey).toString('base64url')}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await jsonOrText(response);
  if (!response.ok) throw new Error(`Google OAuth token request failed with HTTP ${response.status}`);
  const token = String(payload?.access_token || '').trim();
  if (!token) throw new Error('Google OAuth token response did not contain access_token');
  return token;
}

export function createPlayReleaseClient({ packageName, accessToken, fetchImpl = fetch } = {}) {
  const pkg = String(packageName || '').trim();
  const token = String(accessToken || '').trim();
  if (!pkg || !token) throw new Error('Google Play client requires packageName and accessToken');

  const appPath = encodeURIComponent(pkg);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${appPath}/edits`;
  const uploadBase = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${appPath}/edits`;

  async function request(url, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body != null && !(body instanceof Uint8Array) && !Buffer.isBuffer(body)
          ? { 'content-type': 'application/json' }
          : {}),
        ...headers
      },
      body: body == null ? undefined : (typeof body === 'string' || body instanceof Uint8Array || Buffer.isBuffer(body)) ? body : JSON.stringify(body)
    });
    const payload = await jsonOrText(response);
    if (!response.ok) throw httpError(response, payload);
    return payload;
  }

  return {
    createEdit: () => request(base, { method: 'POST', body: {} }),
    listTracks: editId => request(`${base}/${encodeURIComponent(editId)}/tracks`),
    listBundles: editId => request(`${base}/${encodeURIComponent(editId)}/bundles`),
    uploadBundle: async (editId, aabPath) => {
      const bytes = await readFile(aabPath);
      return request(`${uploadBase}/${encodeURIComponent(editId)}/bundles?uploadType=media`, {
        method: 'POST',
        body: bytes,
        headers: { 'content-type': 'application/octet-stream' }
      });
    },
    updateTrack: (editId, track, { versionName, versionCode, status, priority, notes }) => request(
      `${base}/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(track)}`,
      {
        method: 'PUT',
        body: {
          track,
          releases: [{
            name: versionName,
            status,
            versionCodes: [String(versionCode)],
            inAppUpdatePriority: priority,
            releaseNotes: [
              { language: 'es-ES', text: notes.es },
              { language: 'en-US', text: notes.en }
            ]
          }]
        }
      }
    ),
    validateEdit: editId => request(`${base}/${encodeURIComponent(editId)}:validate`, { method: 'POST', body: {} }),
    commitEdit: editId => request(`${base}/${encodeURIComponent(editId)}:commit`, { method: 'POST', body: {} })
  };
}

export function collectVersionCodes({ tracks = [], bundles = [] } = {}) {
  const values = [];
  for (const bundle of bundles) values.push(Number(bundle?.versionCode));
  for (const track of tracks) {
    for (const release of track?.releases || []) {
      for (const code of release?.versionCodes || []) values.push(Number(code));
    }
  }
  return [...new Set(values.filter(value => Number.isInteger(value) && value > 0))];
}
