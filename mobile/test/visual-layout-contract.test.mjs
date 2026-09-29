import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('mobile design system reserves safe areas plus breathing room', async () => {
  const css = await read('src/styles.css');
  assert.match(css, /--safe-top\s*:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*var\(--space-3\)\)/);
  assert.match(css, /--safe-bottom\s*:\s*calc\(env\(safe-area-inset-bottom,\s*0px\)\s*\+\s*var\(--space-4\)\)/);
  assert.match(css, /#app[\s\S]*padding-block\s*:\s*var\(--safe-top\)\s+var\(--safe-bottom\)/);
});

test('mobile design system exposes brand, spacing and reusable layout classes', async () => {
  const css = await read('src/styles.css');
  for (const token of ['--brand:', '--brand-deep:', '--background:', '--surface:', '--text:', '--border:', '--focus:', '--space-1:', '--space-6:']) {
    assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const selector of ['.app-brand', '.screen-header', '.action-group', '.content-card', '.section-stack']) {
    assert.match(css, new RegExp(selector.replace('.', '\\.')));
  }
  assert.match(css, /\.action-group[\s\S]*gap\s*:/);
  assert.match(css, /\.action-group[\s\S]*flex-wrap\s*:\s*wrap/);
});

test('home model includes Privacy immediately before Settings', async () => {
  const home = await read('src/screens/home.mjs');
  assert.match(home, /'contact',\s*'privacy',\s*'settings'/);
});

test('mobile theme color uses the TifloAcosta brand default', async () => {
  const html = await read('src/index.html');
  assert.match(html, /name="theme-color"\s+content="#A61B1B"/i);
});
