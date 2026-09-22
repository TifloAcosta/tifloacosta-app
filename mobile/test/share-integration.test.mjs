import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('composition root owns one ephemeral Share session and receives cold and warm Android shares', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /import\s*\{\s*classifySharedText/);
  assert.match(app, /import\s*\{\s*createShareSession\s*\}/);
  assert.match(app, /import\s*\{\s*TifloShare\s*\}/);
  assert.match(app, /import\s*\{\s*renderShare\s*\}/);
  assert.match(app, /const\s+shareSession\s*=\s*createShareSession\(\)/);
  assert.match(app, /TifloShare\.getInitialShare\(\)/);
  assert.match(app, /TifloShare\.addListener\(['"]shareReceived['"]/);
  assert.match(app, /beginSharedFlow/);
});

test('new shared content snapshots normal navigation only on entry and replaces the previous session', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /if\s*\(!shareMode\)[\s\S]{0,220}normalRouterSnapshot\s*=\s*router\.snapshot\(\)/);
  assert.match(app, /shareSession\.begin\(/);
  assert.match(app, /shareMode\s*=\s*true/);
  assert.match(app, /router\.start\(['"]share['"]\)/);
});

test('finishing Share clears temporary state, restores normal navigation and asks Android to return', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /async function finishSharedFlow/);
  assert.match(app, /shareSession\.clear\(\)/);
  assert.match(app, /router\.restore\(normalRouterSnapshot/);
  assert.match(app, /normalRouterSnapshot\s*=\s*null/);
  assert.match(app, /shareMode\s*=\s*false/);
  assert.match(app, /nativeActions\.finishSharedFlow\(\)/);
});

test('Share delegates web, video, download and text to existing app functions without autoplay or auto-search', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /case ['"]share['"]/);
  assert.match(app, /renderShare\(\{/);
  assert.match(app, /onOpenVideo:/);
  assert.match(app, /onOpenDownload:/);
  assert.match(app, /onOpenSearch:/);
  assert.match(app, /onFinish:\s*finishSharedFlow/);

  const search = await read('src/screens/search.mjs');
  assert.match(search, /initialQuery/);
  assert.match(search, /input\.value\s*=\s*String\(initialQuery/);
  assert.match(search, /if\s*\(!initialQuery\s*&&\s*lastQuery\)\s*\{[\s\S]{0,180}renderResults\(/);
});

test('Android Back is consumed by Share before normal router navigation', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /if\s*\(shareMode\)\s*return\s+handleShareBack\(\)/);
  assert.match(app, /function handleShareBack/);
  assert.match(app, /shareController\?\.back/);
});

test('normal content refresh never replaces an active Share screen', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /if\s*\(!shareMode\s*&&\s*!textInputIsActive\(\)\)\s*render\(router\.current\(\)\)/);
});
