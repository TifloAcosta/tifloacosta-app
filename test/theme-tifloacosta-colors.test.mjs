import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [styles, worker, manifestText] = await Promise.all([
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8')
]);
const manifest = JSON.parse(manifestText);

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const channels = hexToRgb(hex).map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('la paleta principal usa blanco, negro y rojo TifloAcosta con contraste AA', () => {
  assert.match(styles, /--brand:\s*#A61B1B/i);
  assert.match(styles, /--brand-deep:\s*#7F1414/i);
  assert.match(styles, /--bg:\s*#FFFFFF/i);
  assert.match(styles, /--text:\s*#111111/i);
  assert.match(styles, /--surface:\s*#FFFFFF/i);
  assert.match(styles, /--surface-alt:\s*#FFF4F4/i);
  assert.match(styles, /--button-bg:\s*#A61B1B/i);
  assert.match(styles, /--button-text:\s*#FFFFFF/i);
  assert.ok(contrast('#A61B1B', '#FFFFFF') >= 4.5);
  assert.ok(contrast('#111111', '#FFFFFF') >= 7);
});

test('el cambio de color conserva el marco fluido y los ajustes de lectura', () => {
  assert.match(styles, /--body-size:\s*100%/);
  assert.match(styles, /--body-line-height:\s*1\.58/);
  assert.match(styles, /html\[data-text-size="large"\]\s*\{\s*--body-size:115%/);
  assert.match(styles, /\.wrap\s*\{\s*width:94vw;\s*margin-inline:auto;\s*\}/);
  assert.match(styles, /grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,14rem\),1fr\)\)/);
  assert.match(styles, /button,.button-link\s*\{[^}]*min-height:2\.75rem;[^}]*padding:\.65rem \.95rem/s);
});

test('la PWA fuerza una generación nueva del tema y usa el rojo de identidad', () => {
  assert.match(worker, /tifloacosta-app-v2-25-colors/);
  assert.match(worker, /\.\/styles\.css\?v=1\.2/);
  assert.equal(manifest.theme_color, '#A61B1B');
  assert.equal(manifest.background_color, '#FFFFFF');
});
