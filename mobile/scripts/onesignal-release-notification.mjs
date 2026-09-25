function cleanVersion(value) {
  const version = String(value || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid Android version for update notification');
  return version;
}

export function buildUpdateNotification({ versionName } = {}) {
  const version = cleanVersion(versionName);
  return {
    isAndroid: true,
    headings: {
      es: 'Nueva versión de TifloAcosta',
      en: 'New TifloAcosta version'
    },
    contents: {
      es: `La versión ${version} ya está disponible. Abre TifloAcosta para actualizar.`,
      en: `Version ${version} is now available. Open TifloAcosta to update.`
    },
    data: {
      tiflo_type: 'update',
      tiflo_version: version
    }
  };
}

export async function sendUpdateNotification({ appId, apiKey, versionName, fetchImpl = fetch } = {}) {
  const id = String(appId || '').trim();
  const key = String(apiKey || '').trim();
  if (!id || !key) throw new Error('OneSignal update notification credentials are incomplete');

  const payload = {
    app_id: id,
    included_segments: ['Subscribed Users'],
    ...buildUpdateNotification({ versionName })
  };

  const response = await fetchImpl('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OneSignal notification request failed with HTTP ${response.status}`);
  }
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { text }; }
}
