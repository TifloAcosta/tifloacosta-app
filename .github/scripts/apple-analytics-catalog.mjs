import crypto from 'node:crypto';
import { createAnalyticsClient, parseTsvGzip } from './apple-analytics-reports.mjs';
import { summarizeReportRows } from './apple-analytics-aggregate.mjs';

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

// Never infer metrics from an instance's existence: every segment must be fetched and checked.
const reports = await client.listReports(requestId);
const selected = reports.filter(x => /Download|Install|Delet|Session|Engagement|Preview/i.test(x.attributes?.name || '')).slice(0, 12);
const inspected = [];
for (const report of selected) {
  const instances = (await client.listInstances(report.id))
    .filter(x => x.id && x.attributes?.processingDate)
    .sort((a, b) => b.attributes.processingDate.localeCompare(a.attributes.processingDate))
    .slice(0, 2);
  for (const instance of instances) {
    const segments = await client.listSegments(instance.id);
    if (!segments.length) continue;
    const fieldNames = new Set();
    const dates = new Set();
    const metricTotals = new Map();
    let rows = 0;
    let metricColumn = null;
    let metricReliable = true;
    const breakdown = {};
    const checkedSegments = [];
    for (const segment of segments) {
      const gz = await client.downloadSegment(segment);
      const parsed = parseTsvGzip(gz);
      const summary = summarizeReportRows(parsed);
      for (const [dimension, values] of Object.entries(summary)) {
        if (dimension === 'metric') continue;
        const totals = breakdown[dimension] ||= {};
        for (const [key, value] of Object.entries(values)) {
          totals[key] = (totals[key] ?? 0) + value;
        }
      }
      checkedSegments.push({ id: segment.id, checksum: segment.attributes?.checksum ?? null, bytes: gz.length });
      if (!parsed.length) continue;
      const fields = Object.keys(parsed[0]);
      fields.forEach(f => fieldNames.add(f));
      const countKey = fields.find(f => /^(counts?|units?)$/i.test(f.trim()));
      if (!countKey) metricReliable = false;
      else if (metricColumn && metricColumn !== countKey) metricReliable = false;
      else metricColumn = countKey;
      for (const row of parsed) {
        rows++;
        if (row.Date) dates.add(row.Date);
        if (countKey) {
          const raw = row[countKey];
          if (!/^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$/.test(raw)) {
            metricReliable = false;
          } else {
            const dimension = row['Download Type'] || row['Event Type'] || 'total';
            metricTotals.set(dimension, (metricTotals.get(dimension) || 0) + Number(raw));
          }
        }
      }
    }
    inspected.push({
      report: report.attributes?.name ?? null,
      category: report.attributes?.category ?? null,
      instanceId: instance.id,
      processingDate: instance.attributes.processingDate,
      granularity: instance.attributes.granularity ?? null,
      segments: checkedSegments,
      segmentCount: checkedSegments.length,
      rows,
      dates: [...dates].sort(),
      fields: [...fieldNames].sort(),
      breakdown,
      // Omit totals altogether if this report lacks a trustworthy additive count column.
      ...(rows && metricReliable && metricColumn ? { countColumn: metricColumn, countsByType: Object.fromEntries([...metricTotals].sort()) } : {})
    });
  }
}
const result = { requestId, reportsAvailable: reports.length, selectedReports: selected.length, verifiedInstances: inspected, checkedAt: new Date().toISOString() };
console.log(JSON.stringify(result, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '\n## Segmentos descargados y verificados de Apple Analytics\n\n' +
    'Los totales solo aparecen si los segmentos ofrecen una columna aditiva de conteo verificable. Una lista vacía no equivale a cero descargas.\n\n' +
    '\x60\x60\x60json\n' + JSON.stringify(result, null, 2) + '\n\x60\x60\x60\n');
}
