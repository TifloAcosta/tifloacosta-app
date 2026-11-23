import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../Sources/NativeShareInbox.swift', import.meta.url), 'utf8');

test('a failed library save removes the newly published book before deleting its media', () => {
  const importer = source.split('func importDocuments(from urls: [URL]')[1]
    ?.split('func importFolder(from folder: URL')[0] ?? '';
  assert.ok(importer.includes('try NativeReaderFormats.read(url, documentID: identifier)'));
  assert.ok(importer.includes('try NativeReaderFormats.storeOriginal(url, documentID: identifier)'));
  assert.ok(importer.includes('documents.insert('));
  assert.match(importer, /do\s*\{\s*try save\(\)\s*\}\s*catch\s*\{\s*documents\.removeAll \{ \$0\.id == identifier \}\s*throw error/);
  assert.match(importer, /NativeReaderFormats\.deleteStoredFiles\(for: identifier\)/);
  assert.match(importer, /NativeReaderFormats\.deleteOriginal\(for: identifier\)/);
});

test('a failed shared import retains the inbox item and original attachment for retry', () => {
  const importer = inbox.split('func importToReader(')[1]?.split('func importToMusic(')[0] ?? '';
  assert.match(importer, /try library\.importDocuments\(from: \[named\], sharingID: sharingID\)/);
  assert.ok(importer.indexOf('try library.importDocuments(') < importer.indexOf('complete(item)'));
  const batch = inbox.split('func importPendingReaderContent(')[1]?.split('func complete(')[0] ?? '';
  assert.match(batch, /catch\s*\{\s*failures\.append/);
});

test('folder import announces meaningful progress without interrupting VoiceOver every file', () => {
  const handler = source.split('isPresented: $importFolderPresented,')[1]
    ?.split('.fileImporter(isPresented: $restorePresented')[0] ?? '';
  assert.match(handler, /importFolderStatus = message/);
  assert.match(handler, /Date\(\)\.timeIntervalSince\(lastAnnouncement\) >= 5/);
  assert.match(handler, /UIAccessibility\.post\(notification: \.announcement, argument: message\)/);
  assert.match(handler, /Importación terminada\. Documentos importados: %d\. Omitidos: %d\. Fallidos: %d\./);
  assert.match(handler, /summary\.failed\.prefix\(6\)/);
});

test('existing per-voice gain does not change VoiceOver output gain', () => {
  const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url),'utf8');
  const gain = readFileSync(new URL('../Sources/NativeReaderGeneratedVoiceVolume.swift', import.meta.url),'utf8');
  assert.match(settings, /NativeReaderVoiceProfileStore\.save\(draft, for: voiceIdentifier\)/);
  assert.match(settings, /NativeReaderGeneratedVoiceVolume\.setLevel/);
  assert.match(source, /NativeReaderGeneratedVoiceVolume\.gain\(/);
  assert.match(source, /utterance\.volume = max\(0, min\(1,/);
  assert.doesNotMatch(gain, /MPVolumeView|outputVolume\s*=/);
});
