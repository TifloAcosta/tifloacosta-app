import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const news = readFileSync(new URL('../Sources/NativeNews.swift', import.meta.url), 'utf8');

test('Actualidad ofrece acción de traducción en cada noticia', () => {
  assert.match(news, /accessibilityAction\(named: Text\("Traducir noticia"\)\)/);
  assert.match(news, /articleToTranslate = item/);
  assert.match(news, /sheet\(item: \$articleToTranslate\)/);
  assert.match(news, /NativeOnDemandTranslationScreen\(/);
  assert.match(news, /NativeNewsMetadata\.articleText\(item\)/);
  assert.match(news, /if #available\(iOS 18\.0, \*\)/);
});
