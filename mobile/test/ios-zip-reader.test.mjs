import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { openIosZip } from '../src/core/ios-zip-reader.mjs';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function fixture(name, content, { deflate = false, damage = false } = {}) {
  const filename = Buffer.from(name, 'utf8');
  const data = Buffer.from(content, 'utf8');
  const compressed = deflate ? deflateRawSync(data) : data;
  const method = deflate ? 8 : 0, checksum = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(checksum + (damage ? 1 : 0), 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE(0, 42);
  const offset = local.length + filename.length + compressed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Blob([local, filename, compressed, central, filename, end]);
}
test('read stored ZIP from a Blob without network dependencies', async () => {
  const archive = await openIosZip(fixture('META-INF/container.xml', '<root>lector</root>'));
  assert.equal(await archive.file('META-INF/container.xml').async('string'), '<root>lector</root>');
});
test('read deflated EPUB chapter and verify its checksum', async () => {
  const archive = await openIosZip(fixture('OEBPS/chapter.xhtml', '<h1>Capítulo</h1>', { deflate: true }));
  assert.equal(await archive.file('OEBPS/chapter.xhtml').async('string'), '<h1>Capítulo</h1>');
});
test('detect a matching-size archive whose content checksum has changed', async () => {
  const archive = await openIosZip(fixture('file.txt', 'Texto', { damage: true }));
  await assert.rejects(archive.file('file.txt').async('string'), /archive-integrity-failed/);
});
test('reject traversal paths before any decompression', async () => {
  await assert.rejects(openIosZip(fixture('../outside.txt', 'bad')), /invalid-archive-path/);
});
