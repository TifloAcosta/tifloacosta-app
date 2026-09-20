# YouTube Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a los vídeos de TifloAcosta suscripción al canal, Me gusta y comentarios mediante OAuth 2.0 de Google, manteniendo el reproductor actual completamente independiente y operativo aunque falle la capa autenticada.

**Architecture:** `tifloacosta.com` continúa servido por GitHub Pages. Un Worker nuevo e independiente en `youtube-auth.tifloacosta.com` mantiene OAuth, sesión y llamadas autenticadas a YouTube. El frontend añade un módulo aislado `youtube-actions.js` que recibe el vídeo activo desde `videos.js`; no sustituye el reproductor ni sus controles existentes.

**Tech Stack:** HTML/CSS/JavaScript sin framework, Node.js `node:test`, Cloudflare Workers + Web Crypto API, Google OAuth 2.0, YouTube Data API v3.

**Spec:** `docs/superpowers/specs/2026-09-20-youtube-actions-design.md`

## Global Constraints

- El reproductor actual no se reemplaza ni se reestructura.
- Reproducción, Retroceder 1 minuto, Reproducir/Pausar, Avanzar 1 minuto, Cerrar reproductor y Abrir en YouTube deben seguir funcionando aunque OAuth o el Worker fallen.
- `tifloacosta.com` seguirá directamente en GitHub Pages; no se añadirá una ruta Worker sobre el dominio principal.
- El nuevo Worker usará `youtube-auth.tifloacosta.com` y será independiente de `download.tifloacosta.com`.
- No modificar `download-worker/` ni `download-config.js`.
- No incluir `GOOGLE_CLIENT_SECRET`, refresh tokens, access tokens ni `YOUTUBE_SESSION_SECRET` en JavaScript público.
- Único scope de YouTube para esta fase: `https://www.googleapis.com/auth/youtube.force-ssl`.
- Ver y reproducir un vídeo nunca requiere autenticación.
- No implementar cancelar suscripción, retirar Me gusta, No me gusta, editar/borrar comentarios ni otras capacidades de YouTube.
- Un comentario requiere pulsar expresamente `Publicar comentario`.
- Android utiliza el mismo flujo web HTTPS; no crear OAuth nativo Android.
- Accesibilidad manual final: JAWS, NVDA, VoiceOver y TalkBack.
- Español e inglés deben mantenerse equivalentes.

## Review Focus

1. **Cookies en peticiones cross-origin same-site:** `fetch(..., { credentials: 'include' })` desde `https://tifloacosta.com` debe recibir/enviar la cookie host-only de `youtube-auth.tifloacosta.com`; probar CORS con credenciales y `SameSite=Lax`.
2. **OAuth interrumpido o estado manipulado:** un `state` incorrecto, cookie temporal ausente o callback sin `code` debe terminar sin crear sesión y regresar con un error seguro.
3. **Sesión caducada o refresh token revocado:** el Worker debe devolver `401 SESSION_EXPIRED`; el frontend vuelve al estado de conexión sin afectar al reproductor.
4. **Regreso móvil desde Google:** tras OAuth, Windows, iPhone y Android deben recuperar el mismo `videoId` desde `sessionStorage` y reabrirlo sin crear una segunda instancia del reproductor.
5. **YouTube rechaza la acción:** comentarios desactivados, vídeo no disponible, suscripción ya existente o valoración ya aplicada deben mapearse a estados idempotentes o mensajes claros, nunca a errores técnicos visibles.

---

## File Structure

### Nuevos archivos del Worker

- `youtube-worker/package.json` — scripts de test y despliegue del Worker.
- `youtube-worker/wrangler.toml` — nombre, entrada y custom domain del Worker.
- `youtube-worker/src/security.js` — random, PKCE, cifrado/descifrado de cookies y utilidades CSRF.
- `youtube-worker/src/session.js` — lectura/escritura de sesión y cookie OAuth temporal.
- `youtube-worker/src/google-oauth.js` — URL de autorización, intercambio de código y renovación de token.
- `youtube-worker/src/youtube-api.js` — llamadas concretas y limitadas a suscripción, valoración y comentario.
- `youtube-worker/src/index.js` — router HTTP, CORS, validación y respuestas.
- `youtube-worker/test/security.test.mjs` — PKCE, cifrado y cookies.
- `youtube-worker/test/oauth.test.mjs` — inicio/callback OAuth simulados.
- `youtube-worker/test/youtube-api.test.mjs` — cliente YouTube con `fetch` simulado.
- `youtube-worker/test/routes.test.mjs` — endpoints, CORS, CSRF y expiración.

### Nuevos archivos del frontend

- `youtube-actions-config.js` — URL pública del Worker, sin secretos.
- `youtube-actions-core.js` — estado puro, validación y textos derivados comprobables.
- `youtube-actions.js` — DOM, `fetch`, foco, `aria-live`, OAuth y acciones.
- `youtube-actions.css` — estilos exclusivos del bloque de acciones.
- `test/youtube-actions-core.test.mjs` — lógica pura.
- `test/youtube-actions-integration.test.mjs` — contrato HTML/JS, aislamiento y regreso OAuth.

