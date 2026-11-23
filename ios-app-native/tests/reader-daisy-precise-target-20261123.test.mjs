import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const swift = source('NativeTifloLector.swift');
const part = (start,end) => swift.split(start)[1]?.split(end)[0] ?? '';

test('DAISY navigation seeks to a real SMIL offset and saves its track percentage', () => {
  const jump = part('private func jumpToDaisy(', 'private func pausePlayback()');
  assert.match(jump, /if speech[.]isPlaying [|][|] speech[.]isPaused [{] stopPlayback[(][)] [}]/);
  assert.match(jump, /let requestedSeconds = point[.]seconds/);
  assert.match(jump, /AVAudioPlayer[(]contentsOf: url[)]/);
  assert.match(jump, /probe[.]duration[.]isFinite, probe[.]duration > 0/);
  assert.match(jump, /let targetSeconds = min[(]requestedSeconds, probe[.]duration[)]/);
  assert.match(jump, /targetSeconds [/] probe[.]duration [*] 100/);
  assert.match(jump, /currentPercent = max[(]0, min[(]100/);
  assert.match(jump, /library[.]saveAudioPosition[(]document, track: trackIndex, percent: currentPercent/);
  assert.match(jump, /lastSavedPercent = currentPercent/);
  assert.doesNotMatch(jump, /playTrack[(]|speech[.]play[(]|startTextSpeech[(]|[.]resume[(]/);
});

test('the announcement distinguishes DAISY heading, page and reference without autoplay', () => {
  const jump = part('private func jumpToDaisy(', 'private func pausePlayback()');
  for (const kind of ['Página','Referencia','Capítulo','Encabezado']) {
    assert.ok(jump.includes('"' + kind + '"'));
  }
  assert.match(jump, /[%]@: [%]@[.] Pulsa Reproducir para escuchar[.]/);
  assert.match(jump, /if announce [{]/);
  assert.match(jump, /UIAccessibility[.]post[(]notification: [. ]announcement, argument: message[)]/);
  const swipe = part('private func moveDaisyPoint(', 'private func moveBetweenMarks(');
  assert.match(swipe, /jumpToDaisy[(]point, announce: false[)]/);
});

test('DAISY point types are translated in all supported languages', () => {
  const key = '"%@: %@. Pulsa Reproducir para escuchar." = ';
  for (const language of ['en','pt','fr','it','de']) {
    const strings = source(language + '.lproj/Localizable.strings');
    assert.ok(strings.includes(key), language + ': missing short type-aware announcement');
  }
});
