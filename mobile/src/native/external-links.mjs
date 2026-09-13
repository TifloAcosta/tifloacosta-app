function youtubeTarget(url) {
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] || '';
    return id ? `youtube://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null;
  }
  const id = url.searchParams.get('v');
  return id ? `youtube://www.youtube.com/watch?v=${encodeURIComponent(id)}` : `youtube://${url.hostname}${url.pathname}${url.search}`;
}

function whatsappTarget(url) {
  const phone = url.pathname.split('/').filter(Boolean)[0] || '';
  if (!phone) return 'whatsapp://send';
  const params = new URLSearchParams();
  params.set('phone', phone);
  const text = url.searchParams.get('text');
  if (text) params.set('text', text);
  return `whatsapp://send?${params.toString()}`;
}

function spotifyTarget(url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return 'spotify:';
  return `spotify:${parts[0]}:${parts[1]}`;
}

export function classifyExternalTarget(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol === 'mailto:') {
    return { kind: 'mail', appUrl: null, webUrl: value };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'system', appUrl: null, webUrl: value };
  }

  const host = url.hostname.toLowerCase();
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return { kind: 'youtube', appUrl: youtubeTarget(url), webUrl: value };
  }
  if (host === 'wa.me' || host === 'api.whatsapp.com') {
    return { kind: 'whatsapp', appUrl: whatsappTarget(url), webUrl: value };
  }
  if (host === 'open.spotify.com') {
    return { kind: 'spotify', appUrl: spotifyTarget(url), webUrl: value };
  }
  return { kind: 'web', appUrl: null, webUrl: value };
}

export function createExternalLinkService({ appLauncher }) {
  return {
    async open(value) {
      const target = classifyExternalTarget(value);
      if (!target) return { opened: false, via: 'invalid' };

      if (target.appUrl) {
        try {
          const available = await appLauncher.canOpenUrl({ url: target.appUrl });
          if (available?.value) {
            await appLauncher.openUrl({ url: target.appUrl });
            return { opened: true, via: 'app', kind: target.kind };
          }
        } catch {
          // Fall through to the system/web target without interrupting the user.
        }
      }

      await appLauncher.openUrl({ url: target.webUrl });
      return { opened: true, via: 'system', kind: target.kind };
    }
  };
}