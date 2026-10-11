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
  commentOnVideoChannel,
  getAccountVideoState,
  getAccountVideoStateForVideo,
  like,
  subscribe,
  subscribeToVideoChannel,
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
    (url.pathname === '/search' && PUBLIC_SEARCH_ORIGINS.has(origin));
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


// OAuth for the installed iOS app keeps credentials on the Worker and the
// encrypted bearer session in iOS Keychain. The public web flow is unchanged.
const IOS_CALLBACK = 'tifloacosta://youtube-auth';
const IOS_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const IOS_TICKET_MS = 90_000;
const IOS_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function iosCallback(result = 'error', ticket = '') {
  const url = new URL(IOS_CALLBACK);
  url.searchParams.set('result', result);
  if (ticket) url.searchParams.set('ticket', ticket);
  return url.toString();
}
function iosOauthFailure(oauthState, env) {
  return oauthState?.iosChallenge ? iosCallback('error') : oauthFailure(env);
}

async function redeemIosTicket(ticket, verifier, secret) {
  if (typeof ticket !== 'string' || ticket.length > 15000 ||
      typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128 ||
      !/^[A-Za-z0-9_-]+$/.test(verifier)) throw appError('SESSION_EXPIRED', 401);
  let content;
  try { content = await unseal(ticket, secret); }
  catch { throw appError('SESSION_EXPIRED', 401); }
  if (content?.kind !== 'ios-authorization' ||
      !Number.isFinite(content.exp) || content.exp <= Date.now() ||
      !IOS_CHALLENGE_RE.test(content.challenge) ||
      await pkceChallenge(verifier) !== content.challenge ||
      typeof content.refreshToken !== 'string' || !content.refreshToken) {
    throw appError('SESSION_EXPIRED', 401);
  }
  return content;
}

async function iosBearerSession(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ') || header.length > 15000) throw appError('SESSION_EXPIRED', 401);
  let session;
  try { session = await unseal(header.slice(7), env.YOUTUBE_SESSION_SECRET); }
  catch { throw appError('SESSION_EXPIRED', 401); }
  if (session?.kind !== 'ios-session' || !Number.isFinite(session.exp) ||
      session.exp <= Date.now() || !session.refreshToken) throw appError('SESSION_EXPIRED', 401);
  return session;
}

