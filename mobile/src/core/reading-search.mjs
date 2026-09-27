function normalizedText(value) {
  return String(value ?? '').toLocaleLowerCase();
}

function normalizedLimit(value, fallback = 100) {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
}

function sentenceRanges(block) {
  const text = String(block?.text ?? '');
  const sentences = Array.isArray(block?.sentences) ? block.sentences : [];
  if (!sentences.length) return [{ start: 0, end: text.length }];

  const ranges = [];
  let cursor = 0;
  for (const value of sentences) {
    const sentence = String(value ?? '');
    let start = sentence ? text.indexOf(sentence, cursor) : cursor;
    if (start < 0 && sentence) start = text.indexOf(sentence);
    if (start < 0) start = cursor;
    const end = Math.min(text.length, start + sentence.length);
    ranges.push({ start, end });
    cursor = Math.max(cursor, end);
  }
  return ranges.length ? ranges : [{ start: 0, end: text.length }];
}

function unitIndexForMatch(ranges, matchStart) {
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (matchStart >= range.start && matchStart < Math.max(range.end, range.start + 1)) return index;
  }
  return Math.max(0, ranges.length - 1);
}

function excerptFor(text, start, end) {
  const radius = 48;
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  return `${prefix}${text.slice(from, to).trim()}${suffix}`;
}

function defaultScheduler() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export function createReadingSearchIndex(document, { yieldEvery = 100, scheduler = defaultScheduler } = {}) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const batchSize = Math.max(1, Math.trunc(Number(yieldEvery) || 100));
  const schedule = typeof scheduler === 'function' ? scheduler : defaultScheduler;
  let entries = [];
  let built = false;

  async function build(onProgress) {
    const nextEntries = [];
    let heading = '';

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      const block = blocks[blockIndex] ?? {};
      const text = String(block.text ?? '');
      if (block.type === 'heading' && text.trim()) heading = text.trim();
      nextEntries.push({
        blockIndex,
        text,
        searchableText: normalizedText(text),
        heading,
        ranges: sentenceRanges(block)
      });

      const processed = blockIndex + 1;
      if (processed < blocks.length && processed % batchSize === 0) {
        if (typeof onProgress === 'function') onProgress({ processed, total: blocks.length });
        await schedule();
      }
    }

    entries = nextEntries;
    built = true;
    if (typeof onProgress === 'function') onProgress({ processed: blocks.length, total: blocks.length });
    return api;
  }

  function search(query, { limit = 100 } = {}) {
    const rawQuery = String(query ?? '').trim();
    if (!rawQuery || !built) return { total: 0, results: [] };

    const needle = normalizedText(rawQuery);
    const maxResults = normalizedLimit(limit);
    const results = [];
    let total = 0;

    for (const entry of entries) {
      let from = 0;
      while (from <= entry.searchableText.length - needle.length) {
        const matchStart = entry.searchableText.indexOf(needle, from);
        if (matchStart < 0) break;
        const matchEnd = matchStart + needle.length;
        total += 1;
        if (results.length < maxResults) {
          results.push({
            blockIndex: entry.blockIndex,
            unitIndex: unitIndexForMatch(entry.ranges, matchStart),
            excerpt: excerptFor(entry.text, matchStart, matchEnd),
            heading: entry.heading,
            matchStart,
            matchEnd
          });
        }
        from = Math.max(matchEnd, matchStart + 1);
      }
    }

    return { total, results };
  }

  const api = { build, search };
  return api;
}
