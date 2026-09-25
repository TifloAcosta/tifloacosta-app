const ONESIGNAL_NOTIFICATIONS_URL = 'https://api.onesignal.com/notifications';

function cleanVersion(value) {
  const version = String(value || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid update version');
  return version;
}

export function buildUpdateNotification({ versionName } = {}) {
  const version = cleanVersion(versionName);
  return {
    target_channel: 'push',
    isAndroid: true,
    filters: [{ field: 'tag', key: 'tiflo_version', relation: '!=', value: version }],
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
      tiflo_version: version
    }
  };
}

export async function sendUpdateNotification({ appId, apiKey, versionName, fetchImpl = fetch } = {}) {
  const cleanAppId = String(appId || '').trim();
  const cleanApiKey = String(apiKey || '').trim();
  if (!cleanAppId) throw new Error('OneSignal app id is required');
  if (!cleanApiKey) throw new Error('OneSignal REST API key is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const payload = { app_id: cleanAppId, ...buildUpdateNotification({ versionName }) };
  const response = await fetchImpl(ONESIGNAL_NOTIFICATIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${cleanApiKey}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  if (!response?.ok) {
    throw new Error(`OneSignal request failed with HTTP ${response?.status ?? 'unknown'}`);
  }
  return response.json();
}
