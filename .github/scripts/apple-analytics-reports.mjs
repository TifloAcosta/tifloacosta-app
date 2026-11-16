import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const API_ORIGIN = 'https://api.appstoreconnect.apple.com';
const MAX_SEGMENT_BYTES = 40 * 1024 * 1024;

function apiUrl(path) {
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/v1/')) {
    throw new Error('URL de API Apple no autorizada');
  }
  return url.toString();
}

export function createAnalyticsClient({ token, fetchImpl = fetch }) {
  if (!token) throw new Error('Falta el token de Apple');

  async function getPage(url) {
    const response = await fetchImpl(apiUrl(url), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
      redirect: 'error',
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error('Apple HTTP ' + response.status);
    const result = await response.json();
    if (!Array.isArray(result.data)) throw new Error('Respuesta de Apple no válida');
    return result;
  }

  async function list(path) {
    const items = [];
    let next = apiUrl(path);
    const visited = new Set();
    while (next) {
      if (visited.has(next)) throw new Error('Bucle de paginación Apple');
      visited.add(next);
      if (visited.size > 100) throw new Error('Demasiadas páginas de informes');
      const page = await getPage(next);
      items.push(...page.data);
      next = page.links?.next ? apiUrl(page.links.next) : null;
    }
    return items;
  }

  async function downloadSegment(segment) {
    const { url, sizeInBytes, checksum } = segment?.attributes || {};
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error('La URL del segmento debe usar https');
    }
    const checked = new URL(url);
    if (checked.username || checked.password) throw new Error('URL de segmento no autorizada');
    if (!Number.isSafeInteger(sizeInBytes) || sizeInBytes < 0 || sizeInBytes > MAX_SEGMENT_BYTES) {
      throw new Error('Tamaño de segmento no válido');
    }
    const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error('No se pudo descargar el segmento: HTTP ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== sizeInBytes) throw new Error('Tamaño de segmento no coincide');
    if (typeof checksum === 'string' && checksum.length) {
      if (createHash('md5').update(bytes).digest('hex').toLowerCase() !== checksum.toLowerCase()) {
        throw new Error('El checksum del segmento no coincide');
      }
    }
    return bytes;
  }

  return {
    listReports: requestId => list('/v1/analyticsReportRequests/' + encodeURIComponent(requestId) + '/reports?limit=100'),
    listInstances: reportId => list('/v1/analyticsReports/' + encodeURIComponent(reportId) + '/instances?limit=100'),
    listSegments: instanceId => list('/v1/analyticsReportInstances/' + encodeURIComponent(instanceId) + '/segments?limit=100'),
    downloadSegment
  };
}

export function parseTsvGzip(bytes) {
  const source = gunzipSync(bytes, { maxOutputLength: 60 * 1024 * 1024 }).toString('utf8').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/).filter(x => x.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
  });
}
