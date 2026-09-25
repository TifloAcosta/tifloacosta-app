import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateSession } from '../src/core/update-session.mjs';

test('ordinary available update becomes a flexible prompt', async () => {
  const session = createUpdateSession({
    plugin: {
      async check() { return { available: true, versionCode: 11, priority: 2, flexibleAllowed: true, immediateAllowed: false, installStatus: 0 }; },
      async startFlexible() { return { started: true }; }
    }
  });
  const state = await session.check();
  assert.equal(state.mode, 'flexible');
  assert.equal(state.prompt, true);
  assert.equal((await session.start()).started, true);
  assert.equal(session.state().prompt, false);
});

test('dismissal suppresses duplicate prompt for the same update during this session', async () => {
  const plugin = {
    async check() { return { available: true, versionCode: 11, priority: 2, flexibleAllowed: true, immediateAllowed: false, installStatus: 0 }; }
  };
  const session = createUpdateSession({ plugin });
  await session.check();
  session.dismissForSession();
  assert.equal((await session.check()).prompt, false);
});

test('starting a flexible update suppresses resume prompts until download completes', async () => {
  let installStatus = 0;
  const plugin = {
    async check() { return { available: true, versionCode: 11, priority: 2, flexibleAllowed: true, immediateAllowed: false, installStatus }; },
    async startFlexible() { return { started: true }; }
  };
  const session = createUpdateSession({ plugin });
  await session.check();
  await session.start();
  assert.equal((await session.check()).prompt, false);
  installStatus = 11;
  assert.equal((await session.check()).prompt, true);
});

test('priority 5 immediate update cannot be dismissed', async () => {
  const session = createUpdateSession({
    plugin: {
      async check() { return { available: true, versionCode: 12, priority: 5, flexibleAllowed: true, immediateAllowed: true, installStatus: 0 }; }
    }
  });
  await session.check();
  session.dismissForSession();
  assert.equal(session.state().mode, 'immediate');
  assert.equal(session.state().prompt, true);
});
