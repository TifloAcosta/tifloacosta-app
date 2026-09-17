import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationService } from '../src/native/notifications.mjs';

test('notification status can be checked without requesting permission', async () => {
  const calls = [];
  const service = createNotificationService({
    status: async () => { calls.push('status'); return 'not-requested'; },
    request: async () => { calls.push('request'); return 'authorized'; },
    openSettings: async () => { calls.push('settings'); }
  });

  assert.equal(await service.status(), 'not-requested');
  assert.deepEqual(calls, ['status']);
});

test('permission is requested only from the explicit user-action method', async () => {
  const calls = [];
  const service = createNotificationService({
    status: async () => 'not-requested',
    request: async () => { calls.push('request'); return 'authorized'; },
    openSettings: async () => {}
  });

  assert.equal(await service.requestFromUserAction(), 'authorized');
  assert.deepEqual(calls, ['request']);
});

test('denied users can be sent to system settings through an explicit action', async () => {
  let opened = 0;
  const service = createNotificationService({
    status: async () => 'denied',
    request: async () => 'denied',
    openSettings: async () => { opened += 1; return true; }
  });

  assert.equal(await service.openSystemSettings(), true);
  assert.equal(opened, 1);
});

test('missing native notification adapter stays unavailable and never throws', async () => {
  const service = createNotificationService(null);
  assert.equal(await service.status(), 'unavailable');
  assert.equal(await service.requestFromUserAction(), 'unavailable');
  assert.equal(await service.openSystemSettings(), false);
});