### Archivos existentes a modificar mínimamente

- `videos.html` — insertar el contenedor del bloque y referencias a los nuevos assets.
- `videos.js` — notificar al módulo cuando se abre/cierra un vídeo, cambiar idioma y recuperar un vídeo pendiente tras OAuth.
- `sw.js` — únicamente si la estrategia de caché exige versionar nuevos assets; no cambiar su lógica de navegación.
- `.github/workflows/` — añadir CI del Worker o ampliar una workflow de test existente sin alterar despliegues ajenos.
- `privacidad/` — añadir, si falta, una explicación explícita del uso de OAuth/YouTube necesaria antes del acceso público.

---

### Task 1: Scaffold independiente del Worker y contrato HTTP básico

**Files:**
- Create: `youtube-worker/package.json`
- Create: `youtube-worker/wrangler.toml`
- Create: `youtube-worker/src/index.js`
- Create: `youtube-worker/test/routes.test.mjs`

**Interfaces:**
- Consumes: Cloudflare Worker `fetch(request, env)`.
- Produces: `GET /health`, helper `json(data, status, headers)`, CORS restringido a `https://tifloacosta.com`.

- [ ] **Step 1: Write the failing route tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const env = { ALLOWED_ORIGIN: 'https://tifloacosta.com' };

test('GET /health is public and does not expose secrets', async () => {
  const response = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/health'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'youtube-actions' });
});

test('credentialed CORS allows only the production origin', async () => {
  const allowed = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/session', {
    headers: { Origin: 'https://tifloacosta.com' }
  }), env);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://tifloacosta.com');
  assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'), 'true');

  const blocked = await worker.fetch(new Request('https://youtube-auth.tifloacosta.com/session', {
    headers: { Origin: 'https://example.com' }
  }), env);
  assert.notEqual(blocked.headers.get('Access-Control-Allow-Origin'), '*');
  assert.notEqual(blocked.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
});
```

- [ ] **Step 2: Run the Worker tests and verify failure**

Run: `node --test youtube-worker/test/routes.test.mjs`

Expected: FAIL because `youtube-worker/src/index.js` does not exist.

- [ ] **Step 3: Add the minimal Worker scaffold**

`youtube-worker/package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.mjs",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

`youtube-worker/wrangler.toml`:

```toml
name = "tifloacosta-youtube-actions"
main = "src/index.js"
compatibility_date = "2026-09-20"
workers_dev = true
routes = [
  { pattern = "youtube-auth.tifloacosta.com", custom_domain = true }
]

[vars]
ALLOWED_ORIGIN = "https://tifloacosta.com"
APP_RETURN_URL = "https://tifloacosta.com/videos.html"
```

`youtube-worker/src/index.js` starts with:

```js
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'youtube-actions' }, 200, cors);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token'
      }});
    }
    return json({ error: 'NOT_FOUND' }, 404, cors);
  }
};
```

- [ ] **Step 4: Run tests**

Run: `node --test youtube-worker/test/routes.test.mjs`

Expected: PASS.

- [ ] **Step 5: Confirm isolation from Downloads**

Run: `git diff --name-only`

Expected paths for this task only under `youtube-worker/`; no `download-worker/` or `download-config.js`.

- [ ] **Step 6: Commit**

```bash
git add youtube-worker
git commit -m "feat: scaffold isolated YouTube actions worker"
```

---

### Task 2: PKCE, encrypted cookies, session and CSRF

**Files:**
- Create: `youtube-worker/src/security.js`
- Create: `youtube-worker/src/session.js`
- Create: `youtube-worker/test/security.test.mjs`

**Interfaces:**
- Produces: `randomToken(bytes)`, `pkceChallenge(verifier)`, `seal(value, secret)`, `unseal(token, secret)`, `createSessionCookie(session, secret)`, `readSession(request, secret)`, `createOauthCookie(data, secret)`, `readOauthCookie(request, secret)`, `clearCookie(name)`, `assertCsrf(request, session)`.

- [ ] **Step 1: Write failing crypto/session tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { pkceChallenge, seal, unseal } from '../src/security.js';
import { createSessionCookie, readSession } from '../src/session.js';

test('sealed session round-trips without exposing plaintext', async () => {
  const secret = 'test-secret-at-least-32-bytes-long-123456';
  const sealed = await seal({ refreshToken: 'refresh-123', exp: Date.now() + 60_000 }, secret);
  assert.equal(sealed.includes('refresh-123'), false);
  assert.equal((await unseal(sealed, secret)).refreshToken, 'refresh-123');
});

test('PKCE challenge is deterministic and different from verifier', async () => {
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const challenge = await pkceChallenge(verifier);
  assert.notEqual(challenge, verifier);
  assert.match(challenge, /^[A-Za-z0-9_-]+$/);
});

