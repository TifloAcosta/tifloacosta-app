import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationService, notificationTargetUrl } from '../src/native/notifications.mjs';

function fakeOneSignal({ permission = false, canRequest = true } = {}) {
  const calls = [];
  const listeners = new Map();
  return {
    calls,
    listeners,
    api: {
      async initialize(appId) { calls.push(['initialize', appId]); },
      Notifications: {
        async hasPermission() { calls.push(['hasPermission']); return permission; },
        async canRequestPermission() { calls.push(['canRequestPermission']); return canRequest; },
        async requestPermission(fallback) { calls.push(['requestPermission', fallback]); return true; },
        addEventListener(name, listener) { listeners.set(name, listener); calls.push(['listen', name]); }
      }
    }
  };
}

test('initialization never requests notification permission', async () => {
  const fake = fakeOneSignal();
  const service = createNotificationService({
    oneSignal: fake.api,
    appId: 'app-id',
    router: { enterExternal() {} }
  });
  await service.initialize();
  assert.deepEqual(fake.calls.slice(0, 2), [['initialize', 'app-id'], ['listen', 'click']]);
  assert.equal(fake.calls.some(call => call[0] === 'requestPermission'), false);
});

test('permission is requested only after explicit activation', async () => {
  const fake = fakeOneSignal();
  const service = createNotificationService({ oneSignal: fake.api, appId: 'app-id', router: { enterExternal() {} } });
  await service.initialize();
  assert.equal(await service.requestPermission(), true);
  assert.deepEqual(fake.calls.at(-1), ['requestPermission', false]);
});

test('status distinguishes granted, available and denied', async () => {
  const granted = createNotificationService({ oneSignal: fakeOneSignal({ permission: true }).api, appId: 'x', router: {} });
  assert.equal(await granted.getPermissionStatus(), 'granted');
  const available = createNotificationService({ oneSignal: fakeOneSignal({ permission: false, canRequest: true }).api, appId: 'x', router: {} });
  assert.equal(await available.getPermissionStatus(), 'available');
  const denied = createNotificationService({ oneSignal: fakeOneSignal({ permission: false, canRequest: false }).api, appId: 'x', router: {} });
  assert.equal(await denied.getPermissionStatus(), 'denied');
});

test('notification click routes only TifloAcosta targets inside the app', async () => {
  const fake = fakeOneSignal();
  const routes = [];
  const service = createNotificationService({
    oneSignal: fake.api,
    appId: 'app-id',
    router: { enterExternal(route) { routes.push(route); } }
  });
  await service.initialize();
  fake.listeners.get('click')({ notification: { launchURL: 'https://tifloacosta.com/biblioteca' } });
  fake.listeners.get('click')({ notification: { launchURL: 'https://example.com/noticia' } });
  assert.deepEqual(routes, ['library']);
});

test('notification target prefers launchURL and accepts an explicit data url fallback', () => {
  assert.equal(notificationTargetUrl({ notification: { launchURL: 'https://tifloacosta.com/videos', additionalData: { url: 'https://other' } } }), 'https://tifloacosta.com/videos');
  assert.equal(notificationTargetUrl({ notification: { additionalData: { url: 'https://tifloacosta.com/actualidad' } } }), 'https://tifloacosta.com/actualidad');
  assert.equal(notificationTargetUrl({ notification: {} }), null);
});
