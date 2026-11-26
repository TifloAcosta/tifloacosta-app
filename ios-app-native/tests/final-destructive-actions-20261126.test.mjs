import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
test('Destructive actions identify the item before deletion', () => {
  const downloads = read('NativeDownloads.swift');
  assert.ok(downloads.includes('MusicLocalized.format("¿Eliminar «%@»?", pendingDeletion?.title'));
  const inbox = read('NativeShareInbox.swift');
  assert.ok(inbox.includes('if inbox.activeReaderImportID != item.id { pendingDeletion = item }'));
  assert.ok(inbox.includes('MusicLocalized.format("¿Eliminar «%@»?", pendingDeletion?.name'));
  const cinema = read('NativeCinemaHistory.swift');
  assert.ok(cinema.includes('.swipeActions(allowsFullSwipe: false)'));
  assert.ok(cinema.includes('pendingRemoval = recent; confirm = true'));
  assert.ok(cinema.includes('Button("Eliminar del historial", role: .destructive) { store.remove(recent.id)'));
  const activity = read('NativeReadingActivityScreen.swift');
  assert.ok(activity.includes('Button("Borrar historial de consulta", role: .destructive) { confirmClear = true }'));
  assert.ok(activity.includes('.confirmationDialog("¿Borrar el historial de consulta de Actualidad y Recursos?"'));
});
