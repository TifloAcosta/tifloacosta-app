import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const extension = readFileSync(new URL('../ShareExtension/ShareViewController.swift', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../Sources/NativeShareInbox.swift', import.meta.url), 'utf8');

test('all external providers are queued in the order supplied by their apps', () => {
  assert.match(extension, /incomingQueue = incoming\.flatMap \{ item in/);
  assert.match(extension, /\(item\.attachments \?\? \[\]\)\.map/);
  assert.match(extension, /receiveNext\(\)/);
  assert.match(extension, /receiveAttachment\(provider: item\.provider, itemTitle: item\.title\)/);
  assert.doesNotMatch(extension, /providers\.first\(where:/);
  assert.doesNotMatch(extension, /receiveFirstAttachment/);
});

test('one failed provider does not abort the whole share, and completion waits for copy', () => {
  assert.match(extension, /itemCompleted = \{ \[weak self\] success, message in/);
  assert.match(extension, /if success \{ self\.receivedCount \+= 1 \}/);
  assert.match(extension, /self\.failedNames\.append/);
  assert.match(extension, /self\.incomingIndex \+= 1/);
  assert.match(extension, /self\.receiveNext\(\)/);
  assert.match(extension, /try manager\.copyItem\(at: file, to: destination\)/);
  assert.match(extension, /reportItem\(true, "Elemento guardado en Recibidos\."\)/);
});

test('batch manifests preserve an original order and individual audio destination', () => {
  assert.match(extension, /message\["batchID"\] = batchID/);
  assert.match(extension, /message\["batchIndex"\] = String\(incomingIndex\)/);
  assert.match(extension, /message\["batchCount"\] = String\(incomingQueue\.count\)/);
  assert.match(extension, /message\["destination"\] = "pending"/);
  assert.match(extension, /if self\.incomingQueue\.count > 1/);
  assert.match(extension, /if isAudio \{ self\.pendingAudioCount \+= 1 \}/);
  assert.match(inbox, /let batchID: String\?/);
  assert.match(inbox, /let batchIndex: String\?/);
  assert.match(inbox, /return a > b/);
  assert.match(inbox, /let oldToNew = items\.reversed\(\)/);
});

test('single incoming files keep immediate preview and destination controls', () => {
  assert.match(extension, /if incomingQueue\.count == 1/);
  assert.match(extension, /if isAudio \{\s*self\.pendingAudioID = id/);
  assert.match(extension, /self\.previewButton\.isHidden/);
  assert.match(extension, /Guardar en TifloLector/);
  assert.match(extension, /Guardar en Mi música/);
});

test('the user can inspect batch members and failures are not silently discarded', () => {
  assert.ok(extension.includes('statusLabel.text = "Recibiendo '));
  assert.ok(extension.includes('"Recibidos: '));
  assert.ok(extension.includes('"Fallidos: '));
  assert.ok(extension.includes('incomingQueue.count <= 100'));
  assert.ok(inbox.includes('Text("Archivo '));
});
