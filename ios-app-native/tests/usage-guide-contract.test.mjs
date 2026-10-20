import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const home = read('NativeScreens.swift');
const guide = read('NativeUsageGuide.swift');

test('Guía de uso aparece como un botón independiente antes de las secciones', () => {
  assert.match(home, /NavigationLink\s*\{\s*NativeUsageGuideScreen\(\)/);
  assert.match(home, /searchPanel\s+guidePanel\s+destinationsPanel/);
  assert.match(home, /\.accessibilityLabel\(languageIndex == 1 \? "User guide" : "Guía de uso"\)/);
  assert.equal((home.match(/\bguidePanel\s*$/gm) ?? []).length, 1);
});

test('La guía muestra solo la lista de secciones y luego solo el texto elegido', () => {
  assert.match(guide, /ForEach\(NativeGuideContent\.sections\)/);
  assert.match(guide, /NativeUsageGuideDetailScreen\(section: section, english: english\)/);
  assert.match(guide, /ForEach\(Array\(section\.paragraphs\(english: english\)\.enumerated\(\)\)/);
  assert.doesNotMatch(guide, /WKWebView|UIWebView|SFSafariViewController|import Capacitor/);
  assert.match(guide, /\.tifloScreenSurface\(\)/);
  assert.match(guide, /TifloVisual\.brandRed/);
});

test('Todos los destinos actuales tienen ayuda en español e inglés, sin contenidos extras', () => {
  const start = home.split('private enum NativeDestination: String, CaseIterable')[1]
    .split('var id: String')[0];
  const appLabels = [...start.matchAll(/case\s+\w+\s*=\s*"([^"]+)"/g)].map(match => match[1]);
  const guideLabels = [...guide.matchAll(/spanishTitle:\s*"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(guideLabels, appLabels);
  assert.equal((guide.match(/englishParagraphs:\s*\[/g) ?? []).length, appLabels.length);
  assert.equal((guide.match(/spanishParagraphs:\s*\[/g) ?? []).length, appLabels.length);
  assert.match(guide, /@AppStorage\("native-ios-language"\)/);
});
