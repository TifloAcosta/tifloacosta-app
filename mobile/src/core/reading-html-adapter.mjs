import { segmentSentences } from './reading-semantic-model.mjs';

const IGNORED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'OBJECT',
  'EMBED',
  'IFRAME',
  'INPUT',
  'BUTTON',
  'SELECT',
  'TEXTAREA',
  'OPTION',
  'DATALIST'
]);

const STRUCTURAL_TYPES = new Map([
  ['P', 'paragraph'],
  ['LI', 'list-item'],
  ['BLOCKQUOTE', 'quote'],
  ['TD', 'table-cell'],
  ['TH', 'table-cell']
]);

const normalizeInlineText = value => String(value ?? '')
  .replace(/\s+/gu, ' ')
  .trim();

const childNodesOf = node => Array.from(node?.childNodes ?? []);

const textFromNode = node => {
  if (!node) return '';

  if (node.nodeType === 3) {
    return String(node.textContent ?? '');
  }

  if (node.nodeType !== 1) return '';

  const tagName = String(node.tagName ?? '').toUpperCase();
  if (IGNORED_TAGS.has(tagName)) return '';

  if (tagName === 'IMG') {
    const alt = typeof node.getAttribute === 'function'
      ? node.getAttribute('alt')
      : null;
    return typeof alt === 'string' && alt.trim() ? alt.trim() : '';
  }

  return childNodesOf(node).map(textFromNode).join('');
};

const defaultParseDocument = source => {
  if (typeof DOMParser !== 'function') return null;
  return new DOMParser().parseFromString(source, 'text/html');
};

const createBlockFactory = language => {
  const counters = {
    heading: 0,
    paragraph: 0,
    'list-item': 0,
    quote: 0,
    'table-cell': 0
  };

  const prefixes = {
    heading: 'h',
    paragraph: 'p',
    'list-item': 'li',
    quote: 'q',
    'table-cell': 'tc'
  };

  return (type, text, extra = {}) => {
    const normalizedText = normalizeInlineText(text);
    if (!normalizedText) return null;

    counters[type] += 1;
    return {
      id: `${prefixes[type]}-${counters[type]}`,
      type,
      text: normalizedText,
      ...extra,
      sentences: segmentSentences(normalizedText, language)
    };
  };
};

export const parseHtmlDocument = (html, options = {}) => {
  const title = typeof options.title === 'string' ? options.title : '';
  const language = typeof options.language === 'string' ? options.language : '';
  const parseDocument = typeof options.parseDocument === 'function'
    ? options.parseDocument
    : defaultParseDocument;

  let detachedDocument = null;
  try {
    detachedDocument = parseDocument(String(html ?? ''));
  } catch {
    detachedDocument = null;
  }

  if (!detachedDocument?.body) {
    return { title, language, blocks: [] };
  }

  const blocks = [];
  const makeBlock = createBlockFactory(language);

  const visit = node => {
    if (!node || node.nodeType !== 1) return;

    const tagName = String(node.tagName ?? '').toUpperCase();
    if (IGNORED_TAGS.has(tagName)) return;

    if (/^H[1-6]$/u.test(tagName)) {
      const block = makeBlock('heading', textFromNode(node), {
        level: Number(tagName.slice(1))
      });
      if (block) blocks.push(block);
      return;
    }

    const structuralType = STRUCTURAL_TYPES.get(tagName);
    if (structuralType) {
      const block = makeBlock(structuralType, textFromNode(node));
      if (block) blocks.push(block);
      return;
    }

    if (tagName === 'IMG') {
      const block = makeBlock('paragraph', textFromNode(node));
      if (block) blocks.push(block);
      return;
    }

    for (const child of childNodesOf(node)) visit(child);
  };

  for (const child of childNodesOf(detachedDocument.body)) visit(child);

  return { title, language, blocks };
};
