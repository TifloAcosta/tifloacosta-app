import { chooseNextVersionCode, createGoogleAccessToken, createPlayReleaseClient } from './google-play-release.mjs';
import { sendUpdateNotification } from './onesignal-release-notification.mjs';

const PACKAGE_NAME = 'com.tifloacosta.app';
const DEFAULT_ONESIGNAL_APP_ID = 'ed030723-7f6f-4745-8cd3-6938a9d04377';

function requiredEnv(env, key) {
  const value = typeof env?.[key] === 'string' ? env[key].trim() : '';
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function parseServiceAccount(env) {
  const raw = requiredEnv(env, 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
    return parsed;
  } catch {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is invalid JSON');
  }
}

function localCode(localState = {}) {
  const value = Number(localState.lastSuccessfulVersionCode || 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export async function resolveVersionCode({
  localState = {}, publish = false, env = process.env,
  getAccessToken = createGoogleAccessToken,
  makeClient = options => createPlayReleaseClient(options)
} = {}) {
  const remembered = localCode(localState);
  if (!publish) {
    return { versionCode: chooseNextVersionCode({ playCodes: [], localCode: remembered }), source: 'local' };
  }
  const serviceAccount = parseServiceAccount(env);
  const accessToken = await getAccessToken(serviceAccount);
  const client = makeClient({ packageName: PACKAGE_NAME, accessToken });
  const edit = await client.createEdit();
  const bundles = await client.listBundles(edit.id);
  const playCodes = bundles.map(bundle => Number(bundle?.versionCode)).filter(Number.isInteger);
  return { versionCode: chooseNextVersionCode({ playCodes, localCode: remembered }), source: 'google-play' };
}

export async function publishRelease({
  request, versionCode, bundle, env = process.env,
  getAccessToken = createGoogleAccessToken,
  makeClient = options => createPlayReleaseClient(options),
  sendNotification = sendUpdateNotification
} = {}) {
  if (!request || typeof request !== 'object') throw new TypeError('request is required');
  if (!Number.isInteger(versionCode) || versionCode < 1) throw new TypeError('versionCode must be positive');
  if (!bundle || (typeof bundle.length === 'number' && bundle.length === 0)) throw new TypeError('bundle is required');

  const serviceAccount = parseServiceAccount(env);
  const oneSignalKey = request.notifyUpdate ? requiredEnv(env, 'ONESIGNAL_REST_API_KEY') : '';
  const oneSignalAppId = request.notifyUpdate && typeof env.ONESIGNAL_APP_ID === 'string' && env.ONESIGNAL_APP_ID.trim()
    ? env.ONESIGNAL_APP_ID.trim()
    : DEFAULT_ONESIGNAL_APP_ID;

  const accessToken = await getAccessToken(serviceAccount);
  const client = makeClient({ packageName: PACKAGE_NAME, accessToken });
  const edit = await client.createEdit();
  await client.uploadBundle(edit.id, bundle);
  await client.updateTrack(edit.id, { ...request, versionCode });
  await client.validateEdit(edit.id);
  await client.commitEdit(edit.id);

  let notificationSent = false;
  if (request.notifyUpdate) {
    await sendNotification({ appId: oneSignalAppId, apiKey: oneSignalKey, versionName: request.versionName });
    notificationSent = true;
  }
  return { committed: true, notificationSent };
}
