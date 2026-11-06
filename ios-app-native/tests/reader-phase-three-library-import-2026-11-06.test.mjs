import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Multi-select deletion is confirmed and protects stored document metadata', () => {
  assert.match(reader, /Selección/);
  assert.match(reader, /selectedDocumentIDs: Set<UUID>/);
  assert.match(reader, /confirmBatchDeletion/);
  assert.match(reader, /func deleteDocuments\(withIDs ids: Set<UUID>\) -> Bool/);
  assert.match(reader, /documents = previous/);
  assert.match(reader, /deleted\.forEach \{ NativeReaderFormats\.deleteStoredFiles/);
});
test('Reader allows deletion from the opened document with confirmation', () => {
  assert.match(reader, /Button\("Eliminar esta obra", role: \.destructive\)/);
  assert.match(reader, /showDocumentActions = false/);
  assert.match(reader, /confirmDocumentDeletion = true/);
  assert.match(reader, /guard library\.delete\(document\) else/);
});
test('Multiple imports report per-file failures and successes', () => {
  assert.match(reader, /allowsMultipleSelection: true/);
  assert.match(reader, /for url in urls/);
  assert.match(reader, /failures\.append/);
  assert.match(reader, /importMessage = /);
  assert.match(reader, /UIAccessibility\.post\(notification: \.announcement/);
});
