import { segmentSentences } from './reading-semantic-model.mjs';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'list-item', 'quote', 'table-cell']);

const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

const integer = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const nonNegative = value => Math.max(0, integer(value, 0));

const normalizeBlock = (value, index, language) => {
  if (!value || typeof value !== 'object') return null;
  const text = clean(value.text);
  if (!text) return null;
  const type = BLOCK_TYPES.has(value.type) ? value.type : 'paragraph';
  const block = {
    id: clean(value.id) || `structured-${index + 1}`,
    type,
    text,
    sentences: segmentSentences(text, language)
  };
  if (type === 'heading') block.level = Math.min(6, Math.max(1, integer(value.level, 1)));
  const href = clean(value.href);
  if (href) block.href = href;
  if (Array.isArray(value.links)) {
    block.links = value.links
      .map(link => {
        if (!link || typeof link !== 'object') return null;
        const target = clean(link.href);
        if (!target) return null;
        return {
          text: clean(link.text),
          href: target,
          external: link.external === true
        };
      })
      .filter(Boolean);
  }
  return block;
};

const normalizeNavigation = value => (Array.isArray(value) ? value : [])
  .map(item => {
    if (!item || typeof item !== 'object') return null;
    const label = clean(item.label);
    const href = clean(item.href);
    if (!label || !href) return null;
    return { label, href, level: Math.max(1, integer(item.level, 1)) };
  })
  .filter(Boolean);

const normalizePages = value => (Array.isArray(value) ? value : [])
  .map(item => {
    if (!item || typeof item !== 'object') return null;
    const label = clean(item.label);
    const href = clean(item.href);
    return label && href ? { label, href } : null;
  })
  .filter(Boolean);

const normalizeSync = value => (Array.isArray(value) ? value : [])
  .map(item => {
    if (!item || typeof item !== 'object') return null;
    const textHref = clean(item.textHref);
    const audioHref = clean(item.audioHref);
    if (!textHref || !audioHref) return null;
    return {
      textHref,
      audioHref,
      clipBeginMs: nonNegative(item.clipBeginMs),
      clipEndMs: nonNegative(item.clipEndMs)
    };
  })
  .filter(Boolean);

export function parseStructuredDocument(value = {}, options = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const language = clean(source.language || options.language);
  return {
    title: clean(source.title || options.title),
    author: clean(source.author),
    language,
    blocks: (Array.isArray(source.blocks) ? source.blocks : [])
      .map((block, index) => normalizeBlock(block, index, language))
      .filter(Boolean),
    navigation: normalizeNavigation(source.navigation),
    pageReferences: normalizePages(source.pageReferences),
    mediaSyncReferences: normalizeSync(source.mediaSyncReferences)
  };
}
