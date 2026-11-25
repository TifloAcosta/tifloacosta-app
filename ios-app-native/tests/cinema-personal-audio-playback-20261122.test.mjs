import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const screen = read('NativeAccessibleCinema.swift');
const library = read('NativeAccessibleCinemaLibrary.swift');

test('cinema imports private audio and video without requiring a ZIP or vendor account', () => {
  assert.match(screen, /Section\("Mi colección personal"\)/);
  assert.match(screen, /Button\("Importar audio o vídeo desde Archivos"\)/);
  assert.match(screen, /allowedContentTypes: \[\.audio, \.movie\]/);
  assert.match(screen, /allowsMultipleSelection: true/);
  assert.match(library, /url\.startAccessingSecurityScopedResource\(\)/);
  assert.match(library, /FileManager\.default\.copyItem\(at: url, to: destination\)/);
  assert.match(library, /"TifloCinemaPersonal"/);
});

test('cinema persists book identity, language, type and exact playback position', () => {
  assert.match(library, /struct NativeCinemaLocalItem: Codable, Hashable, Identifiable/);
  assert.match(library, /var lastSeconds: Double/);
  assert.match(library, /func savePosition\(_ seconds: Double, for id: UUID\)/);
  assert.match(library, /lastSeconds: 0/);
  assert.match(library, /pendingRestore = restored > 0 \? restored : nil/);
  assert.match(screen, /personalPlayer\.pauseAndSave\(library: personalLibrary\)/);
});

test('playback supports pause, seek, resume and explicit deletion without changing VoiceOver', () => {
  assert.match(screen, /Button\(personalPlayer\.playing \? "Pausar reproducción" : "Reanudar reproducción"\)/);
  assert.match(screen, /Retroceder treinta segundos/);
  assert.match(screen, /Avanzar treinta segundos/);
  assert.match(screen, /\.confirmationDialog\(/);
  assert.match(screen, /Button\("Eliminar archivo personal", role: \.destructive\)/);
  assert.match(library, /private var player: AVPlayer\?/);
  assert.doesNotMatch(library, /outputVolume|MPVolumeView|voiceOver/);
});

test('import checks permitted local types, size and link safety', () => {
  assert.match(library, /private static let allowedExtensions/);
  assert.match(library, /properties\.isSymbolicLink != true/);
  assert.match(library, /maximumFileSize: Int64 = 2_000_000_000/);
  assert.match(library, /try bytes\.write\(to: Self\.indexURL, options: \.atomic\)/);
});

test('local video uses a visible AVPlayer layer with one native transport and no extra VoiceOver stops', () => {
  assert.match(library, /var isVideoFile: Bool/);
  assert.match(library, /\["mp4", "m4v", "mov"\]\.contains/);
  assert.match(library, /var videoPlayer: AVPlayer\? \{ player \}/);
  assert.match(screen, /(?:private )?final class NativeCinemaVideoUIView: UIView/);
  assert.match(screen, /override class var layerClass: AnyClass \{ AVPlayerLayer\.self \}/);
  assert.match(screen, /(?:private )?struct NativeCinemaVideoSurface: UIViewRepresentable/);
  assert.match(screen, /if item\.isVideoFile, let videoPlayer = personalPlayer\.videoPlayer \{/);
  assert.match(screen, /NativeCinemaVideoSurface\(player: videoPlayer\)/);
  assert.match(screen, /view\.accessibilityElementsHidden = true/);
  assert.match(screen, /Button\(personalPlayer\.playing \? "Pausar reproducción" : "Reanudar reproducción"\)/);
});

test('forced pauses persist fractional seconds and a failed audio session never leaves a false playable item', () => {
  assert.match(library, /items\[index\]\.lastSeconds != seconds/);
  assert.doesNotMatch(library, /abs\(items\[index\]\.lastSeconds - seconds\) >= 1/);
  assert.match(library, /pendingRestore = restored > 0 \? restored : nil/);
  const open = library.slice(library.indexOf('func open(_ item:'), library.indexOf('private func beginProgressTracking'));
  assert.ok(open.indexOf('try AVAudioSession.sharedInstance().setActive(true)') < open.indexOf('player = AVPlayer(url: url)'));
  assert.match(library, /save\(library: library, force: true\)/);
});

test('cinema remembers language and content filters between visits', () => {
  assert.match(screen, /@AppStorage\("native-cinema-language-index-v1"\) private var languageIndex = 0/);
  assert.match(screen, /@AppStorage\("native-cinema-content-index-v1"\) private var contentIndex = 0/);
  assert.match(screen, /@AppStorage\("native-cinema-import-language-index-v1"\) private var importLanguageIndex = 1/);
  assert.match(screen, /@AppStorage\("native-cinema-import-kind-index-v1"\) private var importKindIndex = 1/);
  assert.match(screen, /selectedIndex: \$languageIndex/);
  assert.match(screen, /selectedIndex: \$contentIndex/);
});

test('unsupported media errors are reported without announcing false playback', () => {
  assert.match(library, /@Published private\(set\) var playbackError: String\?/);
  assert.match(library, /if player\.currentItem\?\.status == \.failed \|\| player\.error != nil/);
  assert.match(library, /playing = false/);
  assert.match(library, /NativeRemotePlaybackOwner\.release\(\.cinema\)/);
  assert.match(library, /guard playbackError == nil else \{ return \}/);
  assert.match(screen, /if let playbackError = personalPlayer\.playbackError/);
  assert.match(screen, /\.disabled\(personalPlayer\.playbackError != nil\)/);
  const key = '"No se pudo reproducir este archivo. Comprueba que el formato es compatible." = ';
  for (const lang of ['en','pt','fr','it','de']) {
    const catalog = read(lang + '.lproj/Localizable.strings');
    assert.ok(catalog.includes(key), 'Missing cinema playback error translation in ' + lang);
  }
});
