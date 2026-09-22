import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeActions } from '../src/core/native-actions.mjs';

function createHarness({ backResult = true } = {}) {
  const calls = [];
  let backHandler = null;
  const appPlugin = {
    addListener(event, handler) { calls.push(['listen', event]); if (event === 'backButton') backHandler = handler; return Promise.resolve({ remove() {} }); },
    exitApp() { calls.push(['exit']); return Promise.resolve(); }
  };
  const sharePlugin = { share(options) { calls.push(['share', options]); return Promise.resolve(); } };
  const browserPlugin = { open(options) { calls.push(['open', options]); return Promise.resolve(); } };
  const router = { back() { calls.push(['back']); return backResult; } };
  return { calls, appPlugin, sharePlugin, browserPlugin, router, triggerBack: () => backHandler?.() };
}

test('Android back delegates to app navigation before exiting', async () => {
  const h = createHarness({ backResult: true });
  const actions = createNativeActions({ appPlugin: h.appPlugin, sharePlugin: h.sharePlugin, browserPlugin: h.browserPlugin });
  await actions.installBackHandler(h.router);
  await h.triggerBack();
  assert.deepEqual(h.calls, [['listen', 'backButton'], ['back']]);
});

test('Android back exits only when there is no in-app screen to return to', async () => {
  const h = createHarness({ backResult: false });
  const actions = createNativeActions({ appPlugin: h.appPlugin, sharePlugin: h.sharePlugin, browserPlugin: h.browserPlugin });
  await actions.installBackHandler(h.router);
  await h.triggerBack();
  assert.deepEqual(h.calls, [['listen', 'backButton'], ['back'], ['exit']]);
});

test('share and external opening use native system plugins with normalized values', async () => {
  const h = createHarness();
  const actions = createNativeActions({ appPlugin: h.appPlugin, sharePlugin: h.sharePlugin, browserPlugin: h.browserPlugin });
  await actions.share({ title: 'Documento', text: 'Texto', url: 'https://tifloacosta.com/doc' });
  await actions.openExternal('https://example.com');
  assert.deepEqual(h.calls, [
    ['share', { title: 'Documento', text: 'Texto', url: 'https://tifloacosta.com/doc', dialogTitle: 'TifloAcosta' }],
    ['open', { url: 'https://example.com' }]
  ]);
});

test('blank external URLs and blank shares are ignored safely', async () => {
  const h = createHarness();
  const actions = createNativeActions({ appPlugin: h.appPlugin, sharePlugin: h.sharePlugin, browserPlugin: h.browserPlugin });
  assert.equal(await actions.openExternal(''), false);
  assert.equal(await actions.share({}), false);
  assert.deepEqual(h.calls, []);
});

test('finishSharedFlow delegates to native finishShare', async () => {
  let called = 0;
  const actions = createNativeActions({
    tifloSharePlugin: {
      async finishShare() {
        called += 1;
        return { finished: true };
      }
    }
  });
  assert.equal(await actions.finishSharedFlow(), true);
  assert.equal(called, 1);
});

test('Android back gives an active share flow first chance to handle Back', async () => {
  const h = createHarness({ backResult: true });
  let shareBacks = 0;
  const actions = createNativeActions({ appPlugin: h.appPlugin });
  await actions.installBackHandler(h.router, {
    beforeBack: () => {
      shareBacks += 1;
      return true;
    }
  });
  await h.triggerBack();
  assert.equal(shareBacks, 1);
  assert.deepEqual(h.calls, [['listen', 'backButton']]);
});
