import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../Sources/NativeMusicConnectionPolicy.swift', import.meta.url), 'utf8');
const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');
const dropbox = readFileSync(new URL('../Sources/NativeCloudFolderBrowserScreen.swift', import.meta.url), 'utf8');
const google = readFileSync(new URL('../Sources/NativeCloudGooglePickerScreen.swift', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../Sources/NativeCloudStorage.swift', import.meta.url), 'utf8');

test('settings persist separate playback, download and VoiceOver preferences', () => {
  assert.match(music, /@AppStorage\("music\.cellularPlayback"\)/);
  assert.match(music, /@AppStorage\("music\.cellularDownloads"\)/);
  assert.match(music, /@AppStorage\("music\.detailedVoiceOver"\)/);
  assert.match(music, /Section\("Conexión"\)/);
  assert.match(music, /Section\("Información de VoiceOver"\)/);
});

test('downloads default to Wi-Fi and block cellular unless the user approves once', () => {
  assert.match(settings, /func canDownload\(allowCellular: Bool\)/);
  assert.match(settings, /path\.usesInterfaceType\(\.cellular\)/);
  assert.match(dropbox, /canDownload\(allowCellular: allowCellularDownloads\)/);
  assert.match(google, /canDownload\(allowCellular: allowCellularDownloads\)/);
  assert.match(dropbox, /Usar datos una vez/);
  assert.match(google, /Usar datos una vez/);
  assert.match(transport, /request\.allowsCellularAccess = allowsCellular/);
  assert.match(dropbox, /download\(item, allowsCellular: allowCellular\)/);
  assert.match(google, /download\(item, allowsCellular: allowCellular\)/);
});

test('VoiceOver adds optional details and always keeps the item name', () => {
  assert.match(music, /detailedVoiceOver \?/);
  assert.match(music, /file\.name/);
});
