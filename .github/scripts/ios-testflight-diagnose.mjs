import crypto from 'node:crypto';

const keyId = process.env.APPSTORE_API_KEY_ID;
const issuer = process.env.APPSTORE_API_ISSUER_ID;
let privateKey = (process.env.APPSTORE_API_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');
if (!keyId || !issuer || !privateKey) throw new Error('Missing App Store Connect credentials');
if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
if (!privateKey.includes('BEGIN PRIVATE KEY')) {
  const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
  if (!decoded.includes('BEGIN PRIVATE KEY')) throw new Error('Invalid App Store Connect key encoding');
  privateKey = decoded;
}
const enc = data => Buffer.from(JSON.stringify(data)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const signingInput = enc({ alg:'ES256', kid:keyId, typ:'JWT' }) + '.' +
  enc({ iss:issuer, iat:now, exp:now+900, aud:'appstoreconnect-v1' });
const signed = crypto.sign('sha256', Buffer.from(signingInput),
  { key: privateKey, dsaEncoding:'ieee-p1363' }).toString('base64url');
const token = signingInput + '.' + signed;

async function api(path, params={}) {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/' + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  const response = await fetch(url, { headers:{ Authorization:'Bearer ' + token } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = (result.errors || []).map(e => ({
      status:e.status, code:e.code, title:e.title, detail:e.detail
    }));
    throw new Error('App Store Connect ' + response.status + ' ' + path + ': ' + JSON.stringify(errors));
  }
  return result;
}

const apps = await api('apps', { 'filter[bundleId]':'com.tifloacosta.app', limit:10 });
const app = apps.data?.find(entry => entry.attributes?.bundleId === 'com.tifloacosta.app');
if (!app) throw new Error('TifloAcosta not found in App Store Connect');
console.log('APP', app.attributes?.name, 'id='+app.id);

const found = await api('builds', {
  'filter[app]':app.id, 'sort':'-uploadedDate', 'limit':30
});
const builds = found.data || [];
console.log('RECENT_BUILDS', builds.length);
const target = builds.find(b => b.attributes?.version === '200067');
console.log('TARGET_200067', target
  ? `id=${target.id} processing=${target.attributes?.processingState} uploaded=${target.attributes?.uploadedDate}`
  : 'NOT_VISIBLE_IN_APP_STORE_CONNECT_BUILDS_YET');
for (const build of builds.slice(0, 20)) {
  const a = build.attributes || {};
  console.log('BUILD', a.version, 'id='+build.id,
    'processing='+a.processingState,
    'audience='+a.buildAudienceType,
    'uploaded='+a.uploadedDate,
    'expired='+a.expired);
  if (['100063','100064','200062','200063','200064','200065','200066','200067'].includes(a.version)) {
    try {
      const details = await api('buildBetaDetails', { 'filter[build]':build.id, limit:10 });
      for (const d of details.data || []) console.log('BETA_DETAIL', a.version,
        'internal='+d.attributes?.internalBuildState,
        'external='+d.attributes?.externalBuildState,
        'autoNotify='+d.attributes?.autoNotifyEnabled);
      if (!details.data?.length) console.log('BETA_DETAIL', a.version, 'NOT_YET_AVAILABLE');
    } catch (error) {
      console.log('BETA_DETAIL_ERROR', a.version, error.message);
    }
  }
}
for (const version of ['100063','100064','200063','200064','200065','200066','200067']) {
  if (!builds.some(b => b.attributes?.version === version)) console.log('BUILD_' + version + '_NOT_VISIBLE_IN_APP_STORE_CONNECT_API');
}

try {
  const uploads = await api('apps/' + app.id + '/buildUploads', {
    sort:'-uploadedDate', limit:60
  });
  console.log('UPLOAD_COUNT', uploads.data?.length || 0);
  for (const upload of (uploads.data || []).slice(0, 25)) {
    const a = upload.attributes || {};
    const state = a.state || {};
    console.log('UPLOAD', a.cfBundleVersion,
      'release='+a.cfBundleShortVersionString,
      'status='+JSON.stringify(state.state ?? state),
      'date='+a.uploadedDate,
      'errors='+JSON.stringify(state.errors || []).slice(0, 1600),
      'warnings='+JSON.stringify(state.warnings || []).slice(0, 600));
  }
} catch (error) {
  console.log('UPLOAD_STATUS_QUERY_ERROR', error.message);
}

for (const version of ['100063','100064','200063','200064','200065','200066','200067']) {
  try {
    const exact = await api('apps/' + app.id + '/buildUploads', {
      'filter[cfBundleVersion]':version, limit:20
    });
    if (!(exact.data || []).length) console.log('EXACT_UPLOAD', version, 'NOT_LISTED');
    for (const entry of exact.data || []) {
      const a = entry.attributes || {};
      console.log('EXACT_UPLOAD', version, 'status='+JSON.stringify(a.state || {}),
        'created='+a.createdDate, 'uploaded='+a.uploadedDate);
    }
  } catch (error) { console.log('EXACT_UPLOAD_ERROR', version, error.message); }
}

const groups = await api('apps/' + app.id + '/betaGroups', { limit:100 });
console.log('BETA_GROUPS', groups.data?.length || 0);
for (const group of groups.data || []) {
  const a = group.attributes || {};
  console.log('GROUP', a.name, 'id='+group.id,
    'internal='+a.isInternalGroup,
    'allBuilds='+a.hasAccessToAllBuilds);
  try {
    const related = await api('betaGroups/' + group.id + '/builds', { limit:100 });
    const versions = (related.data || []).map(b => b.attributes?.version).filter(Boolean);
    console.log('GROUP_BUILDS', a.name, versions.slice(0, 18).join(',') || '(empty)',
      'has200063='+versions.includes('200063'),
      'has100064='+versions.includes('100064'),
      'has200066='+versions.includes('200066'),
      'has200067='+versions.includes('200067'));
  } catch (error) { console.log('GROUP_BUILDS_ERROR', a.name, error.message); }
  try {
    const testers = await api('betaGroups/' + group.id + '/betaTesters', { limit:50 });
    console.log('GROUP_TESTERS_COUNT', a.name, testers.data?.length || 0);
  } catch (error) { console.log('GROUP_TESTERS_ERROR', a.name, error.message); }
}
