import { pkceChallenge, randomToken } from './security.js';
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
  subscribe
} from './youtube-api.js';

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (origin !== env.ALLOWED_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
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
  if (code === 'COMMENTS_DISABLED') return appError('COMMENTS_DISABLED', error.status || 403);
  if (code === 'VIDEO_NOT_FOUND') return appError('VIDEO_NOT_FOUND', 404);
  if (code === 'AUTH_REVOKED') return appError('SESSION_EXPIRED', 401, true);
  if (code === 'CSRF_INVALID') return appError('CSRF_INVALID', 403);
  if (code === 'SESSION_EXPIRED') return appError('SESSION_EXPIRED', 401, Boolean(error.clearSession));
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

async function authenticatedContext(request, env, fetchImpl) {
  const session = await readSession(request, env.YOUTUBE_SESSION_SECRET);
  if (!session) throw appError('SESSION_EXPIRED', 401);

  if (typeof session.accessToken === 'string' && session.accessToken && Number(session.accessExp) > Date.now() + 60_000) {
    return { session, accessToken: session.accessToken };
  }

  try {
    const token = await refreshAccessToken({
      refreshToken: session.refreshToken,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      fetchImpl
    });
    return { session, accessToken: token.access_token };
  } catch {
    throw appError('SESSION_EXPIRED', 401, true);
  }
}

function actionOriginAllowed(request, env) {
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

  if (url.pathname === '/auth/callback' && request.method === 'GET') {
    const clearOauth = clearCookie(OAUTH_COOKIE);
    const oauthState = await readOauthCookie(request, env.YOUTUBE_SESSION_SECRET);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const denied = url.searchParams.has('error');

    if (denied || !oauthState || !code || !state || oauthState.state !== state) {
      return redirect(oauthFailure(env), [clearOauth]);
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
        return redirect(oauthFailure(env), [clearOauth]);
      }

      const expiresIn = Number(tokens.expires_in);
      const session = {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessExp: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
        csrf: randomToken(32),
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000
      };
      const sessionCookie = await createSessionCookie(session, env.YOUTUBE_SESSION_SECRET);
      return redirect(oauthSuccess(env), [sessionCookie, clearOauth]);
    } catch {
      return redirect(oauthFailure(env), [clearOauth]);
    }
  }

  if (url.pathname === '/session' && request.method === 'GET') {
    const session = await readSession(request, env.YOUTUBE_SESSION_SECRET);
    return session
      ? json({ authenticated: true, csrf: session.csrf }, 200, cors)
      : json({ authenticated: false }, 200, cors);
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

  if (['/subscribe', '/like', '/comment', '/logout'].includes(url.pathname) && request.method === 'POST') {
    if (!actionOriginAllowed(request, env)) return json({ error: 'CSRF_INVALID' }, 403, cors);
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

  if (['/subscribe', '/like', '/comment'].includes(url.pathname) && request.method === 'POST') {
    try {
      const { session, accessToken } = await authenticatedContext(request, env, fetchImpl);
      assertCsrf(request, session);
      const body = await readJson(request);

      if (url.pathname === '/subscribe') {
        return json(await subscribe(accessToken, fetchImpl), 200, cors);
      }
      if (url.pathname === '/like') {
        return json(await like(accessToken, body.videoId, fetchImpl), 200, cors);
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