test('session cookie is HttpOnly Secure host-only and SameSite=Lax', async () => {
  const secret = 'test-secret-at-least-32-bytes-long-123456';
  const header = await createSessionCookie({ refreshToken: 'r', csrf: 'c', exp: Date.now() + 60_000 }, secret);
  assert.match(header, /^__Host-tiflo_youtube=/);
  assert.match(header, /Path=\//);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=Lax/);
  assert.doesNotMatch(header, /Domain=/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test youtube-worker/test/security.test.mjs`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement security primitives with Web Crypto**

Use these invariants in `security.js`:

```js
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(data);
}

export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return base64url(new Uint8Array(digest));
}

async function aesKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
```

`seal()` must use a random 12-byte IV and encode `iv.ciphertext` as base64url. `unseal()` must throw on malformed or tampered values; it must never return partial plaintext.

- [ ] **Step 4: Implement session cookies and CSRF**

Session cookie constants:

```js
export const SESSION_COOKIE = '__Host-tiflo_youtube';
export const OAUTH_COOKIE = '__Host-tiflo_youtube_oauth';
```

Session payload shape:

```js
{
  refreshToken: '...',
  csrf: 'random-token',
  exp: 1790000000000
}
```

OAuth temporary payload shape:

```js
{
  state: 'random-state',
  verifier: 'pkce-verifier',
  exp: 1790000000000
}
```

`assertCsrf` compares `X-CSRF-Token` using exact string equality after ensuring both values are non-empty; reject with a typed `CSRF_INVALID` error.

- [ ] **Step 5: Run security tests**

Run: `node --test youtube-worker/test/security.test.mjs`

Expected: PASS.

- [ ] **Step 6: Add tampering and expiry coverage**

Add tests proving:
- changing one character in the sealed cookie causes `unseal` to reject;
- expired sessions return `null` from `readSession`;
- absent cookie returns `null`;
- wrong CSRF header is rejected.

Run: `node --test youtube-worker/test/security.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add youtube-worker/src/security.js youtube-worker/src/session.js youtube-worker/test/security.test.mjs
git commit -m "feat: protect YouTube OAuth sessions"
```

---

### Task 3: Google OAuth server-side flow and return to the same video

**Files:**
- Create: `youtube-worker/src/google-oauth.js`
- Create: `youtube-worker/test/oauth.test.mjs`
- Modify: `youtube-worker/src/index.js`
- Modify: `youtube-worker/test/routes.test.mjs`

**Interfaces:**
- Consumes secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_SESSION_SECRET`.
- Produces routes: `GET /auth/start`, `GET /auth/callback`, `GET /session`, `POST /logout`.
- Produces session JSON: `{ authenticated: true, csrf: string }` or `{ authenticated: false }`.

- [ ] **Step 1: Write failing OAuth start test**

```js
test('auth start creates PKCE state cookie and redirects to Google', async () => {
  const response = await worker.fetch(new Request(
    'https://youtube-auth.tifloacosta.com/auth/start',
    { headers: { Origin: 'https://tifloacosta.com' } }
  ), fullEnv);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://accounts.google.com');
  assert.equal(location.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.force-ssl');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(location.searchParams.get('state'));
  assert.match(response.headers.get('Set-Cookie'), /__Host-tiflo_youtube_oauth=/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test youtube-worker/test/oauth.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement authorization URL**

`google-oauth.js` exports:

```js
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
  });
  return url.toString();
}
```

Redirect URI must be constructed as exactly:

`https://youtube-auth.tifloacosta.com/auth/callback`

- [ ] **Step 4: Implement token exchange and refresh**

Functions:

```js
export async function exchangeCode({ code, verifier, clientId, clientSecret, redirectUri, fetchImpl = fetch })
export async function refreshAccessToken({ refreshToken, clientId, clientSecret, fetchImpl = fetch })
```

Both use `application/x-www-form-urlencoded`; they throw typed errors on non-2xx. `exchangeCode` requires a returned `refresh_token` before creating a persistent session.

- [ ] **Step 5: Write callback failure/success tests with mocked token endpoint**

Cover:
- wrong `state` -> 400 and no session cookie;
- missing OAuth temporary cookie -> 400;
- token endpoint error -> safe redirect to `videos.html?youtube_auth=error`;
- success -> session cookie set, OAuth temporary cookie cleared, redirect to `videos.html?youtube_auth=ok`.

The mock token response:

