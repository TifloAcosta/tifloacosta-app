import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { audiobookPercent } from '../../shared/reading-audio.mjs';

function textProgressHelpers() {
  const source = readFileSync(new URL('../src/screens/reading-book.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('function allReadingUnits(');
  const end = source.indexOf('function readableDuration(', start);
  assert.ok(start >= 0 && end > start, 'Reading progress helpers are present');
  return vm.runInNewContext(`(() => {
    ${source.slice(start, end)}
    return { percentForPosition, positionForPercent, estimatedReadingTimes };
  })()`, {
    unitsFor(block) {
      return Array.isArray(block?.sentences) && block.sentences.length
        ? block.sentences
        : block?.text ? [block.text] : [];
    }
  });
}

test('book text starts at 0 percent, without counting the current sentence as heard', () => {
  const { percentForPosition, estimatedReadingTimes } = textProgressHelpers();
  const model = { blocks: [
    { sentences: ['One short introduction.'] },
    { sentences: ['many '.repeat(300).trim()] }
  ] };
  assert.equal(percentForPosition(model, { blockIndex: 0, unitIndex: 0 }), 0);
  const afterIntroduction = percentForPosition(model, { blockIndex: 1, unitIndex: 0 });
  assert.ok(afterIntroduction > 0 && afterIntroduction < 2, 'Tiny introductory section cannot count as 50% of a book');
  assert.equal(estimatedReadingTimes(model, { blockIndex: 0, unitIndex: 0 }).elapsedSeconds, 0);
});

test('go to percentage follows the same book-wide word weights as progress', () => {
  const { percentForPosition, positionForPercent } = textProgressHelpers();
  const model = { blocks: [
    { sentences: ['long '.repeat(99).trim()] },
    { sentences: ['final'] }
  ] };
  const halfway = positionForPercent(model, 50);
  assert.equal(halfway.blockIndex, 0);
  assert.equal(positionForPercent(model, 100).blockIndex, 1);
  assert.equal(percentForPosition(model, { blockIndex: 1, unitIndex: 0 }), 99);
});

test('DAISY multi-track percentage never substitutes current clip duration for entire book', () => {
  const partial = [{ trackIndex: 0, durationMs: 20000 }, { trackIndex: 1, durationMs: 0 }];
  assert.equal(audiobookPercent(partial, 0, 2000, 20000, 0, 2), 0);
  assert.equal(audiobookPercent([], 0, 2000, 20000, 0, 12), 0);
  assert.equal(audiobookPercent(partial, 0, 2000, 20000, 7, 2), 7, 'Uncertain progress preserves prior book progress');
  const complete = [{ trackIndex: 0, durationMs: 20000 }, { trackIndex: 1, durationMs: 180000 }];
  assert.equal(audiobookPercent(complete, 0, 2000, 20000, 0, 2), 1);
  assert.equal(audiobookPercent(complete, 1, 180000, 180000, 0, 2), 100);
  assert.equal(audiobookPercent([], 0, 2000, 20000, 0, 1), 10, 'A single MP3 may use its own duration');
});
