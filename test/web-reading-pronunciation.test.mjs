import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePronunciationEntries,
  applyPronunciationEntries,
  createPronunciationSpeechAdapter
} from '../shared/web-reading-pronunciation.mjs';

test('pronunciation rules support Spanish accents and match whole words and phrases', () => {
  const rules = [
    { original: 'técnica', replacement: 'téc ni ca' },
    { original: 'IA', replacement: 'inteligencia artificial' },
    { original: 'lector de pantalla', replacement: 'lector accesible' }
  ];
  assert.equal(
    applyPronunciationEntries('La técnica de IA ayuda al lector de pantalla.', rules),
    'La téc ni ca de inteligencia artificial ayuda al lector accesible.'
  );
  assert.equal(applyPronunciationEntries('diario, IA123, mástécnica', rules), 'diario, IA123, mástécnica');
});

test('pronunciation is single pass, escaping metacharacters and resisting chained replacements', () => {
  const rules = [
    { original: 'A.B', replacement: 'IA' },
    { original: 'IA', replacement: 'ojo' }
  ];
  assert.equal(applyPronunciationEntries('A.B, IA y A?B', rules), 'IA, ojo y A?B');
});

test('normalize preserves first valid rules, rejects duplicates, empties and excessive length', () => {
  const rules = normalizePronunciationEntries([
    { original: '  Ñandú ', replacement: ' nan dú ' },
    { original: 'ñandú', replacement: 'duplicada' },
    { original: ' ', replacement: 'x' },
    { original: 'x'.repeat(81), replacement: 'y' },
    { original: 'bien', replacement: ' y '.repeat(200) }
  ]);
  assert.deepEqual(rules, [{ original: 'Ñandú', replacement: 'nan dú' }]);
});

test('wrapped TTS speaks corrected text and preserves source documents and exact positions', async () => {
  const originalUnits = [
    { blockIndex: 3, unitIndex: 1, text: 'Tiflolector es útil.' },
    { blockIndex: 3, unitIndex: 2, text: 'La IA responde.' }
  ];
  const originalJSON = JSON.stringify(originalUnits);
  const seen = [];
  const native = {
    async appendTtsUnits(payload) {
      seen.push(payload);
      return true;
    },
    async beginTtsSession() { return true; },
    async commitTtsSession() { return true; }
  };
  let entries = [{ original: 'IA', replacement: 'inteligencia artificial' }];
  const bridged = createPronunciationSpeechAdapter(native, () => entries);
  await bridged.appendTtsUnits({ sessionId: 'session', units: originalUnits });
  assert.equal(seen[0].units[1].text, 'La inteligencia artificial responde.');
  assert.deepEqual(seen[0].units.map(({ blockIndex, unitIndex }) => [blockIndex, unitIndex]), [[3, 1], [3, 2]]);
  assert.equal(JSON.stringify(originalUnits), originalJSON, 'Stored source text must never change');
  entries = [{ original: 'útil', replacement: 'práctico' }];
  await bridged.appendTtsUnits({ sessionId: 'session', units: originalUnits });
  assert.equal(seen[1].units[0].text, 'Tiflolector es práctico.');
  assert.equal(typeof bridged.commitTtsSession, 'function', 'Native adapter must retain all other methods');
});

test('real packaged iOS reader has accessible saved pronunciation editor and bridge', async () => {
  const { readFile } = await import('node:fs/promises');
  const [web, html, entry, patch] = await Promise.all([
    readFile(new URL('../web-reading.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../shared/web-entry.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../ios-build/patch-reading-native.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(entry, /createPronunciationSpeechAdapter/);
  assert.match(web, /shared\.createPronunciationSpeechAdapter\(speechAdapter, \(\) => pronunciationEntries\)/);
  assert.match(web, /PRONUNCIATION_STORAGE_KEY/);
  assert.match(web, /localStorage\.setItem\(PRONUNCIATION_STORAGE_KEY/);
  assert.match(web, /setupPronunciationDictionary\(\)/);
  assert.match(html, /<details id="reading-pronunciation-settings">/);
  assert.match(html, /id="reading-pronunciation-status" role="status" aria-live="polite"/);
  assert.match(patch, /const speechAdapter = typeof shared\.createWebReadingSpeechAdapter/);
});
