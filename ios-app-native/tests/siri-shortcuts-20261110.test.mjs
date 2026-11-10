import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const intents = src('NativeAppShortcuts.swift');
const home = src('NativeScreens.swift');

test('Atajos usan App Intents para abrir secciones nativas', () => {
  assert.match(intents, /import AppIntents/);
  for (const intent of ['NativeOpenNewsIntent','NativeOpenReaderIntent','NativeOpenVideosIntent']) {
    assert.ok(intents.includes('struct ' + intent + ': AppIntent'));
  }
  assert.match(intents, /struct NativeTifloAppShortcuts: AppShortcutsProvider/);
  assert.match(intents, /static var openAppWhenRun: Bool = true/);
  assert.match(intents, /NativeShortcutRoute\.request\("actualidad"\)/);
  assert.match(intents, /NativeShortcutRoute\.request\("tifloLector"\)/);
  assert.match(intents, /NativeShortcutRoute\.request\("videos"\)/);
});

test('Inicio consume la ruta de Siri una sola vez y evita pantallas web', () => {
  assert.match(home, /@State private var navigationPath = NavigationPath\(\)/);
  assert.match(home, /NavigationStack\(path: \$navigationPath\)/);
  assert.match(home, /func openRequestedShortcut\(\)/);
  assert.match(home, /case "actualidad": destination = \.actualidad/);
  assert.match(home, /case "tifloLector": destination = \.tifloLector/);
  assert.match(home, /case "videos": destination = \.videos/);
  assert.match(home, /defaults\.removeObject\(forKey: NativeShortcutRoute\.key\)/);
  assert.match(home, /\.onReceive\(NotificationCenter\.default\.publisher\(for: \.nativeShortcutRouteRequested\)\)/);
});

test('Siri continúa el último libro abierto desde posición guardada', () => {
  const reader = src('NativeTifloLector.swift');
  assert.match(intents, /struct NativeResumeReaderIntent: AppIntent/);
  assert.match(intents, /NativeShortcutRoute\.request\("resumeReader"\)/);
  assert.match(home, /case "resumeReader":/);
  assert.match(home, /native-ios-resume-last-book-shortcut-v1/);
  assert.match(reader, /private func resumeRequestedBook\(\)/);
  assert.match(reader, /library\.documents\.filter\(\{ \$0\.lastOpenedAt != nil \}\)\.max\(by:/);
  assert.match(reader, /importError = nil/);
  assert.match(reader, /lastOpenedAt \?\? \.distantPast/);
  assert.match(reader, /play\(document\)/);
  assert.match(reader, /defaults\.removeObject\(forKey: key\)/);
  assert.match(reader, /\.onAppear \{ resumeRequestedBook\(\) \}/);
});

test('VoiceOver mantiene un título breve por defecto y detalle opcional en una sola línea', () => {
  const reader = src('NativeTifloLector.swift');
  const settings = src('NativeUpdatesSettings.swift');
  assert.match(reader, /@AppStorage\("native-voiceover-library-detail-index"\) private var voiceOverDetailIndex = 0/);
  assert.match(reader, /if voiceOverDetailIndex == 0 \{ return shortLabel \}/);\n  assert.match(reader, /if voiceOverDetailIndex == 1 \{ return formatLabel \}/);
  assert.match(reader, /doc\.formatLabel/);
  assert.match(reader, /doc\.folderName/);
  assert.match(settings, /title: "Información al recorrer la biblioteca"/);
  assert.match(settings, /selectedIndex: \$voiceOverDetailIndex/);
});
