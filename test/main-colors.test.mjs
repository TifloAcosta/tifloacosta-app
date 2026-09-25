import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const clean = hex.replace('#', '');
  const red = channel(Number.parseInt(clean.slice(0, 2), 16));
  const green = channel(Number.parseInt(clean.slice(2, 4), 16));
  const blue = channel(Number.parseInt(clean.slice(4, 6), 16));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

test('los botones principales usan un rojo pastel con texto de alto contraste', () => {
  assert.match(css, /--home-button-bg:\s*#F2B8B5/i);
  assert.match(css, /--home-button-text:\s*#3B0A0A/i);
  assert.match(css, /--home-button-border:\s*#A85B5B/i);
  assert.match(css, /#home-blocks \.button-link[\s\S]*background:\s*var\(--home-button-bg\)/i);
  assert.ok(contrast('#3B0A0A', '#F2B8B5') >= 4.5);
});

test('el enlace de privacidad del pie mantiene contraste suficiente sobre el rojo', () => {
  assert.match(css, /\.site-footer a[\s\S]*color:\s*#FFF/i);
  assert.ok(contrast('#FFFFFF', '#A61B1B') >= 4.5);
});
