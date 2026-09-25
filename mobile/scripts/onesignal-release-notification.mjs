const ONESIGNAL_NOTIFICATIONS_URL = 'https://api.onesignal.com/notifications';
const VERSION_RE = /^\d+\.\d+\.\d+$/;

function required(value, name) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) throw new TypeError(`${name} is required`);
  return clean;
}

export function buildUpdateNotification({ appId, versionName } = {}) {
  const id = required(appId, 'appId');
  const version = required(versionName, 'versionName');
  if (!VERSION_RE.test(version)) throw new TypeError('versionName must use x.y.z');

  return {
    app_id: id,
    included_segments: ['Subscribed Users'],
    isAndroid: true,
    headings: {
      es: 'Nueva versión de TifloAcosta',
      en: 'New TifloAcosta version'
    },
    contents: {
      es: `Ya está disponible TifloAcosta ${version}. Abre la app para actualizar.`,
      en: `TifloAcosta ${version} is now available. Open the app to update.`
    },
    data: {
      tiflo_type: 'update',
      tiflo_version: version
    }
  };
}

export async function sendUpdateNotification({ appId, apiKey, versionName, fetchImpl = globalThis.fetch } = {}) {
  const key = required(apiKey, 'apiKey');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const body = buildUpdateNotification({ appId, versionName });
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
