import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const formats = swift('NativeReaderFormats.swift');
const reader = swift('NativeTifloLector.swift');
const settings = swift('NativeReaderSettings.swift');

test('audio standalone: formatos veraces y reproductor con control real', () => {
  for (const ext of ['mp3', 'm4a', 'm4b', 'aac', 'wav', 'aif', 'aiff', 'caf']) {
    assert.match(formats, new RegExp('"' + ext + '"'));
  }
  assert.match(reader, /AVAudioPlayer\(contentsOf: url\)/);
  assert.match(reader, /audio\.delegate = audioDelegate/);
  assert.match(reader, /playPlaylist\(/);
});

test('ZIP: audiolibros de varias pistas y DAISY, sin aceptar ZIP arbitrarios', () => {
  assert.match(formats, /isDaisy \|\| \(ext == "zip" && !audioFiles\.isEmpty\)/);
  assert.match(formats, /localizedStandardCompare/);
  assert.match(formats, /format = isDaisy \? "daisy" : "zip"/);
  assert.match(formats, /total <= sizeLimit/);
  assert.match(formats, /entries <= 4000/);
  assert.match(formats, /!path\.hasPrefix\("\/"\)/);
  assert.match(formats, /NativeReaderFormatError\.invalidArchive/);
});

test('reproducción automática continúa de pista en pista, sin saltar al pausar', () => {
  assert.match(reader, /audioPlayerDidFinishPlaying/);
  assert.match(reader, /guard success, self\.playlistURLs\.indices\.contains\(self\.playlistIndex \+ 1\)/);
  assert.match(reader, /self\.playlistIndex = next/);
  assert.match(reader, /self\.onTrackChanged\?\(next\)/);
  assert.match(reader, /player\.pause\(\)/);
  assert.match(reader, /onDisappear \{\s*persistPosition\(\)\s*speech\.stop\(\)/);
});

test('progreso conserva pista y porcentaje; marcas de audio distinguen capítulos', () => {
  assert.match(reader, /var lastTrackIndex: Int\? = nil/);
  assert.match(reader, /func saveAudioPosition/);
  assert.match(reader, /startTrack \?\? latest\.lastTrackIndex/);
  assert.match(reader, /struct NativeAudioBookmark: Codable, Hashable/);
  assert.match(reader, /func addAudioBookmark/);
  assert.match(reader, /func removeAudioBookmark/);
  assert.match(reader, /trackIndex/);
  assert.match(reader, /trackIndex/);
  assert.match(reader, /title: "Seleccionar pista"/);
  assert.match(reader, /trackIndex/);
});

test('la declaración distingue formatos y límites que requieren otra integración', () => {
  assert.match(formats, /navegación SMIL completa sigue en desarrollo/);
  assert.match(formats, /No se admiten ZIP arbitrarios, RAR, 7Z ni CBR\/CBZ/);
  assert.match(formats, /PPS y PPT antiguas todavía no están admitidas/);
  assert.match(formats, /XLS antiguos todavía no están admitidos/);
  assert.match(settings, /NativeReaderFormats\.supportedFormatGroups/);
  assert.match(formats, /"ppsx", "pptm"/);
  assert.match(formats, /"xlsx", "xlsm"/);
});
