// Read-only diagnosis: a VALID build linked to a group does not imply its tester can see it.
import crypto from 'node:crypto';

const { API_ID, API_ISSUER, API_PRIVATE } = process.env;
if (!API_ID || !API_ISSUER || !API_PRIVATE) throw Error('Falta la API de consulta Apple.');
let key = API_PRIVATE.trim().replace(/\\n/g, '\n');
if (!key.includes('-----BEGIN')) key = Buffer.from(key, 'base64').toString('utf8');
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const prefix = encode({ alg: 'ES256', kid: API_ID, typ: 'JWT' }) + '.' +
  encode({ iss: API_ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
const token = prefix + '.' + crypto.sign('sha256', Buffer.from(prefix),
  { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');

async function apple(path) {
  const response = await fetch('https://api.appstoreconnect.apple.com/v1/' + path,
    { headers: { Authorization: 'Bearer ' + token } });
  const body = await response.json();
  if (!response.ok) throw Error(`Apple HTTP ${response.status}: ` +
    JSON.stringify(body.errors || []).slice(0, 450));
  return body;
}

const apps = await apple('apps?filter%5BbundleId%5D=com.tifloacosta.app&limit=20');
const app = apps.data.find(x => x.attributes.bundleId === 'com.tifloacosta.app');
if (!app) throw Error('No aparece TifloAcosta en App Store Connect.');
const groups = await apple('betaGroups?filter%5Bapp%5D=' + app.id + '&limit=200');
for (const group of groups.data) {
  const name = group.attributes.name;
  const testers = await apple(`betaTesters?filter%5BbetaGroups%5D=${group.id}&limit=200`);
  const addresses = testers.data.map(t => (t.attributes.email || '').toLowerCase());
  const tonyMailboxFound = addresses.includes('tonytenerife@gmail.com');
  console.log(`Grupo ${name}: interno=${group.attributes.isInternalGroup}; ` +
    `miembros=${testers.data.length}; acceso_todas=${group.attributes.hasAccessToAllBuilds}; ` +
    `buzón_habitual_de_Tony=${tonyMailboxFound ? 'en_grupo' : 'no_consta'}`);
  const builds = await apple(`betaGroups/${group.id}/builds?limit=100`);
  const target = builds.data.find(b => String(b.attributes.version) === '500168');
  console.log(`Compilación 500168 asignada directamente a ${name}: ${Boolean(target)}`);
}
