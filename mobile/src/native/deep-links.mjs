const ROUTES = new Map([
  ['', 'home'],
  ['/', 'home'],
  ['/actualidad', 'actualidad'],
  ['/buscar', 'search'],
  ['/search', 'search'],
  ['/biblioteca', 'library'],
  ['/library', 'library'],
  ['/favoritos', 'favorites'],
  ['/favorites', 'favorites'],
  ['/videos', 'videos'],
  ['/libro', 'book'],
  ['/book', 'book'],
  ['/podcast', 'podcast'],
  ['/contacto', 'contact'],
  ['/contact', 'contact'],
  ['/configuracion', 'settings'],
  ['/settings', 'settings']
]);

function routeFromPath(pathname) {
  const normalized = pathname === '/'
    ? '/'
    : pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return ROUTES.get(normalized) || 'home';
}

export function parseTifloAcostaUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol === 'https:' && url.hostname.toLowerCase() === 'tifloacosta.com') {
    return { route: routeFromPath(url.pathname), params: {}, externalEntry: true };
  }

  if (url.protocol === 'tifloacosta:') {
    const hostPart = url.hostname ? `/${url.hostname}` : '';
    const combinedPath = `${hostPart}${url.pathname || ''}` || '/';
    return { route: routeFromPath(combinedPath), params: {}, externalEntry: true };
  }

  return null;
}

export async function installDeepLinkListener({ appPlugin, router, resolveRoute = parseTifloAcostaUrl }) {
  const open = value => {
    const target = resolveRoute(value);
    if (!target) return false;
    router.enterExternal(target.route);
    return true;
  };

  const launch = await appPlugin.getLaunchUrl();
  if (launch?.url) open(launch.url);

  const handle = await appPlugin.addListener('appUrlOpen', event => {
    if (event?.url) open(event.url);
  });

  return () => handle.remove();
}