async function iosAuthenticatedContext(request, env, fetchImpl) {
  const session = await iosBearerSession(request, env);
  if (session.accessToken && Number(session.accessExp) > Date.now() + 60_000) {
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
    throw appError('SESSION_EXPIRED', 401);
  }
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
  if (code === 'INVALID_SEARCH') return appError('INVALID_SEARCH', 400);
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
    const iosRequested = url.searchParams.has('iosChallenge');
    if (!env.GOOGLE_CLIENT_ID || !env.YOUTUBE_SESSION_SECRET) {
      return redirect(iosRequested ? iosCallback('error') : oauthFailure(env));
    }
    const iosChallenge = url.searchParams.get('iosChallenge') || '';
    if (iosRequested && !IOS_CHALLENGE_RE.test(iosChallenge)) {
      return redirect(iosCallback('error'));
    }
    const verifier = randomToken(48);
    const state = randomToken(32);
    const challenge = await pkceChallenge(verifier);
    const oauthCookie = await createOauthCookie({
      state,
      verifier,
      ...(iosRequested ? { iosChallenge } : {}),
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
      return redirect(iosOauthFailure(oauthState, env), [clearOauth]);
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
        return redirect(iosOauthFailure(oauthState, env), [clearOauth]);
      }

      const expiresIn = Number(tokens.expires_in);
      const session = {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessExp: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
        csrf: randomToken(32),
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000
      };
      if (oauthState.iosChallenge) {
        const ticket = await seal({
          kind: 'ios-authorization',
          refreshToken: session.refreshToken,
          accessToken: session.accessToken,
          accessExp: session.accessExp,
          challenge: oauthState.iosChallenge,
          exp: Date.now() + IOS_TICKET_MS
        }, env.YOUTUBE_SESSION_SECRET);
        return redirect(iosCallback('ok', ticket), [clearOauth]);
      }
      const sessionCookie = await createSessionCookie(session, env.YOUTUBE_SESSION_SECRET);
      return redirect(oauthSuccess(env), [sessionCookie, clearOauth]);
    } catch {
      return redirect(iosOauthFailure(oauthState, env), [clearOauth]);
    }
  }


  // ASWebAuthenticationSession receives only an opaque, short-lived ticket.
  // Keychain stores the encrypted session; tokens are never sent to web JavaScript.
  if (url.pathname === '/native/redeem' && request.method === 'POST') {
    try {
      if (!env.YOUTUBE_SESSION_SECRET) throw appError('SESSION_EXPIRED', 401);
      const body = await readJson(request);
      const verified = await redeemIosTicket(body.ticket, body.verifier, env.YOUTUBE_SESSION_SECRET);
      const sessionToken = await seal({
        kind: 'ios-session',
        refreshToken: verified.refreshToken,
        accessToken: verified.accessToken,
        accessExp: verified.accessExp,
        exp: Date.now() + IOS_SESSION_MS
      }, env.YOUTUBE_SESSION_SECRET);
      return json({ sessionToken });
    } catch (error) {
      return errorResponse(error, {});
    }
  }

  if (url.pathname === '/native/session' && request.method === 'GET') {
    try {
      await iosBearerSession(request, env);
      return json({ authenticated: true });
    } catch (error) {
      return errorResponse(error, {});
    }
  }

  if (url.pathname === '/native/state' && request.method === 'GET') {
    try {
      const { accessToken } = await iosAuthenticatedContext(request, env, fetchImpl);
      const state = await getAccountVideoStateForVideo(accessToken, url.searchParams.get('videoId') || '', fetchImpl);
      return json({ authenticated: true, ...state });
    } catch (error) {
      return errorResponse(error, {});
    }
  }

  if (['/native/subscribe', '/native/like', '/native/comment'].includes(url.pathname) && request.method === 'POST') {
    try {
      const { accessToken } = await iosAuthenticatedContext(request, env, fetchImpl);
      const body = await readJson(request);
      const videoId = body.videoId || '';
      if (url.pathname === '/native/subscribe') {
        return json(await subscribeToVideoChannel(accessToken, videoId, fetchImpl));
      }
      if (url.pathname === '/native/like') {
        return json(await like(accessToken, videoId, fetchImpl));
      }
      return json(await commentOnVideoChannel(accessToken, videoId, body.text, fetchImpl));
    } catch (error) {
      return errorResponse(error, {});
    }
  }

  if (url.pathname === '/search' && request.method === 'GET') {
    if (!searchOriginAllowed(request, env)) {
      return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403, cors);
    }
    try {
      const result = await searchVideos(
        env.YOUTUBE_API_KEY,
        url.searchParams.get('q') || '',
        url.searchParams.get('pageToken') || '',
        fetchImpl
      );
      return json(result, 200, cors);
    } catch (error) {
      return errorResponse(error, cors);
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
      const videoId = url.searchParams.get('videoId') || '';
      const state = url.searchParams.get('channelScope') === 'video'
        ? await getAccountVideoStateForVideo(accessToken, videoId, fetchImpl)
        : await getAccountVideoState(accessToken, videoId, fetchImpl);
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
        // Optional video-specific subscription; the legacy request without a
        // videoId remains scoped to TifloAcosta to preserve published clients.
        return json(body.videoId
          ? await subscribeToVideoChannel(accessToken, body.videoId, fetchImpl)
          : await subscribe(accessToken, fetchImpl), 200, cors);
      }
      if (url.pathname === '/like') {
        return json(await like(accessToken, body.videoId, fetchImpl), 200, cors);
      }
      return json(body.channelScope === 'video'
        ? await commentOnVideoChannel(accessToken, body.videoId, body.text, fetchImpl)
        : await comment(accessToken, body.videoId, body.text, fetchImpl), 200, cors);
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
