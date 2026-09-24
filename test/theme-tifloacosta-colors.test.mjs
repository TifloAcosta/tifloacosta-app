import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [styles, worker, manifestRaw] = await Promise.all([
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8')
]);
const manifest = JSON.parse(manifestRaw);

function luminance(hex) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map(index => parseInt(normalized.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('la paleta principal usa blanco, negro y rojo TifloAcosta con contraste AA', () => {
  assert.match(styles, /--brand:\s*#A61B1B/);
  assert.match(styles, /--brand-hover:\s*#7F1010/);
  assert.match(styles, /--text:\s*#111111/);
  assert.match(styles, /--page-bg:\s*#FFFFFF/);
  assert.match(styles, /--surface:\s*#FFFFFF/);
  assert.match(styles, /--header-bg:\s*#000000/);
  assert.match(styles, /--border:\s*#B8B8B8/);
  assert.match(styles, /--focus:\s*#005FCC/);
  assert.doesNotMatch(styles, /#0D2B45|#082033|#E6F0F7|#C7DBE9/);
  assert.ok(contrast('#A61B1B', '#FFFFFF') >= 4.5);
  assert.ok(contrast('#111111', '#FFFFFF') >= 4.5);
});

test('el cambio de color conserva el marco fluido y los ajustes de lectura', () => {
  assert.match(styles, /--body-line-height:\s*1\.58/);
  assert.match(styles, /html\[data-text-size="large"\]\s*\{\s*--body-size:115%/);
  assert.match(styles, /\.wrap\s*\{\s*width:94vw;\s*margin-inline:auto;\s*\}/);
  assert.match(styles, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,14rem\),1fr\)\)/);
  assert.match(styles, /button,.button-link\s*\{[^}]*min-height:2\.75rem;[^}]*padding:\.65rem \.95rem/s);
});

test('la PWA fuerza una generación nueva del tema y usa el rojo de identidad', () => {
  assert.match(worker, /tifloacosta-app-v2-23-web-parity/);
  assert.match(worker, /\.\/styles\.css\?v=1\.2/);
  assert.equal(manifest.theme_color, '#A61B1B');
  assert.equal(manifest.background_color, '#FFFFFF');
});