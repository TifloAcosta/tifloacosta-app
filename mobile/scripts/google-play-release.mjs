import { createSign } from 'node:crypto';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function safeCode(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function chooseNextVersionCode({ playCodes = [], localCode = 0 } = {}) {
  const codes = [...playCodes, localCode]
    .map(safeCode)
    .filter(value => value !== null);
  return Math.max(0, ...codes) + 1;
}

export async function createGoogleAccessToken(serviceAccount, fetchImpl = fetch, nowSeconds = Math.floor(Date.now() / 1000)) {
  const clientEmail = String(serviceAccount?.client_email || '').trim();
  const privateKey = String(serviceAccount?.private_key || '').trim();
  if (!clientEmail || !privateKey) throw new Error('Google Play service account is incomplete');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: clientEmail,
    scope: ANDROID_PUBLISHER_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  }).toString();
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response?.ok) throw new Error(`Google OAuth request failed with HTTP ${response?.status ?? 'unknown'}`);
  const data = await response.json();
  const accessToken = String(data?.access_token || '').trim();
  if (!accessToken) throw new Error('Google OAuth response did not contain an access token');
  return accessToken;
}

export function createPlayReleaseClient({ packageName, accessToken, fetchImpl = fetch } = {}) {
  const cleanPackage = String(packageName || '').trim();
  const cleanToken = String(accessToken || '').trim();
  if (!cleanPackage) throw new Error('Google Play package name is required');
  if (!cleanToken) throw new Error('Google Play access token is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const encodedPackage = encodeURIComponent(cleanPackage);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackage}/edits`;
  const uploadBase = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${encodedPackage}/edits`;

  async function request(url, { method = 'GET', body, contentType } = {}) {
    const headers = { Authorization: `Bearer ${cleanToken}` };
    if (contentType) headers['Content-Type'] = contentType;
    const response = await fetchImpl(url, { method, headers, ...(body === undefined ? {} : { body }) });
    if (!response?.ok) {
      throw new Error(`Google Play request failed with HTTP ${response?.status ?? 'unknown'}`);
    }
    if (response.status === 204) return {};
    return response.json();
  }

  function jsonRequest(url, method, value) {
    return request(url, {
      method,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(value)
    });
  }

  return {
    createEdit() {
      return jsonRequest(base, 'POST', {});
    },
    listTracks(editId) {
      return request(`${base}/${encodeURIComponent(editId)}/tracks`);
    },
    listBundles(editId) {
      return request(`${base}/${encodeURIComponent(editId)}/bundles`);
    },
    uploadBundle(editId, aabBytes) {
      return request(`${uploadBase}/${encodeURIComponent(editId)}/bundles?uploadType=media`, {
        method: 'POST',
        contentType: 'application/octet-stream',
        body: aabBytes
      });
    },
    updateTrack(editId, { track, versionName, versionCode, status, priority, notes }) {
      return jsonRequest(`${base}/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(track)}`, 'PUT', {
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
      });
    },
    validateEdit(editId) {
      return jsonRequest(`${base}/${encodeURIComponent(editId)}:validate`, 'POST', {});
    },
    commitEdit(editId) {
      return jsonRequest(`${base}/${encodeURIComponent(editId)}:commit`, 'POST', {});
    }
  };
}
