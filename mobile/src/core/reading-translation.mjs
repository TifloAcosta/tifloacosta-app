import { segmentSentences } from './reading-semantic-model.mjs';

const URL_ONLY = /^(?:https?:\/\/|www\.)\S+$/iu;
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 50;

const clean = value => String(value ?? '').trim();
const cleanLanguage = value => clean(value).toLowerCase();

function boundedBatchSize(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.trunc(number)));
}

function cloneBlock(block, blockIndex, language) {
  const text = clean(block?.text);
  const translated = {
    ...block,
    text,
    sentences: Array.isArray(block?.sentences) ? [...block.sentences] : segmentSentences(text, language),
    sourceRef: {
      blockIndex,
      blockId: clean(block?.id) || `block-${blockIndex + 1}`
    }
  };
  if (Array.isArray(block?.links)) translated.links = block.links.map(link => ({ ...link }));
  return translated;
}

function isTranslatableBlock(block) {
  const text = clean(block?.text);
  if (!text) return false;
  if (URL_ONLY.test(text)) return false;
  return true;
}

export function readingTranslationCacheKey({ sourceSha256, sourceLanguage, targetLanguage, engine = 'mlkit' } = {}) {
  return [
    clean(engine).toLowerCase() || 'mlkit',
    cleanLanguage(sourceLanguage) || 'und',
    cleanLanguage(targetLanguage) || 'und',
    clean(sourceSha256) || 'no-sha'
  ].join(':');
}

export function createReadingTranslationJob({
  client,
  bookId,
  document,
  sourceLanguage,
  targetLanguage,
  sourceSha256,
  engine = 'mlkit',
  engineVersion = '1',
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress
} = {}) {
  const cleanBookId = clean(bookId);
  const source = cleanLanguage(sourceLanguage || document?.language);
  const target = cleanLanguage(targetLanguage);
  const sha = clean(sourceSha256);
  const selectedEngine = clean(engine).toLowerCase() || 'mlkit';
  const selectedBatchSize = boundedBatchSize(batchSize);
  const sourceBlocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const translatableIndexes = sourceBlocks
    .map((block, blockIndex) => isTranslatableBlock(block) ? blockIndex : -1)
    .filter(blockIndex => blockIndex >= 0);
  const variantKey = readingTranslationCacheKey({
    sourceSha256: sha,
    sourceLanguage: source,
    targetLanguage: target,
    engine: selectedEngine
  });

  let translatedByIndex = new Map();
  let status = 'idle';

  function translatedDocument() {
    return {
      ...document,
      language: target || document?.language || '',
      sourceLanguage: source,
      targetLanguage: target,
      blocks: sourceBlocks.map((block, blockIndex) => {
        const saved = translatedByIndex.get(blockIndex);
        const next = cloneBlock(block, blockIndex, target || source);
        if (!saved) return next;
        next.text = clean(saved.text);
        next.sentences = segmentSentences(next.text, target || source);
        return next;
      })
    };
  }

  function getState() {
    return {
      bookId: cleanBookId,
      sourceLanguage: source,
      targetLanguage: target,
      sourceSha256: sha,
      variantKey,
      status,
      completedUnits: translatedByIndex.size,
      totalUnits: translatableIndexes.length,
      document: translatedDocument()
    };
  }

  function notifyProgress() {
    if (typeof onProgress === 'function') onProgress(getState());
  }

  async function load() {
    translatedByIndex = new Map();
    status = 'idle';
    if (!client?.getDerivedContent || !cleanBookId || !source || !target) return getState();

    const saved = await client.getDerivedContent({
      bookId: cleanBookId,
      kind: 'translation',
      variantKey
    });
    if (!saved || clean(saved.sourceSha256) !== sha || cleanLanguage(saved.sourceLanguage) !== source || cleanLanguage(saved.targetLanguage) !== target) {
      return getState();
    }

    const blocks = Array.isArray(saved?.content?.blocks) ? saved.content.blocks : [];
    for (const item of blocks) {
      const blockIndex = Number(item?.sourceBlockIndex);
      if (!Number.isInteger(blockIndex) || !translatableIndexes.includes(blockIndex)) continue;
      const text = clean(item?.text);
      if (!text) continue;
      translatedByIndex.set(blockIndex, { text });
    }
    status = translatedByIndex.size >= translatableIndexes.length ? 'complete' : translatedByIndex.size > 0 ? 'partial' : 'idle';
    notifyProgress();
    return getState();
  }

  async function persist() {
    if (!client?.saveDerivedContent) return false;
    const complete = translatedByIndex.size >= translatableIndexes.length;
    const blocks = [...translatedByIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([sourceBlockIndex, value]) => ({ sourceBlockIndex, text: value.text }));
    return client.saveDerivedContent({
      bookId: cleanBookId,
      kind: 'translation',
      variantKey,
      metadata: {
        sourceSha256: sha,
        sourceLanguage: source,
        targetLanguage: target,
        engine: selectedEngine,
        engineVersion: clean(engineVersion) || '1',
        status: complete ? 'complete' : 'partial',
        completedUnits: translatedByIndex.size,
        totalUnits: translatableIndexes.length
      },
      content: {
        version: 1,
        sourceSha256: sha,
        sourceLanguage: source,
        targetLanguage: target,
        blocks
      }
    });
  }

  async function resumeNext() {
    if (!cleanBookId || !source || !target || !client?.translateBatch) {
      status = 'error';
      notifyProgress();
      return getState();
    }
    if (source === target) {
      status = 'complete';
      notifyProgress();
      return getState();
    }

    const remaining = translatableIndexes.filter(blockIndex => !translatedByIndex.has(blockIndex));
    if (remaining.length === 0) {
      status = 'complete';
      notifyProgress();
      return getState();
    }

    status = 'translating';
    notifyProgress();
    const indexes = remaining.slice(0, selectedBatchSize);
    const texts = indexes.map(blockIndex => clean(sourceBlocks[blockIndex]?.text));
    const result = await client.translateBatch({
      sourceLanguage: source,
      targetLanguage: target,
      texts
    });
    const translations = Array.isArray(result?.translations) ? result.translations : [];
    if (translations.length !== texts.length) {
      status = result?.status === 'model-unavailable' ? 'model-unavailable' : 'error';
      notifyProgress();
      return getState();
    }

    indexes.forEach((blockIndex, index) => {
      translatedByIndex.set(blockIndex, { text: clean(translations[index]) });
    });
    const saved = await persist();
    if (!saved) {
      status = 'error';
      notifyProgress();
      return getState();
    }

    status = translatedByIndex.size >= translatableIndexes.length ? 'complete' : 'partial';
    notifyProgress();
    return getState();
  }

  return { load, resumeNext, getState };
}
