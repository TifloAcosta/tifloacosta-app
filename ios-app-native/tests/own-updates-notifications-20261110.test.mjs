import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const notifier = source('NativeOwnUpdatesNotifications.swift');
const catalog = source('NativeCatalogStore.swift');
const settings = source('NativeUpdatesSettings.swift');

test('Solo novedades propias, sin RSS ni noticias externas', () => {
  assert.match(notifier, /resources\.filter \{/);
  assert.match(notifier, /\$0\.isNew == true && \$0\.resourceURL != nil/);
  assert.match(notifier, /videos\.filter \{ \$0\.videoURL != nil \}/);
  assert.doesNotMatch(notifier, /catalog\.news|\.news\.filter|rss|podcast/);
  assert.match(notifier, /let existing = defaults\.stringArray\(forKey: seenKey\)/);
  assert.match(notifier, /guard existing != nil, enabled, !additions\.isEmpty/);
});

test('Solo solicita permiso tras acción expresa y ofrece desactivación', () => {
  assert.match(notifier, /func enable\(\) async/);
  assert.match(notifier, /\.requestAuthorization\(options: \[\.alert, \.badge, \.sound\]\)/);
  assert.match(notifier, /func disable\(\)/);
  assert.match(settings, /Button\("Activar avisos de novedades"\)/);
  assert.match(settings, /Button\("Desactivar avisos de novedades"\)/);
  assert.match(settings, /no son notificaciones push mientras está cerrada/);
});

test('Comprobación solo tras refresco válido de catálogo', () => {
  assert.match(catalog, /apply\(candidate\.snapshot\)/);
  assert.match(catalog, /NativeOwnUpdatesNotifications\.shared\.checkOwnContent\(/);
  assert.match(catalog, /resources: candidate\.snapshot\.resources/);
  assert.match(catalog, /videos: candidate\.snapshot\.videos/);
});

test('Centro de notificaciones recibe avisos discretos sin banner intrusivo en primer plano', () => {
  assert.match(notifier, /NativeLocalNotificationDelegate: NSObject, UNUserNotificationCenterDelegate/);
  assert.match(notifier, /completionHandler\(\[\.list\]\)/);
  assert.match(source('TifloAcostaNativeApp.swift'), /UNUserNotificationCenter\.current\(\)\.delegate = NativeLocalNotificationDelegate\.shared/);
});
