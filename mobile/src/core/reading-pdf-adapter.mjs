import {
  normalizeSemanticPosition,
  parseTextDocument
} from './reading-semantic-model.mjs';

const textValue = value => typeof value === 'string' ? value : '';

const positiveInteger = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const integer = Math.trunc(number);
  return integer > 0 ? integer : null;
};

const nonNegativeInteger = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
};

export function parsePdfDocument(payload = {}) {
  const title = textValue(payload?.title);
  const author = textValue(payload?.author);
  const language = textValue(payload?.language);
  const sourcePages = Array.isArray(payload?.pages) ? payload.pages : [];
  const pageCount = nonNegativeInteger(payload?.pageCount, sourcePages.length);
  const blocks = [];
  const pages = [];

  for (const sourcePage of sourcePages) {
    const number = positiveInteger(sourcePage?.number);
    if (number === null) continue;

    const pageDocument = parseTextDocument(sourcePage?.text, { language });
    const firstBlockIndex = pageDocument.blocks.length > 0 ? blocks.length : null;

    for (const block of pageDocument.blocks) {
      blocks.push({
        ...block,
        id: `pdf-page-${number}-${block.id}`,
        pageNumber: number
      });
    }

    pages.push({
      number,
      firstBlockIndex,
      lastBlockIndex: pageDocument.blocks.length > 0 ? blocks.length - 1 : null
    });
  }

  return {
    title,
    author,
    language,
    pageCount,
    orderReliable: payload?.orderReliable === true,
    pages,
    blocks
  };
}

export function pageForPosition(document, position) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  if (blocks.length === 0) return null;

  const normalized = normalizeSemanticPosition(position, document);
  return positiveInteger(blocks[normalized.blockIndex]?.pageNumber);
}

export function positionForPage(document, pageNumber) {
  const requestedPage = positiveInteger(pageNumber);
  if (requestedPage === null) return null;

  const pages = Array.isArray(document?.pages) ? document.pages : [];
  const page = pages.find(candidate => positiveInteger(candidate?.number) === requestedPage);
  if (!page || !Number.isInteger(page.firstBlockIndex) || page.firstBlockIndex < 0) return null;

  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  if (page.firstBlockIndex >= blocks.length) return null;

  return { blockIndex: page.firstBlockIndex, unitIndex: 0 };
}
