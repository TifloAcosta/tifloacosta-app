import { sign } from 'node:crypto';

const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const UPLOAD_ROOT = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function requiredText(value, name) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) throw new TypeError(`${name} is required`);
  return clean;
}

async function jsonOrEmpty(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function apiError(label, response) {
  return new Error(`${label} failed with HTTP ${response.status}`);
}

export function chooseNextVersionCode({ playCodes = [], localCode = 0 } = {}) {
  const normalized = [Number(localCode), ...playCodes.map(Number)]
    .filter(value => Number.isInteger(value) && value >= 0);
  return Math.max(0, ...normalized) + 1;
}

export async function createGoogleAccessToken(serviceAccount, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const clientEmail = requiredText(serviceAccount?.client_email, 'service account client_email');
  const privateKey = requiredText(serviceAccount?.private_key, 'service account private_key');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: clientEmail,
    scope: ANDROID_PUBLISHER_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signature = sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw apiError('Google OAuth token request', response);
  const payload = await jsonOrEmpty(response);
  const token = requiredText(payload.access_token, 'Google OAuth access_token');
  return token;
}

export function createPlayReleaseClient({ packageName, accessToken, fetchImpl = globalThis.fetch } = {}) {
  const appId = requiredText(packageName, 'packageName');
  const token = requiredText(accessToken, 'accessToken');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const encodedPackage = encodeURIComponent(appId);
  const editsRoot = `${API_ROOT}/${encodedPackage}/edits`;
  const uploadEditsRoot = `${UPLOAD_ROOT}/${encodedPackage}/edits`;

  async function request(url, { method = 'GET', body, headers = {} } = {}) {
    const requestHeaders = { Authorization: `Bearer ${token}`, ...headers };
    const options = { method, headers: requestHeaders };
    if (body !== undefined) options.body = body;
    const response = await fetchImpl(url, options);
    if (!response.ok) throw apiError('Google Play request', response);
    return jsonOrEmpty(response);
  }

  return {
    createEdit() {
      return request(editsRoot, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
    },

    async listBundles(editId) {
      const id = encodeURIComponent(requiredText(editId, 'editId'));
      const payload = await request(`${editsRoot}/${id}/bundles`);
      return Array.isArray(payload.bundles) ? payload.bundles : [];
    },

    async listTracks(editId) {
      const id = encodeURIComponent(requiredText(editId, 'editId'));
      const payload = await request(`${editsRoot}/${id}/tracks`);
      return Array.isArray(payload.tracks) ? payload.tracks : [];
    },

    uploadBundle(editId, bundle) {
      const id = encodeURIComponent(requiredText(editId, 'editId'));
      if (bundle === undefined || bundle === null) throw new TypeError('bundle is required');
      return request(`${uploadEditsRoot}/${id}/bundles?uploadType=media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bundle
      });
    },

    updateTrack(editId, release) {
      const id = encodeURIComponent(requiredText(editId, 'editId'));
      const track = encodeURIComponent(requiredText(release?.track, 'track'));
      const versionName = requiredText(release?.versionName, 'versionName');
      const versionCode = Number(release?.versionCode);
      const priority = Number(release?.priority);
      if (!Number.isInteger(versionCode) || versionCode < 1) throw new TypeError('versionCode must be positive');
      if (!Number.isInteger(priority) || priority < 0 || priority > 5) throw new TypeError('priority must be 0..5');

      const payload = {
        releases: [{
          name: versionName,
          status: requiredText(release?.status, 'status'),
          versionCodes: [String(versionCode)],
          inAppUpdatePriority: priority,
          releaseNotes: [
            { language: 'es-ES', text: requiredText(release?.notes?.es, 'Spanish notes') },
            { language: 'en-US', text: requiredText(release?.notes?.en, 'English notes') }
          ]
        }]
      };
      return request(`${editsRoot}/${id}/tracks/${track}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },

    validateEdit(editId) {
      const id = encodeURIComponent(requiredText(editId, 'editId'));
      return request(`${editsRoot}/${id}:validate`, { method: 'POST' });
    },

    commitEdit(editId) {
      const id = encodeURIComponent(requiredText(editId, 'editId'));
      return request(`${editsRoot}/${id}:commit`, { method: 'POST' });
    }
  };
}
