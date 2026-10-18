/**
 * Small, offline ZIP reader for EPUB and DAISY on iOS WebKit.
 * Only supports standard single-disk ZIP archives (stored or DEFLATE).
 * Every lookup is bounded and rejects traversal, encryption and ZIP64.
 * Uses Safari's native DecompressionStream, not a remote script.
 */
const MAX_ENTRIES = 5000;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const decoder = new TextDecoder('utf-8');

function invalid(reason = 'invalid-archive') {
  throw Object.assign(new Error(reason), { code: reason });
}
function checkedPath(name) {
  const path = String(name).replaceAll('\\', '/');
  if (!path || path.startsWith('/') || path.includes('\\0') ||
      path.split('/').some(part => part === '..' || part === '.') ||
      /^[a-z]:/i.test(path)) invalid('invalid-archive-path');
  return path;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function inflate(method, compressed, expected) {
  if (expected > MAX_ENTRY_BYTES) invalid('archive-entry-too-large');
  if (method === 0) {
    if (compressed.length !== expected) invalid('invalid-archive-size');
    return compressed;
  }
  if (method !== 8 || typeof DecompressionStream !== 'function') invalid('unsupported-archive-compression');
  const source = new Blob([compressed]);
  const reader = source.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > expected || length > MAX_ENTRY_BYTES) invalid('archive-entry-too-large');
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (length !== expected) invalid('invalid-archive-size');
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

/** Match the read-only subset of JSZip used by the existing DAISY/EPUB parsers. */
export async function openIosZip(blob) {
  if (!(blob instanceof Blob) || !blob.size || blob.size > MAX_ARCHIVE_BYTES) invalid('archive-size-unsupported');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = pos => view.getUint16(pos, true);
  const u32 = pos => view.getUint32(pos, true);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { eocd = i; break; }
  }
  if (eocd < 0 || u16(eocd + 4) || u16(eocd + 6) ||
      u16(eocd + 8) !== u16(eocd + 10)) invalid();
  const count = u16(eocd + 10), centralSize = u32(eocd + 12), centralOffset = u32(eocd + 16);
  if (count > MAX_ENTRIES || count === 0xffff || centralSize === 0xffffffff ||
      centralOffset === 0xffffffff || centralOffset + centralSize > eocd) invalid();
  let cursor = centralOffset, totalExpanded = 0;
  const files = Object.create(null), metadata = new Map();
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > bytes.length || u32(cursor) !== 0x02014b50) invalid();
    const flags = u16(cursor + 8), method = u16(cursor + 10);
    const checksum = u32(cursor + 16), packed = u32(cursor + 20), size = u32(cursor + 24);
    const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32);
    const offset = u32(cursor + 42);
    if (flags & 1 || ![0, 8].includes(method) || size === 0xffffffff ||
        packed === 0xffffffff || offset === 0xffffffff || size > MAX_ENTRY_BYTES ||
        cursor + 46 + nameLength + extraLength + commentLength > bytes.length) invalid();
    const name = checkedPath(decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)));
    cursor += 46 + nameLength + extraLength + commentLength;
    totalExpanded += size;
    if (totalExpanded > MAX_TOTAL_BYTES || metadata.has(name)) invalid();
    if (offset + 30 > bytes.length || u32(offset) !== 0x04034b50) invalid();
    const dataOffset = offset + 30 + u16(offset + 26) + u16(offset + 28);
    if (dataOffset + packed > bytes.length) invalid();
    const meta = { method, checksum, packed, size, dataOffset };
    metadata.set(name, meta);
    files[name] = { dir: name.endsWith('/') };
  }
  if (cursor !== centralOffset + centralSize) invalid();

  function file(name) {
    const key = String(name || '');
    const meta = metadata.get(key);
    if (!meta || files[key]?.dir) return null;
    return {
      async async(kind = 'uint8array') {
        const raw = bytes.subarray(meta.dataOffset, meta.dataOffset + meta.packed);
        const output = await inflate(meta.method, raw, meta.size);
        if (crc32(output) !== meta.checksum) invalid('archive-integrity-failed');
        if (kind === 'string' || kind === 'text') return decoder.decode(output);
        if (kind === 'uint8array') return output;
        if (kind === 'blob') return new Blob([output]);
        if (kind === 'arraybuffer') return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
        invalid('unsupported-archive-output');
      }
    };
  }
  return { files, file };
}
