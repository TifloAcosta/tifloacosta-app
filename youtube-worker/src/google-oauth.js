export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function buildAuthorizationUrl({ clientId, redirectUri, state, challenge }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();
  return url;
}

function oauthError(code = 'GOOGLE_OAUTH_FAILED') {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function tokenRequest(body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch {
    throw oauthError();
  }
  if (!response.ok) throw oauthError();
  let data;
  try {
    data = await response.json();
  } catch {
    throw oauthError();
  }
  if (!data || typeof data.access_token !== 'string' || !data.access_token) {
    throw oauthError();
  }
  return data;
}

export function exchangeAuthorizationCode({
  code,
  verifier,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch
}) {
  return tokenRequest(new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier
  }), fetchImpl);
}

export function refreshAccessToken({
  refreshToken,
  clientId,
  clientSecret,
  fetchImpl = fetch
}) {
  if (!refreshToken) throw oauthError();
  return tokenRequest(new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  }), fetchImpl);
}
