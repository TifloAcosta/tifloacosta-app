import { parseTextDocument } from './reading-semantic-model.mjs';

const toFiniteInteger = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

export const normalizeReadingPosition = (position, blockCount) => {
  const count = Math.max(0, toFiniteInteger(blockCount));
  if (count === 0) return 0;

  const index = toFiniteInteger(position?.blockIndex);
  return Math.min(count - 1, Math.max(0, index));
};

export const percentForBlock = (blockIndex, blockCount) => {
  const count = Math.max(0, toFiniteInteger(blockCount));
  if (count === 0) return 0;

  const index = normalizeReadingPosition({ blockIndex }, count);
  return ((index + 1) / count) * 100;
};

export const parsePlainText = (value, options = {}) => {
  const document = parseTextDocument(value, options);
  return {
    title: document.title,
    blocks: document.blocks.map(({ id, type, text }) => ({ id, type, text }))
  };
};
