import crypto from 'node:crypto';
import { createAnalyticsClient } from './apple-analytics-reports.mjs';

const { API_ID, API_ISSUER, API_PRIVATE } = process.env;
if (![API_ID, API_ISSUER, API_PRIVATE].every(Boolean)) throw new Error('Faltan credenciales permanentes de Apple Analytics.');
let privateKey = API_PRIVATE.trim().replace(/^['"]|['"]$/g, '').replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
if (!privateKey.includes('-----BEGIN')) privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
const encode = x => Buffer.from(JSON.stringify(x)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = encode({ alg: 'ES256', kid: API_ID, typ: 'JWT' }) + '.' +
  encode({ iss: API_ISSUER, iat: now - 30, exp: now + 600, aud: 'appstoreconnect-v1' });
const token = unsigned + '.' + crypto.sign('sha256', Buffer.from(unsigned), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const client = createAnalyticsClient({ token });
const requestId = 'b26b6c8c-d699-48b1-8b62-cd66071c81ee';
const reports = await client.listReports(requestId);
const selected = reports.filter(x => /Download|Install|Delet|Session|Engagement|Preview/i.test(x.attributes?.name || '')).slice(0, 35);
const overview = [];
for (const report of selected) {
  const instances = await client.listInstances(report.id);
  overview.push({
    name: report.attributes.name,
    category: report.attributes.category,
    instances: instances.length,
    newestProcessingDate: instances.map(x => x.attributes?.processingDate).filter(Boolean).sort().at(-1) ?? null
  });
}
const result = { requestId, reportTypes: reports.length, selectedReportTypes: selected.length, inspected: overview, inspectedAt: new Date().toISOString() };
console.log(JSON.stringify(result, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n## Informes disponibles por tipo\n\n\x60\x60\x60json\n' + JSON.stringify(result, null, 2) + '\n\x60\x60\x60\n');
}
