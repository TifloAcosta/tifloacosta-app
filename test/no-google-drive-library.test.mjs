import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const DRIVE = /https?:\/\/(?:www\.)?drive\.google\.com\//i;

async function loadResources() {
  const context = { window: {} };
  const base = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  vm.runInNewContext(base, context, { filename: 'data.js' });
  const supplemental = await readFile(new URL('../medical-studies.js', import.meta.url), 'utf8');
  vm.runInNewContext(supplemental, context, { filename: 'medical-studies.js' });
  return Array.isArray(context.window.TIFLO_RESOURCES) ? context.window.TIFLO_RESOURCES : [];
}

function localPathFromUrl(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== 'tifloacosta.com' && parsed.hostname !== 'www.tifloacosta.com') return null;
  return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

test('resource catalog has no Google Drive delivery URLs and every local document exists', async () => {
  const resources = await loadResources();
  assert.ok(resources.length > 0, 'resource catalog should not be empty');
  for (const item of resources) {
    assert.equal(DRIVE.test(String(item.url || '')), false, `${item.id} still uses Drive as url`);
    assert.equal(DRIVE.test(String(item.openUrl || '')), false, `${item.id} still uses Drive as openUrl`);
    for (const candidate of [item.url, item.openUrl].filter(Boolean)) {
      const relative = localPathFromUrl(candidate);
      if (!relative || !relative.startsWith('docs/')) continue;
      await access(new URL(`../${relative}`, import.meta.url));
    }
  }
});

test('ringtone library is hosted locally and complete', async () => {
  const mediaDir = new URL('../docs/media/tones/', import.meta.url);
  const files = await walk(mediaDir);
  const counts = files.reduce((acc, file) => {
    const ext = path.extname(file).toLowerCase();
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});
  assert.equal(counts['.ogg'] || 0, 13, 'expected 13 general OGG tones');
  assert.equal(counts['.mp3'] || 0, 30, 'expected 30 Nokia MP3 tones');
  assert.equal(counts['.m4r'] || 0, 80, 'expected 80 iPhone M4R tones');

  for (const page of ['../docs/es/tonos.html', '../docs/en/ringtones.html']) {
    const html = await readFile(new URL(page, import.meta.url), 'utf8');
    assert.equal(DRIVE.test(html), false, `${page} still links to Google Drive`);
  }
});

test('resource menu no longer contains Drive-specific download code', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('driveDownloadUrl'), false);
  assert.equal(app.includes('extractDriveFileId'), false);
  assert.equal(DRIVE.test(app), false);
});
