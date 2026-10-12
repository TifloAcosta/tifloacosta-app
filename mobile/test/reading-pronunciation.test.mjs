import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPronunciationRules, loadPronunciationRules, savePronunciationRules } from '../../shared/reading-pronunciation.mjs';

test('matches case insensitively without changing source text', () => {
  const source = 'NVDA y NVDA son lectores.';
  const spoken = applyPronunciationRules(source, [{ term: 'NVDA', replacement: 'ene uve de a' }]);
  assert.equal(spoken, 'ene uve de a y ene uve de a son lectores.');
  assert.equal(source, 'NVDA y NVDA son lectores.');
});

test('prioritizes longest expression and does not recursively replace', () => {
  assert.equal(applyPronunciationRules('Voice Dream', [
    { term: 'Voice', replacement: 'Dream' },
    { term: 'Voice Dream', replacement: 'Vóis Drim' },
    { term: 'Dream', replacement: 'sueño' }
  ]), 'Vóis Drim');
});

test('ignores empty terms and duplicate words', () => {
  assert.equal(applyPronunciationRules('JAWS', [
    { term: '', replacement: 'none' },
    { term: 'JAWS', replacement: 'yós' },
    { term: 'jaws', replacement: 'duplicate' }
  ]), 'yós');
});

test('persists and reloads normalized rules', () => {
  let stored = '';
  const storage = { setItem: (_, value) => { stored = value; }, getItem: () => stored };
  assert.equal(savePronunciationRules([{ term: ' OCR ', replacement: ' o ce erre ' }], storage), true);
  assert.deepEqual(loadPronunciationRules(storage), [{ term: 'OCR', replacement: 'o ce erre' }]);
});
