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

const LIST_CONTAINER_TAGS = new Set(['UL', 'OL']);

const STRUCTURAL_TYPES = new Map([
  ['P', 'paragraph'],
  ['BLOCKQUOTE', 'quote'],
  ['TD', 'table-cell'],
  ['TH', 'table-cell']
]);

const normalizeInlineText = value => String(value ?? '')
  .replace(/\s+/gu, ' ')
  .trim();

const childNodesOf = node => Array.from(node?.childNodes ?? []);

const tagNameOf = node => String(node?.tagName ?? '').toUpperCase();

const isSemanticStructureTag = tagName => (
  LIST_CONTAINER_TAGS.has(tagName)
  || tagName === 'LI'
  || /^H[1-6]$/u.test(tagName)
  || STRUCTURAL_TYPES.has(tagName)
);

const hasSemanticDescendant = node => childNodesOf(node).some(child => {
  if (child?.nodeType !== 1) return false;
  const tagName = tagNameOf(child);
  if (IGNORED_TAGS.has(tagName)) return false;
  return isSemanticStructureTag(tagName) || hasSemanticDescendant(child);
});

const textFromNode = node => {
  if (!node) return '';

  if (node.nodeType === 3) {
    return String(node.textContent ?? '');
  }

  if (node.nodeType !== 1) return '';

  const tagName = tagNameOf(node);
  if (IGNORED_TAGS.has(tagName)) return '';
  if (tagName === 'BR') return ' ';

  if (tagName === 'IMG') {
    const alt = typeof node.getAttribute === 'function'
      ? node.getAttribute('alt')
      : null;
    return typeof alt === 'string' && alt.trim() ? alt.trim() : '';
  }

  return childNodesOf(node).map(textFromNode).join('');
};

const textFromListItem = node => {
  const read = child => {
    if (!child) return '';
    if (child.nodeType === 3) return String(child.textContent ?? '');
    if (child.nodeType !== 1) return '';

    const tagName = tagNameOf(child);
    if (IGNORED_TAGS.has(tagName) || LIST_CONTAINER_TAGS.has(tagName)) return '';
    if (tagName === 'BR' || tagName === 'IMG') return textFromNode(child);

    return childNodesOf(child).map(read).join('');
  };

  return childNodesOf(node).map(read).join('');
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

  const pushParagraph = text => {
    const block = makeBlock('paragraph', text);
    if (block) blocks.push(block);
  };

  const visit = (node, listDepth = 0) => {
    if (!node || node.nodeType !== 1) return;

    const tagName = tagNameOf(node);
    if (IGNORED_TAGS.has(tagName)) return;

    if (LIST_CONTAINER_TAGS.has(tagName)) {
      for (const child of childNodesOf(node)) visit(child, listDepth + 1);
      return;
    }

    if (tagName === 'LI') {
      const block = makeBlock('list-item', textFromListItem(node), {
        level: Math.max(1, listDepth)
      });
      if (block) blocks.push(block);

      for (const child of childNodesOf(node)) {
        if (child?.nodeType !== 1) continue;
        const childTag = tagNameOf(child);
        if (LIST_CONTAINER_TAGS.has(childTag)) visit(child, listDepth);
      }
      return;
    }

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
      pushParagraph(textFromNode(node));
      return;
    }

    if (!hasSemanticDescendant(node)) {
      pushParagraph(textFromNode(node));
      return;
    }

    let pendingText = '';
    const flushPendingText = () => {
      pushParagraph(pendingText);
      pendingText = '';
    };

    for (const child of childNodesOf(node)) {
      if (child?.nodeType === 3) {
        pendingText += String(child.textContent ?? '');
        continue;
      }

      if (child?.nodeType !== 1) continue;

      const childTag = tagNameOf(child);
      if (IGNORED_TAGS.has(childTag)) continue;

      if (isSemanticStructureTag(childTag) || hasSemanticDescendant(child)) {
        flushPendingText();
        visit(child, listDepth);
        continue;
      }

      pendingText += textFromNode(child);
    }

    flushPendingText();
  };

  visit(detachedDocument.body);

  if (!blocks.length) {
    const fallback = makeBlock('paragraph', textFromNode(detachedDocument.body));
    if (fallback) blocks.push(fallback);
  }

  return { title, language, blocks };
};
