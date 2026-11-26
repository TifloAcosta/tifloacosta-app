import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const part = (a,b) => source.split(a)[1]?.split(b)[0] ?? '';
test('audio navigation saves the previous player before assigning a new track', () => {
  const p = part('private func selectAudioLocation(', 'private func jump(to offset:');
  assert.ok(p.indexOf('stopPlayback()') < p.indexOf('trackIndex = track'));
  assert.match(p, /library\.saveAudioPosition\(document, track: trackIndex, percent: currentPercent,/);
  assert.match(p, /resumeIfPlaying && wasPlaying \{ play\(\) \}/);
  assert.doesNotMatch(p, /move\(to: 0\)|speech\.seek\(/);
  assert.match(source, /selectAudioLocation\(track: index, percent: 0, seconds: 0,/);
  assert.match(source, /selectAudioLocation\(track: mark.track, percent: mark.percent,/);
});
test('idle audio percent navigation replaces stale exact time', () => {
  const p = part('private func move(to percent: Int)', 'private var positionBinding');
  assert.match(p, /if !tracks.isEmpty/);
  assert.match(p, /pendingDaisyAudioSeconds = nil\s+didRestoreAudioPosition = true\s+library\.saveAudioPosition\(document, track: trackIndex, percent: value, seconds: nil\)/);
  assert.match(source, /let storedSeconds = trackIndex == latest.lastTrackIndex \? latest.lastAudioSeconds : nil/);
});
test('bookmarks capture exact pending audio positions and do not round text to completion', () => {
  const p = part('private func addBookmark() {','private func exportGeneratedAudio()');
  assert.match(p, /pendingDaisyAudioSeconds \?\?/);
  assert.match(p, /NativeReaderProgress\.textPercent\(length: latest.body.count, offset: offset\)/);
  assert.match(source, /NativeReaderProgress\.textPercent\(length: count, offset: value\)/);
});

test('bookmark removal confirms before mutation and rolls back on storage failure', () => {
  for (const [name, field] of [['removeTextBookmark','textBookmarks'], ['removeAudioBookmark','audioBookmarks'], ['removeBookmark','markedPositions']]) {
    const p = part('func ' + name + '(', '\n    }');
    assert.match(p, /throws/);
    assert.ok(p.includes('let previous = documents[i].' + field));
    assert.ok(p.includes('documents[i].' + field + ' = previous'));
    assert.match(p, /throw error/);
  }
  assert.match(source, /confirmationDialog\("¿Eliminar esta marca\?"/);
  assert.match(source, /role: .destructive\) \{ deleteRequestedBookmark\(\) \}/);
  assert.match(source, /bookmarkDeletionFailed = true/);
});
