import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('composition root registers every approved mobile screen exactly as a dedicated route', async () => {
  const app = await read('src/app.mjs');
  for (const route of ['home','actualidad','search','library','favorites','videos','book','podcast','contact','settings']) assert.match(app, new RegExp(`case ['"]${route}['"]`));
  assert.doesNotMatch(app, /renderPlaceholder/);
});
test('mobile document keeps one native main landmark and never steals initial focus', async () => {
  const html = await read('src/index.html');
  assert.equal((html.match(/<main\b/gi) || []).length, 1);
  assert.doesNotMatch(html, /autofocus/i);
  assert.doesNotMatch(html, /aria-role|role=["']main["']/i);
  assert.match(html, /href=["']#app["']/i);
});
test('startup keeps preferences before first render and remote content refresh after Home starts', async () => {
  const app = await read('src/app.mjs');
  const applyPreferences = app.indexOf('applyPreferences(document.documentElement');
  const startHome = app.indexOf("router.start('home')");
  const loadContent = app.indexOf('contentStore.load()');
  assert.ok(applyPreferences >= 0 && startHome > applyPreferences);
  assert.ok(loadContent > startHome);
  assert.match(app, /if \(!shareMode\s*&&\s*!textInputIsActive\(\)\)\s*render\(router\.current\(\)\)/);
});
test('settings always receives a safe notification service even before a native provider is connected', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /createNotificationService/);
  assert.match(app, /const\s+notificationService\s*=\s*createNotificationService\(null\)/);
  assert.match(app, /notificationService[,\s]/);
});

test('composition root wires native share reception, ephemeral session and dedicated share routes', async () => {
  const app = await read('src/app.mjs');
  for (const expected of [
    "createShareSession",
    "classifySharedText",
    "TifloShare",
    "TifloWebFetch",
    "renderShare",
    "case 'share'",
    "case 'share-video'",
    "case 'share-download'",
    "case 'share-search'",
    "getInitialShare()",
    "shareReceived",
    "beginSharedFlow",
    "router.snapshot()",
    "router.restore(normalRouterSnapshot",
    "finishSharedFlow"
  ]) assert.ok(app.includes(expected), `Missing share integration: ${expected}`);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*(?:shared|share)/i);
});

test('remote content refresh cannot replace an active shared-content screen', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /if \(!shareMode\s*&&\s*!textInputIsActive\(\)\)\s*render\(router\.current\(\)\)/);
});
