import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ext = load('ShareExtension/ShareViewController.swift');
const formats = load('Sources/NativeReaderFormats.swift');
const inbox = load('Sources/NativeShareInbox.swift');

test('DAISY and ZIP use a 750 MB file-transfer ceiling, not the old 100 MB limit', () => {
  assert.match(ext, /private let maxArchiveBytes: Int64 = 750_000_000/);
  assert.match(ext, /ext == "zip" \|\| ext == "daisy" \? maxArchiveBytes : maxInMemoryBytes/);
  assert.match(ext, /let limit = fileTransferLimit\(for: clean\)/);
  assert.match(ext, /fileSize\.int64Value <= limit/);
  assert.match(ext, /provider\.loadFileRepresentation\(forTypeIdentifier: identifier\)/);
  assert.match(ext, /try manager\.copyItem\(at: file, to: destination\)/);
  assert.doesNotMatch(ext, /Int64\(size\) <= maxBytes/);
});

test('data-only providers remain bounded to 100 MiB to avoid allocating huge buffers', () => {
  assert.match(ext, /private let maxInMemoryBytes: Int64 = 100 \* 1024 \* 1024/);
  assert.match(ext, /Int64\(data\.count\) <= self\.maxInMemoryBytes/);
  assert.doesNotMatch(ext, /Int64\(data\.count\) <= self\.maxArchiveBytes/);
});

test('reader applies the same decompressed safety limit to ZIP and .daisy', () => {
  assert.match(formats, /\(ext == "zip" \|\| ext == "daisy"\) \? 750_000_000 : 250_000_000/);
  assert.match(formats, /entries <= 4000/);
  assert.match(formats, /total <= sizeLimit/);
  assert.match(formats, /guard isDaisy \|\| \(ext == "zip" && !audioFiles\.isEmpty\)/);
});

test('incoming share remains in the inbox on import errors and preserves the source extension', () => {
  assert.match(inbox, /let originalName = URL\(fileURLWithPath: item\.name\)\.lastPathComponent/);
  assert.match(inbox, /try FileManager\.default\.linkItem\(at: source, to: named\)/);
  assert.match(inbox, /try FileManager\.default\.copyItem\(at: source, to: named\)/);
  assert.match(inbox, /try library\.importDocuments\(from: \[named\], sharingID: sharingID\)/);
  assert.match(inbox, /failures\.append/);
  assert.match(inbox, /permanecen en Recibidos/);
});