```js
new Response(JSON.stringify({
  access_token: 'access-1',
  expires_in: 3600,
  refresh_token: 'refresh-1',
  scope: YOUTUBE_SCOPE,
  token_type: 'Bearer'
}), { status: 200, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 6: Implement `/session` and `/logout`**

`GET /session`:

```json
{ "authenticated": true, "csrf": "..." }
```

Never include access/refresh tokens.

`POST /logout` requires Origin + CSRF and returns:

```json
{ "authenticated": false }
```

with expired `__Host-tiflo_youtube` cookie.

- [ ] **Step 7: Run OAuth and route tests**

Run: `node --test youtube-worker/test/oauth.test.mjs youtube-worker/test/routes.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add youtube-worker/src/google-oauth.js youtube-worker/src/index.js youtube-worker/test/oauth.test.mjs youtube-worker/test/routes.test.mjs
git commit -m "feat: add Google OAuth flow for YouTube actions"
```

---

### Task 4: Restricted YouTube API client

**Files:**
- Create: `youtube-worker/src/youtube-api.js`
- Create: `youtube-worker/test/youtube-api.test.mjs`

**Interfaces:**
- Produces: `resolveChannelId(accessToken)`, `getAccountVideoState(accessToken, videoId)`, `subscribe(accessToken)`, `like(accessToken, videoId)`, `comment(accessToken, videoId, text)`.
- Input video IDs must match `/^[A-Za-z0-9_-]{11}$/`.

- [ ] **Step 1: Write failing API client tests**

Test URLs and methods, not Google itself. Required calls:

```text
GET  https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=%40tifloacosta
GET  https://www.googleapis.com/youtube/v3/subscriptions?part=id&mine=true&forChannelId=<channelId>&maxResults=1
GET  https://www.googleapis.com/youtube/v3/videos/getRating?id=<videoId>
POST https://www.googleapis.com/youtube/v3/subscriptions?part=snippet
POST https://www.googleapis.com/youtube/v3/videos/rate?id=<videoId>&rating=like
POST https://www.googleapis.com/youtube/v3/commentThreads?part=snippet
```

Expected subscribe body:

```json
{
  "snippet": {
    "resourceId": {
      "kind": "youtube#channel",
      "channelId": "CHANNEL_ID"
    }
  }
}
```

Expected comment body:

```json
{
  "snippet": {
    "videoId": "VIDEO_ID",
    "topLevelComment": {
      "snippet": {
        "textOriginal": "Texto del comentario"
      }
    }
  }
}
```

- [ ] **Step 2: Verify failure**

Run: `node --test youtube-worker/test/youtube-api.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement a single authenticated request helper**

```js
async function youtubeFetch(path, { accessToken, method = 'GET', body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`https://www.googleapis.com/youtube/v3/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw await youtubeError(response);
  if (response.status === 204) return null;
  return response.json();
}
```

Only the five operations listed in the Interfaces block may be exported from this module.

- [ ] **Step 4: Implement state resolution**

Return normalized state:

```js
{
  subscribed: true,
  rating: 'like'
}
```

Allowed rating values normalized to `'like'`, `'dislike'`, `'none'`; the frontend will never offer a dislike action.

- [ ] **Step 5: Make subscription idempotent**

`subscribe()` first checks `subscriptions.list`. If an item exists, return `{ subscribed: true, changed: false }`; otherwise insert and return `{ subscribed: true, changed: true }`.

- [ ] **Step 6: Map YouTube errors**

Normalize at least:

```js
{
  code: 'COMMENTS_DISABLED' | 'VIDEO_NOT_FOUND' | 'AUTH_REVOKED' | 'YOUTUBE_ERROR',
  status: number
}
```

Do not include Google response bodies in values returned to the browser.

- [ ] **Step 7: Run API client tests**

Run: `node --test youtube-worker/test/youtube-api.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add youtube-worker/src/youtube-api.js youtube-worker/test/youtube-api.test.mjs
git commit -m "feat: add restricted YouTube API actions"
```

---

### Task 5: Authenticated Worker routes and token renewal

**Files:**
- Modify: `youtube-worker/src/index.js`
- Modify: `youtube-worker/src/google-oauth.js`
- Modify: `youtube-worker/test/routes.test.mjs`

**Interfaces:**
- Produces `GET /state?videoId=...`, `POST /subscribe`, `POST /like`, `POST /comment`.
- POST body formats:
  - `/subscribe`: `{}`
  - `/like`: `{ "videoId": "abcdefghijk" }`
  - `/comment`: `{ "videoId": "abcdefghijk", "text": "..." }`

- [ ] **Step 1: Write failing route tests for authenticated state/actions**

Cover:
- no session -> `401 { error: 'SESSION_EXPIRED' }`;
- invalid videoId -> 400;
- wrong Origin -> 403 for POST;
- missing/wrong CSRF -> 403;
- state returns `{ authenticated: true, subscribed, rating }`;
- subscribe idempotent;
- like success;
- empty comment -> 400;
- comments disabled -> 409 `{ error: 'COMMENTS_DISABLED' }`;
- revoked refresh token -> 401 and clear session cookie.

- [ ] **Step 2: Verify failure**

Run: `node --test youtube-worker/test/routes.test.mjs`

Expected: FAIL on new routes.

- [ ] **Step 3: Implement one access-token helper**

```js
async function authenticatedContext(request, env) {
  const session = await readSession(request, env.YOUTUBE_SESSION_SECRET);
  if (!session) throw appError('SESSION_EXPIRED', 401);
  try {
    const token = await refreshAccessToken({
      refreshToken: session.refreshToken,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    });
    return { session, accessToken: token.access_token };
  } catch {
    throw appError('SESSION_EXPIRED', 401, { clearSession: true });
  }
}
```

Never send `accessToken` outside the Worker.

- [ ] **Step 4: Implement GET state**

Validate query `videoId`, call `getAccountVideoState`, return only:

```json
{
  "authenticated": true,
  "subscribed": false,
  "rating": "none"
}
```

- [ ] **Step 5: Implement mutation routes with Origin and CSRF before YouTube calls**

Order of checks must be:
1. exact allowed Origin;
2. valid session;
3. valid `X-CSRF-Token`;
4. input validation;
5. YouTube request.

- [ ] **Step 6: Sanitize all errors at the router boundary**

Browser-visible error codes allowed:

```text
SESSION_EXPIRED
CSRF_INVALID
INVALID_VIDEO
INVALID_COMMENT
COMMENTS_DISABLED
VIDEO_NOT_FOUND
YOUTUBE_UNAVAILABLE
NOT_FOUND
```

No stack trace, OAuth token, Google body or secret may appear in JSON responses.

- [ ] **Step 7: Run complete Worker suite**

Run: `cd youtube-worker && npm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add youtube-worker/src youtube-worker/test
git commit -m "feat: expose protected YouTube action endpoints"
```

---

### Task 6: Frontend state model and public “Ver detalles” without authentication

**Files:**
- Create: `youtube-actions-config.js`
- Create: `youtube-actions-core.js`
- Create: `test/youtube-actions-core.test.mjs`

**Interfaces:**
- Produces global `window.TifloYouTubeActionsCore` following existing non-module browser pattern.
- Core functions: `initialState()`, `reduce(state, event)`, `isValidVideoId(id)`, `detailsFromVideo(video)`, `copyFor(lang)`.

- [ ] **Step 1: Write failing core tests**

Required cases:

```js
test('unauthenticated state never exposes private actions', () => {
  const state = core.reduce(core.initialState(), { type: 'SESSION', authenticated: false });
  assert.equal(state.authenticated, false);
  assert.equal(state.canSubscribe, false);
  assert.equal(state.canLike, false);
  assert.equal(state.canComment, false);
});

