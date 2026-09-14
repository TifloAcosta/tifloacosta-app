const APP_ID = 'ed030723-7f6f-4745-8cd3-6938a9d04377';
const APP_BASE_URL = 'https://tifloacosta.com';

function validVideos(catalog) {
  return Array.isArray(catalog?.videos)
    ? catalog.videos.filter(video => /^[A-Za-z0-9_-]{11}$/.test(String(video?.id || '')))
    : [];
}

export function findNewVideos(previousCatalog, currentCatalog) {
  const previous = validVideos(previousCatalog);
  const current = validVideos(currentCatalog);
  if (!previous.length || !current.length) return [];
  const known = new Set(previous.map(video => String(video.id)));
  return current.filter(video => !known.has(String(video.id)));
}

export function buildPushPayload(newVideos) {
  const videos = Array.isArray(newVideos) ? newVideos.filter(Boolean) : [];
  if (!videos.length) return null;

  if (videos.length === 1) {
    const video = videos[0];
    const title = String(video.title || 'TifloAcosta').trim();
    return {
      app_id: APP_ID,
      target_channel: 'push',
      included_segments: ['Subscribed Users'],
      headings: {
        es: 'Nuevo video en TifloAcosta',
        en: 'New video on TifloAcosta'
      },
      contents: {
        es: `Ya esta disponible: ${title}`,
        en: `New video available: ${title}`
      },
      url: `${APP_BASE_URL}/videos.html?video=${encodeURIComponent(video.id)}`
    };
  }

  return {
    app_id: APP_ID,
    target_channel: 'push',
    included_segments: ['Subscribed Users'],
    headings: {
      es: 'Nuevos videos en TifloAcosta',
      en: 'New videos on TifloAcosta'
    },
    contents: {
      es: `${videos.length} videos nuevos disponibles en TifloAcosta.`,
      en: `${videos.length} new videos are available on TifloAcosta.`
    },
    url: `${APP_BASE_URL}/videos.html`
  };
}
