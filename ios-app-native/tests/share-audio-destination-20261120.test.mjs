import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ext = readFileSync(new URL('../ShareExtension/ShareViewController.swift', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../Sources/NativeShareInbox.swift', import.meta.url), 'utf8');
const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('audio shares ask where to save and preserve the destination in the manifest', () => {
  assert.match(ext, /Guardar en TifloLector/);
  assert.match(ext, /Guardar en Mi música/);
  assert.match(ext, /"destination"\] = "pending"/);
  assert.match(ext, /message\["destination"\] = destination/);
});

test('pending audio is not silently imported to reader; music can receive it', () => {
  assert.match(inbox, /let destination: String\?/);
  assert.match(inbox, /item\.destination != "pending"/);
  assert.match(inbox, /item\.destination != "music"/);
  assert.match(inbox, /NativeMusicSharedAudio\.importFile/);
  assert.match(music, /enum NativeMusicSharedAudio/);
});

test('the inbox provides two accessible destinations when a choice is pending', () => {
  assert.match(inbox, /"TifloLector"/);
  assert.match(inbox, /"Mi música"/);
});
