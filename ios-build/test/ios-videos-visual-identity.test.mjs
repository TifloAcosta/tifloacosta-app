import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = name => readFileSync(resolve(root, name), 'utf8');

test('Vídeos funciona como sección UIKit hija, no como menú modal superpuesto', () => {
  const plugin = source('native/TifloReadingAccessibilityPlugin.swift');
  const videos = source('native/TifloNativeVideosController.swift');
  const section = plugin.slice(plugin.indexOf('@objc public func showNativeVideoSection('),
    plugin.indexOf('@objc public func showNativeActionList('));
  assert.match(section, /presenter\.addChild\(navigation\)/);
  assert.match(section, /presenter\.view\.addSubview\(navigation\.view\)/);
  assert.match(section, /navigation\.didMove\(toParent: presenter\)/);
  assert.match(section, /navigation\.willMove\(toParent: nil\)/);
  assert.match(section, /navigation\.removeFromParent\(\)/);
  assert.doesNotMatch(section, /presenter\.present\(navigation,/);
  assert.match(videos, /@objc private func closeToHome/);
  assert.match(videos, /completion\?\(\)/);
});

test('TifloAcosta recupera sus tarjetas y controles sin pasos extras de VoiceOver', () => {
  const videos = source('native/TifloNativeVideosController.swift');
  assert.match(videos, /private final class TifloBrandedVideoCell: UITableViewCell/);
  assert.match(videos, /panel\.layer\.cornerRadius = 18/);
  assert.match(videos, /panel\.layer\.borderWidth = 1/);
  assert.match(videos, /tableView\.separatorStyle = \.none/);
  assert.match(videos, /header\.layer\.cornerRadius = 16/);
  assert.match(videos, /searchBar\.searchTextField\.layer\.borderColor = theme\.border\.cgColor/);
  assert.match(videos, /cell\.configure\(title: video\.title, info: video\.visualMetadata, theme: theme\)/);
  assert.match(videos, /cell\.accessibilityLabel = video\.speech/);
  assert.match(videos, /cell\.accessibilityCustomActions = handlers\.map/);
  assert.match(videos, /isAccessibilityElement = true/);
  assert.match(videos, /metadata\.isHidden = info\?\.isEmpty \?\? true/);
});

test('Reproduce, busca y ordena sin modificar permisos ni reproductor', () => {
  const videos = source('native/TifloNativeVideosController.swift');
  const pkg = source('install-native-video.mjs');
  assert.match(videos, /TifloYouTubeViewController\(/);
  assert.match(videos, /account\.signIn\(from: self\)/);
  assert.match(videos, /private var limit = 10/);
  assert.match(videos, /requestResults\(append: true\)/);
  assert.match(videos, /"capacitor:\/\/localhost", forHTTPHeaderField: "Origin"/);
  assert.match(pkg, /const videosBody = nativeVideos/);
});
