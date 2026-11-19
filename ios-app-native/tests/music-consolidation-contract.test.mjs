import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('iOS base preserves TifloLector punctuation modes and configurable pauses', () => {
  const settings = source('NativeReaderSettings.swift');
  assert.match(settings, /enum NativeReaderPauseProfile/);
  assert.match(settings, /struct NativeReaderPunctuationControls/);
  assert.match(settings, /"Normal", "Mayor", "Expresiva", "Personalizadas"/);
  for (const sign of ['comma', 'semicolon', 'colon', 'sentence', 'paragraph']) {
    assert.ok(settings.includes(`"native-reading-pause-${sign}"`));
  }
});

test('the voice credentials and Gemini sample remain present', () => {
  const credentials = source('NativeReaderExternalVoiceCredentials.swift');
  assert.match(credentials, /Button\("Escuchar muestra"\)/);
  assert.match(credentials, /geminiPreview\.listen/);
});

test('iOS keeps the established shared music player and all original platform destinations', () => {
  const music = source('NativeMyMusic.swift');
  const platforms = source('NativeRadioBrowser.swift');
  const playback = source('NativeMusicPlayer.swift');
  assert.match(music, /NativeMusicPlayer\.shared/);
  assert.match(music, /NavigationLink\("Plataformas musicales"\)/);
  assert.match(platforms, /NavigationLink\("Radio musical gratuita"\)/);
  assert.match(platforms, /NavigationLink\("Audius: música gratuita"\)/);
  assert.match(platforms, /NavigationLink\("Apple Music"\)/);
  assert.match(playback, /enum NativeRemotePlaybackOwner/);
});

test('existing six-language localizations are retained, not replaced by minimal catalogs', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const content = source(`${language}.lproj/Localizable.strings`);
    const count = [...content.matchAll(/^"[^"\n]+"\s*=/gm)].length;
    assert.ok(count > 400, `${language}: only ${count} translations remain`);
  }
});

test('Jamendo joins the existing platform menu and shared playback ownership', () => {
  const platforms = source('NativeRadioBrowser.swift');
  const playback = source('NativeMusicPlayer.swift');
  assert.match(platforms, /NavigationLink\("Jamendo: música gratuita"\)/);
  assert.match(playback, /case reader, music, radio, audius, appleMusic, jamendo/);
  const jamendo = source('NativeJamendoMusic.swift');
  assert.match(jamendo, /api\.jamendo\.com\/v3\.0\/tracks/);
  assert.match(jamendo, /NativeReaderPlaybackBridge\.pauseActiveReader/);
  assert.match(jamendo, /NativeAudiusPlayer\.shared\.pauseForOtherAudio/);
  assert.match(jamendo, /NativeAppleMusicPlayer\.shared\.pauseForOtherAudio/);
  assert.match(jamendo, /NativeRadioPlayer\.shared\.pauseForOtherAudio/);
  assert.match(jamendo, /NativeRemotePlaybackOwner\.claim\(\.jamendo\)/);
});

test('the existing music sources pause Jamendo before starting audio', () => {
  for (const name of ['NativeMusicPlayer.swift', 'NativeRadioBrowser.swift',
    'NativeAudiusMusic.swift', 'NativeAppleMusic.swift']) {
    const file = source(name);
    assert.match(file, /NativeJamendoPlayer\.shared\.pauseForOtherAudio\(\)/,
      `${name}: playback does not hand off from Jamendo`);
  }
});

test('TifloLector also pauses Jamendo when speech begins', () => {
  assert.match(source('NativeTifloLector.swift'), /NativeJamendoPlayer\.shared\.pauseForOtherAudio\(\)/);
});

test('mixed playlists survive legacy decoding, index export, and complete archive restoration', () => {
  const music = source('NativeMyMusic.swift');
  assert.match(music, /struct MusicPlaylistEntry: Codable, Identifiable/);
  assert.match(music, /case local, appleMusic, audius, jamendo/);
  assert.match(music, /var orderedEntries: \[MusicPlaylistEntry\]\? = nil/);
  assert.match(music, /orderedEntries: \$0\.orderedEntries/);
  assert.match(music, /item\.orderedEntries\?\.compactMap/);
  assert.match(music, /ids\[localId\.uuidString\]/);
});

test('remote catalog results can be added to named playlists and reopened by provider', () => {
  const music = source('NativeMyMusic.swift');
  const platforms = source('NativeRadioBrowser.swift');
  const apple = source('NativeAppleMusic.swift');
  const audius = source('NativeAudiusMusic.swift');
  const jamendo = source('NativeJamendoMusic.swift');
  assert.match(music, /NativeMusicPlatformsScreen\(playlists:/);
  assert.match(music, /addRemoteToPlaylist\(/);
  assert.match(music, /NativeAppleMusicPlayer\.shared\.playSaved\(/);
  assert.match(music, /NativeAudiusPlayer\.shared\.play\(/);
  assert.match(music, /NativeJamendoPlayer\.shared\.playSaved\(/);
  assert.match(platforms, /NativeMusicPlaylistMenu/);
  assert.match(apple, /func playSaved\(/);
  assert.match(audius, /NativeMusicPlaylistMenu/);
  assert.match(jamendo, /func playSaved\(/);
});

test('new provider and playlist controls resolve formatted labels in all supported locales', () => {
  const keys = ['Añadir %@ a una lista', 'Añadir a %@',
    'Escuchar %@, %@, Apple Music', 'Escuchar %@, %@, Audius',
    'Escuchar %@, %@, Jamendo', 'Jamendo no pudo completar la búsqueda.',
    'Esta canción ya no está disponible en Jamendo. Se conserva en tu lista.'];
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const file = source(`${language}.lproj/Localizable.strings`);
    for (const key of keys) {
      assert.ok(file.includes(`"${key}" = `), `${language}: missing ${key}`);
    }
  }
  assert.match(source('NativeRadioBrowser.swift'), /MusicLocalized\.format\("Añadir %@ a una lista"/);
  assert.match(source('NativeMyMusic.swift'), /MusicLocalized\.format\("Escuchar %@, %@, Jamendo"/);
});
