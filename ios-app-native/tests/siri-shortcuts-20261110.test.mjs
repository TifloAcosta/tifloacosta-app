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
