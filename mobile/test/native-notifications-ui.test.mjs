import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('app initializes OneSignal without requesting permission at startup', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /@onesignal\/capacitor-plugin/);
  assert.match(source, /createNotificationService/);
  assert.match(source, /notificationService\.initialize\(\)/);
  assert.doesNotMatch(source, /requestPermission\(/);
});

test('settings owns the explicit notification activation action', async () => {
  const source = await readFile(new URL('../src/screens/settings.mjs', import.meta.url), 'utf8');
  assert.match(source, /notifications\.getPermissionStatus/);
  assert.match(source, /notifications\.requestPermission/);
  assert.match(source, /t\('settings\.notificationsActivate'\)/);
  assert.match(source, /t\('settings\.notificationsDescription'\)/);
});

test('notification settings copy is bilingual and non-coercive', async () => {
  const source = await readFile(new URL('../src/core/i18n.mjs', import.meta.url), 'utf8');
  assert.match(source, /notificationsTitle: 'Notificaciones'/);
  assert.match(source, /notificationsActivate: 'Activar notificaciones'/);
  assert.match(source, /notificationsGranted: 'Las notificaciones están activadas\.'/);
  assert.match(source, /notificationsDenied: 'Las notificaciones están desactivadas en los ajustes del sistema\.'/);
  assert.match(source, /notificationsTitle: 'Notifications'/);
  assert.match(source, /notificationsActivate: 'Enable notifications'/);
});

test('package and Capacitor config use the current OneSignal Capacitor plugin', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies['@onesignal/capacitor-plugin'], '1.1.12');
  assert.equal(config.ios?.handleApplicationNotifications, false);
});
