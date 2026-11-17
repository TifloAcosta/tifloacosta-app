import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReportRows } from './apple-analytics-aggregate.mjs';

test('keeps downloads, deletion events and dates separate', () => {
  const result = summarizeReportRows([
    { Date: '2026-11-15', Counts: '2', 'Download Type': 'First-time download', Event: 'Install', Territory: 'ES', Device: 'iPhone', 'Source Type': 'Search' },
    { Date: '2026-11-15', Counts: '3', 'Download Type': 'First-time download', Event: 'Delete', Territory: 'ES', Device: 'iPhone', 'Source Type': 'Search' },
    { Date: '2026-11-16', Counts: '4', 'Download Type': 'Redownload', Event: 'Install', Territory: 'PT', Device: 'iPad', 'Source Type': 'Browse' },
  ]);
  assert.equal(result.metric, 'Counts');
  assert.deepEqual(result.byDate, { '2026-11-15': 5, '2026-11-16': 4 });
  assert.deepEqual(result.byEvent, { Delete: 3, Install: 6 });
  assert.deepEqual(result.byTerritory, { ES: 5, PT: 4 });
  assert.deepEqual(result.byDevice, { iPad: 4, iPhone: 5 });
  assert.deepEqual(result.bySource, { Browse: 4, Search: 5 });
  assert.deepEqual(result.byDownloadType, { 'First-time download': 5, Redownload: 4 });
});

test('aggregates sessions without inventing download counts', () => {
  const result = summarizeReportRows([
    { Date: '2026-11-16', Sessions: '3', Territory: 'ES', Device: 'iPhone' },
    { Date: '2026-11-16', Sessions: '4', Territory: 'ES', Device: 'iPad' },
  ]);
  assert.equal(result.metric, 'Sessions');
  assert.deepEqual(result.byDate, { '2026-11-16': 7 });
  assert.equal(result.byDownloadType, undefined);
  assert.equal(result.byEvent, undefined);
});

test('rejects malformed numeric data instead of publishing partial totals', () => {
  assert.throws(() => summarizeReportRows([
    { Date: '2026-11-16', Counts: '2' },
    { Date: '2026-11-16', Counts: 'not-a-number' },
  ]), /no válido/);
});
