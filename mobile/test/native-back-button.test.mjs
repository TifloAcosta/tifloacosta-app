import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackButtonHandler } from '../src/native/back-button.mjs';

test('secondary-screen back stays inside TifloAcosta', async () => {
  let exitCalls = 0;
  let backCalls = 0;
  const handler = createBackButtonHandler({
    router: { back() { backCalls += 1; return true; } },
    appPlugin: { async exitApp() { exitCalls += 1; } }
  });

  await handler();
  assert.equal(backCalls, 1);
  assert.equal(exitCalls, 0);
});

test('back at Home exits only after router has no previous route', async () => {
  let exitCalls = 0;
  const handler = createBackButtonHandler({
    router: { back() { return false; } },
    appPlugin: { async exitApp() { exitCalls += 1; } }
  });

  await handler();
  assert.equal(exitCalls, 1);
});