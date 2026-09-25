import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateSession } from '../src/core/update-session.mjs';

function pluginHarness(sequence = []) {
  const calls = [];
  let index = 0;
  return {
    calls,
    plugin: {
      async check() {
        calls.push(['check']);
        const value = sequence[Math.min(index, sequence.length - 1)];
        index += 1;
        if (value instanceof Error) throw value;
        return value ?? { available: false };
      },
      async startFlexible() { calls.push(['startFlexible']); return { started: true }; },
      async startImmediate() { calls.push(['startImmediate']); return { started: true }; },
      async completeFlexible() { calls.push(['completeFlexible']); return {}; }
    }
  };
}

test('first available update prompts once in the session', async () => {
  const fake = pluginHarness([{ available: true, versionCode: 11, priority: 2, flexibleAllowed: true, immediateAllowed: false }]);
  const session = createUpdateSession({ plugin: fake.plugin });
  const first = await session.check();
  const second = await session.check();
  assert.equal(first.shouldPrompt, true);
  assert.equal(first.mode, 'flexible');
  assert.equal(second.shouldPrompt, false);
});

test('dismiss suppresses the same version for the rest of the session', async () => {
  const info = { available: true, versionCode: 11, priority: 2, flexibleAllowed: true, immediateAllowed: false };
  const fake = pluginHarness([info, info]);
  const session = createUpdateSession({ plugin: fake.plugin });
  await session.check();
  session.dismissForSession();
  const later = await session.check({ force: true });
  assert.equal(later.shouldPrompt, false);
});

test('a newly available version may prompt after an older one was dismissed', async () => {
  const fake = pluginHarness([
    { available: true, versionCode: 11, priority: 2, flexibleAllowed: true },
    { available: true, versionCode: 12, priority: 2, flexibleAllowed: true }
  ]);
  const session = createUpdateSession({ plugin: fake.plugin });
  await session.check();
  session.dismissForSession();
  const newer = await session.check();
  assert.equal(newer.shouldPrompt, true);
  assert.equal(newer.info.versionCode, 12);
});

test('downloaded flexible update requests completion', async () => {
  const fake = pluginHarness([{ available: true, versionCode: 11, priority: 2, flexibleAllowed: true, downloaded: true }]);
  const session = createUpdateSession({ plugin: fake.plugin });
  const state = await session.check();
  assert.equal(state.status, 'downloaded');
  assert.equal(state.shouldPrompt, true);
  await session.complete();
  assert.deepEqual(fake.calls.at(-1), ['completeFlexible']);
});

test('start uses immediate only for priority-five policy', async () => {
  const fake = pluginHarness([{ available: true, versionCode: 11, priority: 5, flexibleAllowed: true, immediateAllowed: true }]);
  const session = createUpdateSession({ plugin: fake.plugin });
  await session.check();
  await session.start();
  assert.deepEqual(fake.calls.at(-1), ['startImmediate']);
});

test('plugin failure becomes unavailable without throwing into the app', async () => {
  const fake = pluginHarness([new Error('native unavailable')]);
  const session = createUpdateSession({ plugin: fake.plugin });
  const state = await session.check();
  assert.equal(state.status, 'unavailable');
  assert.equal(state.shouldPrompt, false);
});
