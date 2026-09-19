const COMPOUND_EXTENSIONS = [
  'tar.gz','tar.bz2','tar.xz','tar.lz','tar.zst'
];

const DOWNLOAD_EXTENSIONS = new Set([
  'pdf','zip','rar','7z','txt','doc','docx','xls','xlsx','ppt','pptx','epub',
  'mp3','m4a','wav','ogg','flac','mp4','m4v','mov','webm','avi','mkv','apk','csv','json','xml',
  'exe','msi','dmg','pkg','deb','rpm','iso','cab',
  'tar','gz','tgz','bz2','xz','lz','lzma','zst',
  ...COMPOUND_EXTENSIONS
]);

function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function extensionFromName(name) {
  const value = String(name || '').toLowerCase().split(/[?#]/, 1)[0];
  for (const extension of COMPOUND_EXTENSIONS) {
    if (value.endsWith(`.${extension}`)) return extension;
  }
  const match = value.match(/\.([a-z0-9]{1,10})$/i);
  return match ? match[1] : '';
}

export function detectProvider(urlLike) {
  const url = urlLike instanceof URL ? urlLike : new URL(urlLike);
  const host = url.hostname.toLowerCase();
  if (hostMatches(host, 'drive.google.com')) return 'google-drive';
  if (hostMatches(host, 'dropbox.com')) return 'dropbox';
  if (host === '1drv.ms' || hostMatches(host, 'onedrive.live.com')) return 'onedrive';
  if (hostMatches(host, 'icloud.com')) return 'icloud-drive';
  if (hostMatches(host, 'box.com')) return 'box';
  if (hostMatches(host, 'mega.nz')) return 'mega';
  if (host === 'we.tl' || hostMatches(host, 'wetransfer.com')) return 'wetransfer';
  if (hostMatches(host, 'mediafire.com')) return 'mediafire';
  if (hostMatches(host, 'pcloud.link') || hostMatches(host, 'pcloud.com')) return 'pcloud';
  return 'web';
}

export function fileTypeFrom(name, contentType = '') {
  const extension = extensionFromName(name);
  if (extension) return extension;
  const type = String(contentType || '').toLowerCase().split(';')[0].trim();
  const known = {
    'application/pdf':'pdf', 'application/zip':'zip', 'application/x-7z-compressed':'7z',
    'application/vnd.rar':'rar', 'application/x-tar':'tar', 'application/gzip':'gz',
    'application/x-gzip':'gz', 'application/x-xz':'xz', 'application/x-bzip2':'bz2',
    'audio/mpeg':'mp3', 'audio/mp4':'m4a', 'audio/wav':'wav',
    'audio/ogg':'ogg', 'video/mp4':'mp4', 'video/webm':'webm', 'text/plain':'txt',
    'text/csv':'csv', 'application/json':'json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx'
  };
  return known[type] || 'unknown';
}

function decodeFilenameStar(value) {
  const match = String(value || '').match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (!match) return '';
  try { return decodeURIComponent(match[1].replace(/^"|"$/g, '')); }
  catch (error) { return match[1].replace(/^"|"$/g, ''); }
}

export function nameFromHeaders(urlLike, headersLike) {
  const url = urlLike instanceof URL ? urlLike : new URL(urlLike);
  const headers = headersLike instanceof Headers ? headersLike : new Headers(headersLike || {});
  const disposition = headers.get('content-disposition') || '';
  const starred = decodeFilenameStar(disposition);
  if (starred) return starred;
  const quoted = disposition.match(/filename\s*=\s*"([^"]+)"/i);
  if (quoted) return quoted[1];
  const bare = disposition.match(/filename\s*=\s*([^;]+)/i);
  if (bare) return bare[1].trim().replace(/^"|"$/g, '');
  const last = url.pathname.split('/').filter(Boolean).pop() || 'archivo';
  try { return decodeURIComponent(last); }
  catch (error) { return last; }
}

export function isLikelyDownloadLink(urlLike, attrs = {}) {
  const url = urlLike instanceof URL ? urlLike : new URL(urlLike);
  if (attrs.download !== null && attrs.download !== undefined) return true;
  const ext = extensionFromName(url.pathname);
  if (DOWNLOAD_EXTENSIONS.has(ext)) return true;
  const downloadParam = url.searchParams.get('download');
  const dlParam = url.searchParams.get('dl');
  return downloadParam === '1' || downloadParam === 'true' || dlParam === '1';
}

export function dedupeCandidates(items) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const url = String(item?.url || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(item);
  }
  return result;
}
