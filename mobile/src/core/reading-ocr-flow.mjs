const OCR_SCRIPTS = new Set(['latin', 'chinese', 'devanagari', 'japanese', 'korean']);
const PAGE_STATUSES = new Set(['ok', 'empty']);

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function normalizeScript(value) {
  const script = String(value ?? 'latin').trim().toLowerCase();
  return OCR_SCRIPTS.has(script) ? script : 'latin';
}

function normalizePage(value, pageCount) {
  if (!value || typeof value !== 'object') return null;
  const pageIndex = nonNegativeInteger(value.pageIndex, -1);
  if (pageIndex < 0 || pageIndex >= pageCount) return null;
  const status = PAGE_STATUSES.has(value.status) ? value.status : '';
  if (!status) return null;
  return {
    pageIndex,
    text: String(value.text ?? ''),
    blocks: (Array.isArray(value.blocks) ? value.blocks : [])
      .map(block => String(block ?? '').trim())
      .filter(Boolean),
    status
  };
}

function firstMissingPage(pages, pageCount) {
  const present = new Set(pages.map(page => page.pageIndex));
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (!present.has(pageIndex)) return pageIndex;
  }
  return null;
}

export function createReadingOcrFlow({ client, bookId, pageCount, script = 'latin', password = '' } = {}) {
  const cleanBookId = String(bookId ?? '').trim();
  const totalUnits = nonNegativeInteger(pageCount, 0);
  const selectedScript = normalizeScript(script);
  const transientPassword = String(password ?? '');
  let pages = [];
  let status = 'idle';

  function getState() {
    const orderedPages = [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
    const nextMissingPage = firstMissingPage(orderedPages, totalUnits);
    return {
      bookId: cleanBookId,
      script: selectedScript,
      status,
      pageCount: totalUnits,
      completedUnits: orderedPages.length,
      nextMissingPage,
      pages: orderedPages.map(page => ({ ...page, blocks: [...page.blocks] }))
    };
  }

  async function load() {
    pages = [];
    status = 'idle';
    if (!cleanBookId || totalUnits <= 0 || !client?.getDerivedContent) return getState();
    const saved = await client.getDerivedContent({ bookId: cleanBookId, kind: 'ocr', variantKey: selectedScript });
    const sourcePages = Array.isArray(saved?.content?.pages) ? saved.content.pages : [];
    const byIndex = new Map();
    for (const value of sourcePages) {
      const page = normalizePage(value, totalUnits);
      if (page) byIndex.set(page.pageIndex, page);
    }
    pages = [...byIndex.values()].sort((a, b) => a.pageIndex - b.pageIndex);
    status = pages.length >= totalUnits ? 'complete' : pages.length > 0 ? 'partial' : 'idle';
    return getState();
  }

  async function persist() {
    if (!client?.saveDerivedContent) return false;
    const complete = totalUnits > 0 && pages.length >= totalUnits;
    return client.saveDerivedContent({
      bookId: cleanBookId,
      kind: 'ocr',
      variantKey: selectedScript,
      metadata: {
        engine: 'mlkit',
        engineVersion: '1',
        status: complete ? 'complete' : 'partial',
        completedUnits: pages.length,
        totalUnits
      },
      content: {
        version: 1,
        script: selectedScript,
        pages: [...pages].sort((a, b) => a.pageIndex - b.pageIndex)
      }
    });
  }

  async function recognizePage(pageIndex) {
    const requestedPage = nonNegativeInteger(pageIndex, -1);
    if (!cleanBookId || requestedPage < 0 || requestedPage >= totalUnits || !client?.recognizePdfPage) {
      status = 'error';
      return { pageIndex: requestedPage, text: '', blocks: [], status: 'error' };
    }

    status = 'recognizing';
    const result = await client.recognizePdfPage({
      bookId: cleanBookId,
      password: transientPassword,
      pageIndex: requestedPage,
      script: selectedScript
    });
    const resultStatus = String(result?.status ?? 'error');
    if (!PAGE_STATUSES.has(resultStatus)) {
      status = resultStatus === 'model-unavailable' ? 'model-unavailable' : 'error';
      return {
        pageIndex: requestedPage,
        text: String(result?.text ?? ''),
        blocks: Array.isArray(result?.blocks) ? result.blocks : [],
        status: resultStatus
      };
    }

    const page = normalizePage({ ...result, pageIndex: requestedPage, status: resultStatus }, totalUnits);
    if (!page) {
      status = 'error';
      return { pageIndex: requestedPage, text: '', blocks: [], status: 'error' };
    }
    const byIndex = new Map(pages.map(item => [item.pageIndex, item]));
    byIndex.set(requestedPage, page);
    pages = [...byIndex.values()].sort((a, b) => a.pageIndex - b.pageIndex);
    const saved = await persist();
    if (!saved) {
      status = 'error';
      return { ...page, status: 'error' };
    }
    status = pages.length >= totalUnits ? 'complete' : 'partial';
    return { ...page };
  }

  async function resumeNext() {
    const nextPage = firstMissingPage(pages, totalUnits);
    if (nextPage == null) {
      status = 'complete';
      return { pageIndex: Math.max(0, totalUnits - 1), text: '', blocks: [], status: 'complete' };
    }
    return recognizePage(nextPage);
  }

  return { load, recognizePage, resumeNext, getState };
}
