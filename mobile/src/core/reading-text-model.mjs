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
  let text = typeof value === 'string' ? value : '';
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  text = text.replace(/\r\n?/g, '\n');

  const paragraphs = text
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ')
      .trim())
    .filter(Boolean);

  return {
    title: typeof options.title === 'string' ? options.title : '',
    blocks: paragraphs.map((paragraph, index) => ({
      id: `p-${index + 1}`,
      type: 'paragraph',
      text: paragraph
    }))
  };
};
