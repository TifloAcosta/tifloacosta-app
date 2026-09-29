import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('audio reader reuses the common reading route and dispatches audio to its accessible subview', async () => {
  const [bookScreen, audioScreen] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/screens/reading-audio.mjs')
  ]);

  assert.match(bookScreen, /createReadingAudioView/);
  assert.match(bookScreen, /opened\.book\.format\s*===\s*['"]audio['"]/);
  assert.match(bookScreen, /initializeOpenedAudioBook|audioView/);
  assert.doesNotMatch(bookScreen, /router\.(?:go|push|navigate)\([^)]*audio/i);

  assert.match(audioScreen, /createReadingAudioController/);
  assert.match(audioScreen, /createReadingMarksPanel/);
  assert.match(audioScreen, /role['"],\s*['"]status|setAttribute\(['"]role['"],\s*['"]status['"]\)/);
});

test('audio reader exposes native accessible playback controls, timer choices and concise position status in ES and EN', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-audio.mjs'),
    read('src/core/i18n.mjs')
  ]);

  for (const key of [
    'readingAudio.play', 'readingAudio.pause', 'readingAudio.rewind', 'readingAudio.forward',
    'readingAudio.previousTrack', 'readingAudio.nextTrack', 'readingAudio.speed',
    'readingAudio.timer', 'readingAudio.marks', 'readingAudio.position'
  ]) {
    assert.ok(screen.includes(key), `Missing audio UI key: ${key}`);
  }
  assert.match(screen, /READING_AUDIO_SLEEP_MINUTES/);
  assert.match(screen, /15/);
  assert.match(screen, /30/);
  assert.match(screen, /45/);
  assert.match(screen, /60/);
  assert.match(screen, /track-end/);
  assert.match(screen, /aria-live/);

  for (const label of [
    'Reproducir', 'Pausa', 'Retroceder {seconds} segundos', 'Avanzar {seconds} segundos',
    'Pista anterior', 'Pista siguiente', 'Velocidad', 'Temporizador', 'Al final de la pista',
    'Play', 'Pause', 'Rewind {seconds} seconds', 'Forward {seconds} seconds',
    'Previous track', 'Next track', 'Speed', 'Sleep timer', 'At end of track'
  ]) {
    assert.ok(i18n.includes(label), `Missing translation: ${label}`);
  }
});

test('opening audio restores exact media position, focuses Play and never auto-starts playback', async () => {
  const screen = await read('src/screens/reading-audio.mjs');

  assert.match(screen, /mediaTrackIndex/);
  assert.match(screen, /mediaPositionMs/);
  assert.match(screen, /await\s+controller\.prepare\(\)/);
  assert.match(screen, /playButton\.focus\(\)/);
  assert.match(screen, /playButton\.addEventListener\(['"]click['"]/);
  assert.match(screen, /controller\.play\(\)/);
  assert.doesNotMatch(screen, /await\s+controller\.prepare\(\)[\s\S]{0,240}controller\.play\(\)/, 'Opening audio must never autoplay');
});

test('audio marks store and jump to exact track plus milliseconds without starting playback', async () => {
  const [screen, marks] = await Promise.all([
    read('src/screens/reading-audio.mjs'),
    read('src/screens/reading-marks.mjs')
  ]);

  assert.match(screen, /mediaTrackIndex/);
  assert.match(screen, /mediaPositionMs/);
  assert.match(screen, /onJump[\s\S]*(?:controller\.seek\(|jumpToAudioMark\()/);
  assert.match(screen, /jumpToAudioMark[\s\S]*controller\.pause\(\)/);
  assert.doesNotMatch(screen, /onJump[\s\S]{0,300}controller\.play\(/, 'Jumping to an audio mark must not start playback');

  assert.match(marks, /mediaTrackIndex/);
  assert.match(marks, /mediaPositionMs/);
  assert.match(marks, /onJump\?\.\(\{[\s\S]*mediaTrackIndex:[\s\S]*mediaPositionMs:/);
  assert.match(marks, /client\.addMark\(\{[\s\S]*mediaTrackIndex:[\s\S]*mediaPositionMs:/);
});

test('audio reader lets one book override speed and the configured 10 30 or 60 second skip interval', async () => {
  const screen = await read('src/screens/reading-audio.mjs');

  assert.match(screen, /resolveReadingSettings/);
  assert.match(screen, /audio\.speed/);
  assert.match(screen, /audio\.skipSeconds/);
  assert.match(screen, /skipLabel/);
  assert.match(screen, /skipSelect/);
  assert.match(screen, /for \(const value of \[10,\s*30,\s*60\]\)/);
  assert.match(screen, /saveBookSetting\(['"]audio\.skipSeconds['"]/);
  assert.match(screen, /setReadingSetting/);
  assert.match(screen, /controller\.setSpeed\(/);
  assert.match(screen, /controller\.skip\(-1\)/);
  assert.match(screen, /controller\.skip\(1\)/);
});
