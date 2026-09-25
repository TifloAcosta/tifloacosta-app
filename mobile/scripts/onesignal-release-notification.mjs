const ONESIGNAL_NOTIFICATIONS_URL = 'https://api.onesignal.com/notifications';
const VERSION_RE = /^\d+\.\d+\.\d+$/;

function required(value, name) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) throw new TypeError(`${name} is required`);
  return clean;
}

export function buildUpdateNotification({ appId, versionName, versionCode } = {}) {
  const id = required(appId, 'appId');
  const version = required(versionName, 'versionName');
  const code = Number(versionCode);
  if (!VERSION_RE.test(version)) throw new TypeError('versionName must use x.y.z');
  if (!Number.isInteger(code) || code < 1) throw new TypeError('versionCode must be a positive integer');

  return {
    app_id: id,
    target_channel: 'push',
    filters: [
      { field: 'tag', key: 'tiflo_client', relation: '=', value: 'android_app' }
    ],
    headings: {
      es: 'Nueva versión de TifloAcosta',
      en: 'New version of TifloAcosta'
    },
    contents: {
      es: `Ya está disponible TifloAcosta ${version}. Abre la app para actualizar.`,
      en: `TifloAcosta ${version} is now available. Open the app to update.`
    },
    data: {
      tiflo_type: 'update',
      tiflo_version: version,
      tiflo_version_code: code
    }
  };
}

export async function sendUpdateNotification({ appId, apiKey, versionName, versionCode, fetchImpl = globalThis.fetch } = {}) {
  const key = required(apiKey, 'apiKey');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const body = buildUpdateNotification({ appId, versionName, versionCode });
  const response = await fetchImpl(ONESIGNAL_NOTIFICATIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`OneSignal update notification failed with HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
