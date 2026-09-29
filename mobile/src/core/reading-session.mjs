function clampIndex(value, blockCount) {
  const count = Math.max(0, Math.trunc(Number(blockCount) || 0));
  if (count === 0) return 0;
  const number = Number(value);
  const index = Number.isFinite(number) ? Math.trunc(number) : 0;
  return Math.min(count - 1, Math.max(0, index));
}

export function createReadingSession({ blocks = [], initialIndex = 0 } = {}) {
  const items = Array.isArray(blocks) ? blocks : [];
  let index = clampIndex(initialIndex, items.length);

  function current() {
    return items[index] || null;
  }

  function previous() {
    if (!items.length) return null;
    index = Math.max(0, index - 1);
    return current();
  }

  function next() {
    if (!items.length) return null;
    index = Math.min(items.length - 1, index + 1);
    return current();
  }

  function snapshot() {
    if (!items.length) return { blockIndex: 0, percent: 0 };
    return {
      blockIndex: index,
      percent: ((index + 1) * 100) / items.length
    };
  }

  return { current, previous, next, snapshot };
}