test('details are derived only from the existing catalog video', () => {
  const video = { id: 'abcdefghijk', title: 'Título', publishedAt: '2026-09-20T10:00:00Z', description: 'Descripción', url: 'https://www.youtube.com/watch?v=abcdefghijk' };
  assert.deepEqual(core.detailsFromVideo(video), video);
});

test('authenticated unsubscribed state makes subscription primary action available', () => {
  let state = core.reduce(core.initialState(), { type: 'SESSION', authenticated: true, csrf: 'x' });
  state = core.reduce(state, { type: 'VIDEO_STATE', subscribed: false, rating: 'none' });
  assert.equal(state.canSubscribe, true);
  assert.equal(state.canLike, true);
  assert.equal(state.canComment, true);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test test/youtube-actions-core.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Create public config**

`youtube-actions-config.js`:

```js
window.TifloYouTubeActionsConfig = Object.freeze({
  endpoint: 'https://youtube-auth.tifloacosta.com'
});
```

No client secret, OAuth token or API secret belongs here.

- [ ] **Step 4: Implement core state machine**

State shape:

```js
{
  authenticated: false,
  csrf: '',
  loading: false,
  subscribed: null,
  rating: 'none',
  commentOpen: false,
  message: '',
  error: ''
}
```

Events must include `RESET`, `SESSION`, `VIDEO_STATE`, `SUBSCRIBED`, `LIKED`, `COMMENT_OPEN`, `COMMENT_CLOSE`, `MESSAGE`, `ERROR`.

- [ ] **Step 5: Add exact Spanish and English copy keys**

At minimum:

```js
{
  heading: 'Acciones de YouTube',
  details: 'Ver detalles',
  connect: 'Iniciar sesión en YouTube',
  subscribe: 'Suscribirme al canal TifloAcosta',
  subscribed: 'Ya estás suscrito al canal TifloAcosta',
  like: 'Me gusta este vídeo',
  liked: 'Ya has marcado Me gusta en este vídeo',
  comment: 'Comentar este vídeo',
  publish: 'Publicar comentario',
  cancel: 'Cancelar',
  logout: 'Cerrar sesión de YouTube en TifloAcosta'
}
```

English equivalents are required in the same object.

- [ ] **Step 6: Run core tests**

Run: `node --test test/youtube-actions-core.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add youtube-actions-config.js youtube-actions-core.js test/youtube-actions-core.test.mjs
git commit -m "feat: model accessible YouTube action states"
```

---

### Task 7: Accessible YouTube actions UI isolated inside the existing player

**Files:**
- Create: `youtube-actions.js`
- Create: `youtube-actions.css`
- Create: `test/youtube-actions-integration.test.mjs`
- Modify: `videos.html`

**Interfaces:**
- `window.TifloYouTubeActions.init()`
- `window.TifloYouTubeActions.showVideo(video, lang)`
- `window.TifloYouTubeActions.hide()`
- `window.TifloYouTubeActions.setLanguage(lang)`
- `window.TifloYouTubeActions.takePendingVideoId()`

- [ ] **Step 1: Write failing HTML contract test**

Require a new section inside `#video-player-section`, after the existing playback controls and before closing/open-in-YouTube controls:

```html
<section id="youtube-actions" aria-labelledby="youtube-actions-heading">
  <h3 id="youtube-actions-heading">Acciones de YouTube</h3>
  <button id="youtube-details" type="button">Ver detalles</button>
  <div id="youtube-details-panel" hidden></div>
  <div id="youtube-account-actions"></div>
  <p id="youtube-actions-status" class="muted" aria-live="polite" aria-atomic="true"></p>
</section>
```

The test must also assert that existing IDs remain present unchanged:
`video-player-rewind`, `video-player-toggle`, `video-player-forward`, `video-player-close`, `video-player-youtube`.

- [ ] **Step 2: Run integration test and verify failure**

Run: `node --test test/youtube-actions-integration.test.mjs test/video-player-controls.test.mjs`

Expected: new test FAIL; existing video player tests PASS.

- [ ] **Step 3: Insert markup and isolated asset references**

Add:

```html
<link rel="stylesheet" href="youtube-actions.css?v=1.0">
```

and before `videos.js`:

```html
<script src="youtube-actions-config.js?v=1.0"></script>
<script src="youtube-actions-core.js?v=1.0"></script>
<script src="youtube-actions.js?v=1.0"></script>
```

Bump `videos.js` query version only when Task 8 modifies it.

- [ ] **Step 4: Implement public details interaction first**

`showVideo(video, lang)` always renders `Ver detalles`, even if the Worker is unreachable. Details panel contains semantic text for title, publication date, description and the existing YouTube URL. It does not fetch a second catalog.

- [ ] **Step 5: Implement session discovery with failure isolation**

Request:

```js
fetch(`${endpoint}/session`, {
  method: 'GET',
  credentials: 'include',
  headers: { Accept: 'application/json' }
})
```

On network failure, render a brief connection message and keep `Ver detalles`; do not throw into `videos.js`.

- [ ] **Step 6: Render unauthenticated UI**

Show `Iniciar sesión en YouTube` only when session is absent/expired. Clicking it:
1. stores active video ID as `tifloYoutubePendingVideo` in `sessionStorage`;
2. navigates to `https://youtube-auth.tifloacosta.com/auth/start`.

- [ ] **Step 7: Implement accessible DOM/focus rules**

Use native `button`, `label`, `textarea` only. `aria-live` receives outcome messages. Opening the comment editor focuses its textarea. Cancel returns focus to `Comentar este vídeo`. Successful actions retain focus in the action block and announce the changed state.

- [ ] **Step 8: Style only namespaced selectors**

Every rule in `youtube-actions.css` starts with `.youtube-actions-` or `#youtube-actions`; do not alter `.video-player-*`, `.site-*`, generic `button`, `a`, `main`, or global layout selectors.

- [ ] **Step 9: Run tests**

Run: `node --test test/youtube-actions-integration.test.mjs test/video-player-controls.test.mjs`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add youtube-actions.js youtube-actions.css videos.html test/youtube-actions-integration.test.mjs
git commit -m "feat: add isolated accessible YouTube actions panel"
```

---

### Task 8: Subscribe, Like, Comment and Logout UI behavior

**Files:**
- Modify: `youtube-actions.js`
- Modify: `youtube-actions-core.js`
- Modify: `test/youtube-actions-core.test.mjs`
- Modify: `test/youtube-actions-integration.test.mjs`

**Interfaces:**
- Uses Worker routes from Tasks 3–5.
- No new dependency on `videos.js` beyond active video data.

- [ ] **Step 1: Add failing rendering tests for account states**

Cover exact behavior:
- authenticated + `subscribed:false` -> first private action button text is `Suscribirme al canal TifloAcosta`;
- authenticated + `subscribed:true` -> no subscribe button; visible status `Ya estás suscrito al canal TifloAcosta`;
- `rating:'like'` -> no action to remove Like;
- `rating:'none'` or `'dislike'` -> offer only `Me gusta este vídeo`;
- comment publish disabled while textarea `.value.trim()` is empty;
- no “No me gusta”, “Cancelar suscripción” or “Retirar Me gusta” controls.

- [ ] **Step 2: Implement generic authenticated request helper**

```js
async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(`${endpoint}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || 'YOUTUBE_UNAVAILABLE'), { code: payload.error, status: response.status });
  return payload;
}
```

- [ ] **Step 3: Load account state after authenticated session**

Request `/state?videoId=${encodeURIComponent(video.id)}`. Render subscription first, then Like, then Comment, then Logout.

- [ ] **Step 4: Implement one-press subscription**

On click:
- disable only the subscribe button during request;
- `POST /subscribe` with `{}`;
- on success reduce state with `SUBSCRIBED`;
- replace button with text state;
- announce exactly `Suscripción realizada. Ya estás suscrito al canal TifloAcosta.` in Spanish and corresponding English text;
- do not move focus outside `#youtube-actions`.

- [ ] **Step 5: Implement Like**

`POST /like` with `{ videoId }`. On success replace action with informative state and announce completion. Never expose unlike/dislike controls.

- [ ] **Step 6: Implement comment editor and explicit publish**

Markup generated by JS:

```html
<label for="youtube-comment-text">Comentario</label>
<textarea id="youtube-comment-text"></textarea>
<button id="youtube-comment-publish" type="button" disabled>Publicar comentario</button>
<button id="youtube-comment-cancel" type="button">Cancelar</button>
```

Input event toggles `disabled` using `textarea.value.trim().length === 0`.

Publish sends:

```js
api('/comment', { method: 'POST', body: { videoId: activeVideo.id, text: textarea.value.trim() } });
```

On success close editor and announce `Comentario publicado en YouTube.`

- [ ] **Step 7: Map safe errors to human messages**

Required mappings in ES/EN:
- `SESSION_EXPIRED` -> login action returns;
- `COMMENTS_DISABLED` -> `YouTube no permite comentarios en este vídeo.`;
- `VIDEO_NOT_FOUND` -> video action unavailable;
- default -> `No se pudo conectar con YouTube. Puedes seguir viendo el vídeo y volver a intentarlo.`

- [ ] **Step 8: Implement Logout**

`POST /logout`, then reset to unauthenticated state. Wording must say `Cerrar sesión de YouTube en TifloAcosta`; do not imply logging out of Google or the YouTube app.

- [ ] **Step 9: Run frontend tests**

Run: `node --test test/youtube-actions-core.test.mjs test/youtube-actions-integration.test.mjs`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add youtube-actions.js youtube-actions-core.js test/youtube-actions-core.test.mjs test/youtube-actions-integration.test.mjs
git commit -m "feat: support subscribe like and comment actions"
```

---

### Task 9: Minimal integration with `videos.js`, language and OAuth return

**Files:**
- Modify: `videos.js`
- Modify: `videos.html`
- Modify: `test/video-player-controls.test.mjs`
- Modify: `test/youtube-actions-integration.test.mjs`

**Interfaces:**
- `videos.js` calls only `TifloYouTubeActions.showVideo`, `hide`, `setLanguage`, `takePendingVideoId`.

- [ ] **Step 1: Add regression test proving existing player methods remain**

Keep all existing assertions and add assertions that `videos.js` still contains:

```text
new YT.Player(els.playerFrame
getCurrentTime()
seekTo(
playVideo()
pauseVideo()
trigger.focus()
els.controlsSection.hidden = true
els.resultsSection.hidden = true
```

- [ ] **Step 2: Add failing integration assertions for minimal hooks**

Require:

```js
window.TifloYouTubeActions?.showVideo(activeVideo, lang);
window.TifloYouTubeActions?.hide();
window.TifloYouTubeActions?.setLanguage(lang);
```

and pending-video recovery after the catalog has loaded.

- [ ] **Step 3: Modify `openPlayer(video)` only after existing player state is established**

Append, do not replace existing logic:

```js
window.TifloYouTubeActions?.showVideo(video, lang);
```

If this call throws, catch locally so the player remains open.

- [ ] **Step 4: Modify close path**

Before/after existing focus restoration, call:

```js
try { window.TifloYouTubeActions?.hide(); } catch {}
```

Do not change the existing `trigger.focus()` behavior.

- [ ] **Step 5: Forward language changes**

At the end of `applyLanguage()`:

```js
try { window.TifloYouTubeActions?.setLanguage(lang); } catch {}
```

- [ ] **Step 6: Restore pending video after catalog load**

After `videos.json` has populated `catalog`, request:

```js
const pendingId = window.TifloYouTubeActions?.takePendingVideoId?.() || '';
const pendingVideo = catalog.find(video => videoId(video) === pendingId);
if (pendingVideo) openPlayer(pendingVideo);
```

Only consume the stored ID once. If no matching public video exists, continue normally and clear the pending value.

- [ ] **Step 7: Remove OAuth result query without losing history context**

After processing `youtube_auth=ok|error`, use `history.replaceState` to remove that one query parameter so refresh does not repeat announcements. Do not rewrite unrelated query parameters.

- [ ] **Step 8: Bump asset version**

Change `videos.js?v=2.3` to `videos.js?v=2.4`. Version new YouTube assets as `v=1.0`.

- [ ] **Step 9: Run video + action tests**

Run: `node --test test/video-player-controls.test.mjs test/youtube-actions-core.test.mjs test/youtube-actions-integration.test.mjs`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add videos.js videos.html test/video-player-controls.test.mjs test/youtube-actions-integration.test.mjs
git commit -m "feat: connect YouTube actions to existing video player"
```

---

### Task 10: CI, cache safety and regression gate

**Files:**
- Create or Modify: `.github/workflows/test-youtube-actions.yml`
- Modify only if required: `sw.js`
- Test: existing root tests + `youtube-worker/test/*.test.mjs`

**Interfaces:**
- CI must test frontend and Worker without real Google credentials.

- [ ] **Step 1: Add CI workflow that runs both suites**

Workflow commands:

```yaml
- run: npm test
- run: npm test
  working-directory: youtube-worker
```

No secret is required because all OAuth/YouTube network calls are mocked in tests.

- [ ] **Step 2: Run the complete root suite locally**

Run: `npm test`

Expected: all existing tests plus new frontend tests PASS.

- [ ] **Step 3: Run Worker suite**

Run: `cd youtube-worker && npm test`

Expected: PASS.

- [ ] **Step 4: Inspect service-worker caching before changing it**

If `youtube-actions.js`, `youtube-actions-core.js`, `youtube-actions-config.js` and `youtube-actions.css` are not precached, leave the cache list unchanged and rely on versioned requests. If the service worker explicitly precaches all page assets, add the new versioned asset paths and bump only the cache name necessary to activate them.

Do not alter navigation timeout/network-fallback logic.

- [ ] **Step 5: Run regression file guard**

Run:

```bash
git diff --name-only main...HEAD
```

Must not contain:

```text
download-worker/
download-config.js
downloads.js
downloads-core.js
downloads-hub.js
actualidad.js
actualidad-core.js
```

unless an independently explained regression fix became necessary. If any appears unexpectedly, stop and revert that change before continuing.

- [ ] **Step 6: Commit CI/cache changes**

```bash
git add .github/workflows/test-youtube-actions.yml sw.js
git commit -m "test: gate YouTube actions against regressions"
```

If `sw.js` did not need modification, omit it from `git add`.

---

### Task 11: Privacy and OAuth deployment runbook

**Files:**
- Create: `docs/youtube-oauth-setup.md`
- Modify: appropriate public file under `privacidad/` only if its current text does not explain Google/YouTube OAuth.

**Interfaces:**
- Human setup for Google Cloud and Cloudflare; no credentials committed.

- [ ] **Step 1: Document exact Google OAuth settings**

`docs/youtube-oauth-setup.md` must contain:

```text
Application type: Web application
Homepage: https://tifloacosta.com/
Authorized redirect URI: https://youtube-auth.tifloacosta.com/auth/callback
Scope used by the app: https://www.googleapis.com/auth/youtube.force-ssl
```

It must explicitly say never to paste the client secret into `youtube-actions-config.js`, GitHub Pages, HTML or public repository files.

- [ ] **Step 2: Document exact Worker secrets**

Commands to execute from `youtube-worker/`:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put YOUTUBE_SESSION_SECRET
```

`YOUTUBE_SESSION_SECRET` must be a newly generated high-entropy value used only for this Worker.

- [ ] **Step 3: Ensure privacy text covers the feature**

Public privacy wording must communicate these facts, without legal overclaim:
- Google authorization occurs on Google;
- TifloAcosta does not receive the Google/YouTube password;
- authorization is used to perform only actions explicitly requested in TifloAcosta;
- session can be closed in TifloAcosta;
- Google account authorization can be managed from the user's Google account.

- [ ] **Step 4: Commit documentation/privacy change**

```bash
git add docs/youtube-oauth-setup.md privacidad
git commit -m "docs: document YouTube OAuth privacy and setup"
```

---

### Task 12: Staged deployment and accessible manual verification

**Files:**
- No product-code changes expected; fixes discovered by testing return to the owning task with a new failing test first.

**Interfaces:**
- Worker deployed independently from Pages.

- [ ] **Step 1: Deploy Worker before exposing frontend integration publicly**

From `youtube-worker/` after secrets exist:

```bash
npm test
npx wrangler deploy
```

Verify:

```text
https://youtube-auth.tifloacosta.com/health
```

Expected JSON:

```json
{ "ok": true, "service": "youtube-actions" }
```

- [ ] **Step 2: Test OAuth with a dedicated test Google/YouTube account**

Verify first authorization, callback, session recognition, reload without repeated login, logout, and re-login. Do not use personal production credentials in automated tests or repository files.

- [ ] **Step 3: Test subscription with test account**

From an unsubscribed state verify:
1. button is `Suscribirme al canal TifloAcosta`;
2. one activation subscribes;
3. announcement confirms success;
4. button disappears;
5. reload shows `Ya estás suscrito al canal TifloAcosta`.

Do not test an unsubscribe path because it must not exist.

- [ ] **Step 4: Test Like and comment**

Verify existing Like is detected, new Like becomes informative state, empty comment cannot publish, valid comment requires explicit Publish, comments-disabled error stays inside action block, and video playback continues in all cases.

- [ ] **Step 5: Verify Windows accessibility**

With JAWS, then NVDA:
- open catalog;
- open a video;
- confirm old catalog chrome remains isolated;
- use all three existing playback controls;
- find YouTube actions in logical order;
- perform OAuth round trip;
- confirm same video reopens;
- subscribe/Like/comment;
- close player and confirm focus returns to selected video.

- [ ] **Step 6: Verify iPhone accessibility**

With VoiceOver repeat the same flow, paying special attention to return from Google/browser authorization into the installed PWA or browser context and recovery of the same video.

- [ ] **Step 7: Verify Android accessibility**

With TalkBack repeat the same flow. Confirm that authorization uses the web flow and does not depend on the YouTube Android app being signed in. Confirm return to `videos.html`, same-video recovery, action order and focus/context.

- [ ] **Step 8: Final automated verification before merge**

Run:

```bash
npm test
cd youtube-worker && npm test
```

Expected: all PASS.

Then check GitHub Actions on the feature branch and require green status before opening/merging the production PR.

- [ ] **Step 9: Final diff review**

Confirm again that the branch did not alter Downloads, Actualidad, apex Cloudflare routing, or existing playback behavior.

- [ ] **Step 10: Merge only after manual platform checks are recorded as successful**

The PR description must list Windows/JAWS, Windows/NVDA, iPhone/VoiceOver and Android/TalkBack results separately. If any platform remains untested, state it explicitly and do not call the feature complete.
