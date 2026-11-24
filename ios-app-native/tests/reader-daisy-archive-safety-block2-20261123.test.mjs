import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const formats = read('NativeReaderFormats.swift');
const order = read('NativeDaisyAudioOrder.swift');
const reader = read('NativeTifloLector.swift');

test('DAISY chapter routing uses the archive-relative SMIL and audio path', () => {
  assert.ok(order.includes('static func resolvedMember('));
  assert.ok(order.includes('static func navigationAudio('));
  assert.ok(order.includes('let audioPath = member(source.file, relativeTo: smil, in: audioPaths)'));
  assert.ok(order.includes('let track = audioPaths.firstIndex(of: audioPath)'));
  assert.ok(formats.includes('href, relativeTo: ncc, available: smilPaths'));
  assert.ok(formats.includes('link.href, relativeTo: ncx, available: smilPaths'));
  assert.ok(formats.includes('NativeDaisyAudioOrder.navigationAudio('));
  // The old basename matching could swap same-named tracks in sibling folders.
  const nccBody = formats.split('if isDaisy, let ncc =')[1]?.split('for path in audioFiles {')[0] ?? '';
  assert.ok(!nccBody.includes('lastPathComponent.lowercased() =='));
});

test('NCC/NCX can point directly at an SMIL audio ID and retain clipBegin', () => {
  assert.ok(order.includes('ancestorIDs: elementIDs.compactMap'));
  assert.ok(order.includes('source = items.first(where:'));
  assert.ok(order.includes('return (track, seconds(source.begin) ?? 0)'));
  assert.ok(formats.includes('seconds: target.seconds'));
  assert.ok(reader.includes('pendingDaisyAudioSeconds'));
});

test('large ZIP and DAISY imports reject duplicate members and prevent size overflow', () => {
  const unpack = formats.split('private static func readPackage(')[1]?.split('func extractedText(')[0] ?? '';
  assert.ok(unpack.includes('var extractedPaths: Set<String> = []'));
  assert.ok(unpack.includes('extractedPaths.insert(path.precomposedStringWithCanonicalMapping.lowercased()).inserted'));
  assert.ok(unpack.includes('entry.uncompressedSize <= UInt64(sizeLimit - total)'));
  assert.ok(unpack.includes('total += Int64(entry.uncompressedSize)'));
  assert.ok(unpack.indexOf('entry.uncompressedSize <= UInt64(sizeLimit - total)') <
            unpack.indexOf('total += Int64(entry.uncompressedSize)'));
  assert.ok(unpack.includes('entries <= 4000'));
  assert.ok(unpack.includes('750_000_000'));
  assert.ok(unpack.includes('entry.type == .file'));
  assert.ok(unpack.includes('!components.contains("..")'));
});

test('DAISY originals and the separate Voice Dream ZIP remain available', () => {
  assert.ok(reader.includes('func shareableOriginalURL(for document: NativeReadingDocument)'));
  assert.ok(reader.includes('func exportVoiceDreamMP3(_ document: NativeReadingDocument)'));
  assert.ok(reader.includes('NativeDaisyPackageVerifier.validateVoiceDreamMP3Zip(output)'));
  assert.ok(reader.includes('String(format: "%04d.mp3", index + 1)'));
});
