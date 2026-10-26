import { pkceChallenge, randomToken, seal, unseal } from './security.js';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  assertCsrf,
  clearCookie,
  createOauthCookie,
  createSessionCookie,
  readOauthCookie,
  readSession
} from './session.js';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken
} from './google-oauth.js';
import {
  comment,
  getAccountVideoState,
  like,
  unlike,
  subscribe,
  unsubscribe,
  listMySubscriptions,
  searchVideos
} from './youtube-api.js';

const PUBLIC_SEARCH_ORIGINS = new Set([
  'https://localhost',
  'capacitor://localhost'
]);

function searchOriginAllowed(request, env) {
  const origin = request.headers.get('Origin') || '';
  return origin === env.ALLOWED_ORIGIN || PUBLIC_SEARCH_ORIGINS.has(origin);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const allowed = origin === env.ALLOWED_ORIGIN ||
    (['/search', '/channel-videos'].includes(url.pathname) && PUBLIC_SEARCH_ORIGINS.has(origin));
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': origin === env.ALLOWED_ORIGIN ? 'true' : 'false',
    'Vary': 'Origin'
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function withQuery(url, key, value) {
  const target = new URL(url);
  target.searchParams.set(key, value);
  return target.toString();
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function redirectUri(request, env) {
  return env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/auth/callback`;
}

function oauthFailure(env) {
  return withQuery(env.APP_RETURN_URL, 'youtubeAuth', 'error');
}

function oauthSuccess(env) {
  return withQuery(env.APP_RETURN_URL, 'youtubeAuth', 'ok');
}

function appError(code, status = 400, clearSession = false) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  error.clearSession = clearSession;
  return error;
}

function safeError(error) {
  const code = String(error?.code || 'YOUTUBE_ERROR');
  if (code === 'INVALID_VIDEO_ID') return appError('INVALID_VIDEO', 400);
  if (code === 'INVALID_COMMENT') return appError('INVALID_COMMENT', 400);
  if (code === 'NATIVE_AUTH_INVALID') return appError('NATIVE_AUTH_INVALID', 401);
  if (code === 'INVALID_SEARCH') return appError('INVALID_SEARCH', 400);
  if (code === 'INVALID_CHANNEL') return appError('INVALID_CHANNEL', 400);
  if (code === 'SEARCH_UNAVAILABLE') return appError('SEARCH_UNAVAILABLE', 503);
  if (code === 'COMMENTS_DISABLED') return appError('COMMENTS_DISABLED', error.status || 403);
  if (code === 'VIDEO_NOT_FOUND') return appError('VIDEO_NOT_FOUND', 404);
  if (code === 'AUTH_REVOKED') return appError('SESSION_EXPIRED', 401, true);
  if (code === 'CSRF_INVALID') return appError('CSRF_INVALID', 403);
  if (code === 'SESSION_EXPIRED') return appError('SESSION_EXPIRED', 401, Boolean(error.clearSession));
  if ([
    'CHANNEL_NOT_FOUND',
    'INELIGIBLE_ACCOUNT',
    'YOUTUBE_FORBIDDEN',
    'INSUFFICIENT_PERMISSIONS',
    'COMMENT_TOO_LONG',
    'INVALID_COMMENT_METADATA',
    'PROCESSING_FAILURE',
    'QUOTA_EXCEEDED',
    'RATE_LIMITED'
  ].includes(code)) {
    return appError(code, error.status || 502);
  }
  return appError('YOUTUBE_ERROR', 502);
}

async function readJson(request) {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function nativeCredential(request) {
  const match = (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_.-]{20,8192})$/);
  return match ? match[1] : '';
}

async function authenticatedContext(request, env, fetchImpl) {
  let session;
  let native = false;
  const credential = nativeCredential(request);
  if (credential) {
    // Cookies web y credenciales iOS usan distintos contextos cifrados.
    // El token nativo solo es válido con su audiencia y caducidad.
    try {
      const decoded = await unseal(credential, env.YOUTUBE_SESSION_SECRET);
      if (decoded?.kind !== 'ios-session' || decoded?.exp <= Date.now() ||
          typeof decoded?.refreshToken !== 'string' || !decoded.refreshToken) {
        throw new Error('invalid native session');
      }
      session = decoded;
      native = true;
    } catch {
      throw appError('SESSION_EXPIRED', 401);
    }
  } else {
    session = await readSession(request, env.YOUTUBE_SESSION_SECRET);
  }
  if (!session) throw appError('SESSION_EXPIRED', 401);

  if (typeof session.accessToken === 'string' && session.accessToken &&
      Number(session.accessExp) > Date.now() + 60_000) {
    return { session, accessToken: session.accessToken, native };
  }
  try {
    const token = await refreshAccessToken({
      refreshToken: session.refreshToken,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      fetchImpl
    });
    return { session, accessToken: token.access_token, native };
  } catch {
    throw appError('SESSION_EXPIRED', 401, !native);
  }
}

function actionOriginAllowed(request, env) {
  // El navegador conserva comprobación estricta de origen + CSRF.
  // El cliente iOS aporta una sesión Bearer cifrada en Keychain.
  if (nativeCredential(request)) return !request.headers.has('Origin');
  return request.headers.get('Origin') === env.ALLOWED_ORIGIN;
}

function errorResponse(error, cors) {
  const safe = safeError(error);
  const headers = { ...cors };
  if (safe.clearSession) headers['Set-Cookie'] = clearCookie(SESSION_COOKIE);
  return json({ error: safe.code }, safe.status, headers);
}

export async function handleRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (url.pathname === '/health' && request.method === 'GET') {
    return json({ ok: true, service: 'youtube-actions' }, 200, cors);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token'
      }
    });
  }

  // Autorización nativa iOS/Android mediante navegador seguro y doble PKCE.
  // El segundo desafío vincula el ticket a la instalación iniciadora.
  if (url.pathname === '/auth/native/start' && request.method === 'GET') {
    const challenge = url.searchParams.get('challenge') || '';
    const nativePlatform = url.searchParams.get('platform') || 'ios';
    if (!['ios', 'android'].includes(nativePlatform) ||
        !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
        !env.GOOGLE_CLIENT_ID || !env.YOUTUBE_SESSION_SECRET) {
      return json({ error: 'NATIVE_AUTH_INVALID' }, 400, cors);
    }
    const verifier = randomToken(48);
    const state = randomToken(32);
    const oauthCookie = await createOauthCookie({
      state, verifier, nativeChallenge: challenge, nativePlatform,
      exp: Date.now() + 10 * 60 * 1000
    }, env.YOUTUBE_SESSION_SECRET);
    const authorization = buildAuthorizationUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri: redirectUri(request, env),
      state, challenge: await pkceChallenge(verifier)
    });
    return redirect(authorization.toString(), [oauthCookie]);
  }

  if (url.pathname === '/auth/native/exchange' && request.method === 'POST') {
    if (request.headers.has('Origin')) {
      return json({ error: 'NATIVE_AUTH_INVALID' }, 403, cors);
    }
    const { ticket, verifier } = await readJson(request);
    if (typeof ticket !== 'string' || ticket.length > 8192 ||
        typeof verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
      return json({ error: 'NATIVE_AUTH_INVALID' }, 401, cors);
    }
    try {
      const decoded = await unseal(ticket, env.YOUTUBE_SESSION_SECRET);
      if (decoded?.kind !== 'ios-ticket' || decoded?.exp <= Date.now() ||
          decoded?.exp > Date.now() + 60_000 ||
          decoded?.challenge !== await pkceChallenge(verifier) ||
          typeof decoded?.refreshToken !== 'string' || !decoded.refreshToken) {
        throw new Error('invalid code verifier or expired ticket');
      }
      const session = {
        kind: 'ios-session', refreshToken: decoded.refreshToken,
        accessToken: decoded.accessToken, accessExp: decoded.accessExp,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };
      return json({
        authenticated: true, token: await seal(session, env.YOUTUBE_SESSION_SECRET),
        expiresAt: session.exp
      }, 200, cors);
    } catch {
      return json({ error: 'NATIVE_AUTH_INVALID' }, 401, cors);
    }
  }

  if (url.pathname === '/auth/start' && request.method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID || !env.YOUTUBE_SESSION_SECRET) {
      return redirect(oauthFailure(env));
    }
    const verifier = randomToken(48);
    const state = randomToken(32);
    const challenge = await pkceChallenge(verifier);
    const oauthCookie = await createOauthCookie({
      state,
      verifier,
      exp: Date.now() + 10 * 60 * 1000
    }, env.YOUTUBE_SESSION_SECRET);
    const authorization = buildAuthorizationUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri: redirectUri(request, env),
      state,
      challenge
    });
    return redirect(authorization.toString(), [oauthCookie]);
  }

  const nativeReturn = (state, params) => {
    const scheme = state?.nativePlatform === 'android' ? 'tifloacostanative' : 'tifloacosta';
    return scheme + '://youtube-auth?' + new URLSearchParams(params).toString();
  };

  if (url.pathname === '/auth/callback' && request.method === 'GET') {
    const clearOauth = clearCookie(OAUTH_COOKIE);
    const oauthState = await readOauthCookie(request, env.YOUTUBE_SESSION_SECRET);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const denied = url.searchParams.has('error');

    if (denied || !oauthState || !code || !state || oauthState.state !== state) {
      return redirect(oauthState?.nativeChallenge
        ? nativeReturn(oauthState, { error: 'denied' })
        : oauthFailure(env), [clearOauth]);
    }

    try {
      const tokens = await exchangeAuthorizationCode({
        code,
        verifier: oauthState.verifier,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: redirectUri(request, env),
        fetchImpl
      });
      if (typeof tokens.refresh_token !== 'string' || !tokens.refresh_token) {
        return redirect(oauthState?.nativeChallenge
          ? nativeReturn(oauthState, { error: 'missing_refresh_token' })
          : oauthFailure(env), [clearOauth]);
      }

      const expiresIn = Number(tokens.expires_in);
      const session = {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessExp: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
        csrf: randomToken(32),
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000
      };
      if (oauthState.nativeChallenge) {
        const ticket = await seal({
          kind: 'ios-ticket', challenge: oauthState.nativeChallenge,
          refreshToken: session.refreshToken, accessToken: session.accessToken,
          accessExp: session.accessExp, exp: Date.now() + 60_000
        }, env.YOUTUBE_SESSION_SECRET);
        return redirect(nativeReturn(oauthState, { ticket }), [clearOauth]);
      }
      const sessionCookie = await createSessionCookie(session, env.YOUTUBE_SESSION_SECRET);
      return redirect(oauthSuccess(env), [sessionCookie, clearOauth]);
    } catch {
      return redirect(oauthState?.nativeChallenge
        ? nativeReturn(oauthState, { error: 'failed' })
        : oauthFailure(env), [clearOauth]);
    }
  }

  if (['/search', '/channel-videos'].includes(url.pathname) && request.method === 'GET') {
    if (!searchOriginAllowed(request, env)) {
      return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403, cors);
    }
    try {
      const result = await searchVideos(
        env.YOUTUBE_API_KEY,
        url.searchParams.get('q') || '',
        url.searchParams.get('pageToken') || '',
        fetchImpl,
        { filter: url.searchParams.get('filter') || 'video',
          channelId: url.pathname === '/channel-videos' ? url.searchParams.get('channelId') || '' : '' }
      );
      return json(result, 200, cors);
    } catch (error) {
      return errorResponse(error, cors);
    }
  }

  if (url.pathname === '/session' && request.method === 'GET') {
    if (nativeCredential(request)) {
      try {
        await authenticatedContext(request, env, fetchImpl);
        return json({ authenticated: true }, 200, cors);
      } catch {
        return json({ authenticated: false }, 200, cors);
      }
    }
    const session = await readSession(request, env.YOUTUBE_SESSION_SECRET);
    return session
      ? json({ authenticated: true, csrf: session.csrf }, 200, cors)
      : json({ authenticated: false }, 200, cors);
  }

  if (url.pathname === '/subscriptions' && request.method === 'GET') {
    try {
      const { accessToken } = await authenticatedContext(request, env, fetchImpl);
      const page = await listMySubscriptions(accessToken, url.searchParams.get('pageToken') || '', fetchImpl);
      return json(page, 200, cors);
    } catch (error) {
      return errorResponse(error, cors);
    }
  }

  if (url.pathname === '/state' && request.method === 'GET') {
    try {
      const { accessToken } = await authenticatedContext(request, env, fetchImpl);
      const state = await getAccountVideoState(accessToken, url.searchParams.get('videoId') || '', fetchImpl);
      return json({ authenticated: true, ...state }, 200, cors);
    } catch (error) {
      return errorResponse(error, cors);
    }
  }

  if (['/subscribe', '/unsubscribe', '/like', '/unlike', '/comment', '/logout'].includes(url.pathname) && request.method === 'POST') {
    if (!actionOriginAllowed(request, env)) return json({ error: 'CSRF_INVALID' }, 403, cors);
  }

  if (url.pathname === '/logout' && request.method === 'POST' && nativeCredential(request)) {
    // Sin sesión servidor persistente: la app borra el token de Keychain.
    // El token protegido caduca por sí solo a los 7 días.
    return json({ authenticated: false }, 200, cors);
  }

  if (url.pathname === '/logout' && request.method === 'POST') {
    const session = await readSession(request, env.YOUTUBE_SESSION_SECRET);
    if (session) {
      try {
        assertCsrf(request, session);
      } catch (error) {
        return errorResponse(error, cors);
      }
    }
    const headers = { ...cors, 'Set-Cookie': clearCookie(SESSION_COOKIE) };
    return json({ authenticated: false }, 200, headers);
  }

  if (['/subscribe', '/unsubscribe', '/like', '/unlike', '/comment'].includes(url.pathname) && request.method === 'POST') {
    try {
      const { session, accessToken, native } = await authenticatedContext(request, env, fetchImpl);
      if (!native) assertCsrf(request, session);
      const body = await readJson(request);

      if (url.pathname === '/subscribe') {
        return json(await subscribe(accessToken, body.videoId || '', fetchImpl), 200, cors);
      }
      if (url.pathname === '/unsubscribe') {
        return json(await unsubscribe(accessToken, body.videoId, fetchImpl), 200, cors);
      }
      if (url.pathname === '/like') {
        return json(await like(accessToken, body.videoId, fetchImpl), 200, cors);
      }
      if (url.pathname === '/unlike') {
        return json(await unlike(accessToken, body.videoId, fetchImpl), 200, cors);
      }
      return json(await comment(accessToken, body.videoId, body.text, fetchImpl), 200, cors);
    } catch (error) {
      return errorResponse(error, cors);
    }
  }

  return json({ error: 'NOT_FOUND' }, 404, cors);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
