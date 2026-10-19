import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const visual = source('TifloVisual.swift');
const screens = source('NativeScreens.swift');
const documents = source('NativeDocuments.swift');

function luminance(hex) {
  const values = [16, 8, 0].map(shift => ((hex >> shift) & 0xFF) / 255);
  const [r, g, b] = values.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const aa = luminance(a), bb = luminance(b);
  return (Math.max(aa, bb) + .05) / (Math.min(aa, bb) + .05);
}

test('los colores de marca y superficies mantienen la identidad web y Android', () => {
  assert.match(visual, /166\.0 \/ 255\.0, green: 27\.0 \/ 255\.0, blue: 27\.0 \/ 255\.0/);
  assert.match(visual, /127\.0 \/ 255\.0, green: 20\.0 \/ 255\.0, blue: 20\.0 \/ 255\.0/);
  for (const color of ['FFFFFF','0B0B0B','151010','201414','FFF4F4','D7CACA']) {
    assert.ok(visual.includes('0x' + color), color);
  }
  assert.ok(contrast(0xFFFFFF, 0xA61B1B) >= 4.5);
  assert.ok(contrast(0xFF9D9D, 0x0B0B0B) >= 4.5);
  assert.ok(contrast(0xFF9D9D, 0x201414) >= 4.5);
  assert.ok(contrast(0xFFFFFF, 0x201414) >= 4.5);
  assert.ok(contrast(0x111111, 0xFFF4F4) >= 4.5);
});

test('un único tema gobierna todas las secciones nativas', () => {
  const app = source('TifloAcostaNativeApp.swift');
  assert.match(app, /tint\(TifloVisual\.actionTint\)/);
  for (const name of [
    'NativeScreens.swift', 'NativeDocuments.swift', 'NativeDownloads.swift',
    'NativePodcasts.swift', 'NativeTifloLector.swift', 'NativeSearch.swift',
    'NativeUpdatesSettings.swift', 'NativeShareInbox.swift'
  ]) {
    assert.match(source(name), /tifloScreenSurface\(\)/, name);
  }
  assert.doesNotMatch(screens, /NativeHomePalette/);
});

test('Recursos conserva acciones nativas, con contraste y controles ajustables', () => {
  assert.match(screens, /accessibilityAdjustableAction/);
  for (const action of ['Leer', 'Guardar', 'Descargar', 'Compartir']) {
    assert.ok(screens.includes('.accessibilityAction(named: Text("' + action + '"))'));
    assert.ok(documents.includes('.accessibilityAction(named: Text("' + action + '"))'));
  }
  assert.match(documents, /buttonStyle\(TifloSecondaryActionStyle\(\)\)/);
  assert.match(visual, /foregroundStyle\(TifloVisual\.primaryText\)/);
  assert.doesNotMatch(screens + documents, /WKWebView|UIWebView/);
});

test('Los botones del reproductor respetan la distribución vertical con letra grande', () => {
  const player = source('NativeYouTubePlayer.swift');
  assert.match(player, /dynamicTypeSize\.isAccessibilitySize/);
  assert.match(player, /VStackLayout\(alignment: \.leading, spacing: 8\)/);
  assert.match(player, /Retroceder 30 segundos/);
  assert.match(player, /Avanzar 30 segundos/);
  assert.match(visual, /fixedSize\(horizontal: false, vertical: true\)/);
});
