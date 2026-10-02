const toFiniteInteger = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

const normalizeInlineText = value => String(value ?? '')
  .replace(/\s+/gu, ' ')
  .trim();

const fallbackSentenceSegmentation = text => {
  const matches = text.match(/[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/gu) ?? [];
  const sentences = matches.map(normalizeInlineText).filter(Boolean);
  return sentences.length > 0 ? sentences : [text];
};

export const segmentSentences = (value, locale) => {
  const text = normalizeInlineText(value);
  if (!text) return [];

  try {
    if (typeof Intl?.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter(
        typeof locale === 'string' && locale.trim() ? locale.trim() : undefined,
        { granularity: 'sentence' }
      );
      const sentences = [...segmenter.segment(text)]
        .map(entry => normalizeInlineText(entry.segment))
        .filter(Boolean);
      if (sentences.length > 0) return sentences;
    }
  } catch {
    // Invalid or unsupported locales fall back to punctuation-aware segmentation.
  }

  return fallbackSentenceSegmentation(text);
};

const normalizeTextParagraphs = value => {
  let text = typeof value === 'string' ? value : '';
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  text = text.replace(/\r\n?/g, '\n');

  return text
    .split(/\n\s*\n+/)
    .map(paragraph => paragraph
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ')
      .trim())
    .filter(Boolean);
};

export const parseTextDocument = (value, options = {}) => {
  const title = typeof options.title === 'string' ? options.title : '';
  const language = typeof options.language === 'string' ? options.language : '';
  const paragraphs = normalizeTextParagraphs(value);

  return {
    title,
    language,
    blocks: paragraphs.map((paragraph, index) => ({
      id: `p-${index + 1}`,
      type: 'paragraph',
      text: paragraph,
      sentences: segmentSentences(paragraph, language)
    }))
  };
};

export const normalizeSemanticPosition = (position, document) => {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  if (blocks.length === 0) {
    return { blockIndex: 0, unitIndex: 0 };
  }

  const blockIndex = Math.min(
    blocks.length - 1,
    Math.max(0, toFiniteInteger(position?.blockIndex))
  );
  const sentences = Array.isArray(blocks[blockIndex]?.sentences)
    ? blocks[blockIndex].sentences
    : [];
  const unitIndex = sentences.length === 0
    ? 0
    : Math.min(
      sentences.length - 1,
      Math.max(0, toFiniteInteger(position?.unitIndex))
    );

  return { blockIndex, unitIndex };
};

const semanticUnitsForBlock = block => {
  const sentences = Array.isArray(block?.sentences)
    ? block.sentences.map(normalizeInlineText).filter(Boolean)
    : [];
  if (sentences.length > 0) return sentences;

  const text = normalizeInlineText(block?.text);
  return text ? [text] : [];
};

const semanticBlockKind = block => {
  if (block?.type === 'heading') return 'heading';
  if (block?.type === 'list-item') return 'listItem';
  if (block?.type === 'quote') return 'quote';
  if (block?.type === 'table-cell') return 'tableCell';
  return 'paragraph';
};

export const adjacentSemanticUnit = (document, position, direction = 1) => {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  if (blocks.length === 0) {
    return {
      position: { blockIndex: 0, unitIndex: 0 },
      kind: 'paragraph',
      moved: false
    };
  }

  const current = normalizeSemanticPosition(position, document);
  const step = Number(direction) < 0 ? -1 : 1;
  const currentBlock = blocks[current.blockIndex];
  const currentUnits = semanticUnitsForBlock(currentBlock);

  if (step < 0 && current.unitIndex > 0) {
    return {
      position: { blockIndex: current.blockIndex, unitIndex: current.unitIndex - 1 },
      kind: 'sentence',
      moved: true
    };
  }

  if (step > 0 && current.unitIndex + 1 < currentUnits.length) {
    return {
      position: { blockIndex: current.blockIndex, unitIndex: current.unitIndex + 1 },
      kind: 'sentence',
      moved: true
    };
  }

  for (
    let blockIndex = current.blockIndex + step;
    blockIndex >= 0 && blockIndex < blocks.length;
    blockIndex += step
  ) {
    const units = semanticUnitsForBlock(blocks[blockIndex]);
    if (units.length === 0) continue;

    return {
      position: {
        blockIndex,
        unitIndex: step < 0 ? units.length - 1 : 0
      },
      kind: semanticBlockKind(blocks[blockIndex]),
      moved: true
    };
  }

  return {
    position: current,
    kind: semanticBlockKind(currentBlock),
    moved: false
  };
};


export const adjacentSemanticBlockOfKind = (document, position, kind, direction = 1) => {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  if (blocks.length === 0) {
    return {
      position: { blockIndex: 0, unitIndex: 0 },
      kind: String(kind || 'paragraph'),
      moved: false
    };
  }

  const current = normalizeSemanticPosition(position, document);
  const requestedKind = String(kind || 'paragraph');
  const step = Number(direction) < 0 ? -1 : 1;

  for (
    let blockIndex = current.blockIndex + step;
    blockIndex >= 0 && blockIndex < blocks.length;
    blockIndex += step
  ) {
    const block = blocks[blockIndex];
    if (semanticBlockKind(block) !== requestedKind) continue;
    if (semanticUnitsForBlock(block).length === 0) continue;
    return {
      position: { blockIndex, unitIndex: 0 },
      kind: requestedKind,
      moved: true
    };
  }

  return {
    position: current,
    kind: requestedKind,
    moved: false
  };
};
