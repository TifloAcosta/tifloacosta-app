import { createHash } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTOMATION_ID = 'actualidad-auto';
const ADAPTATION_NOTICE = {
  es: 'Adaptación de TifloAcosta basada en la información de la fuente original.',
  en: 'TifloAcosta adaptation based on information from the original source.'
};

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedNow(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid reference date');
  return date;
}

function sourcePriority(source) {
  if (source?.editorialClass === 'official-accessibility' || source?.translationPolicy === 'always-es') return 100;
  if (source?.editorialClass === 'generalist' || source?.adaptationPolicy === 'clean-reader') return 70;
  return -1;
}

export function sourceFingerprint(story) {
  const material = JSON.stringify({
    title: cleanString(story?.title || story?.locales?.[story?.originalLanguage]?.title),
    summary: cleanString(story?.summary || story?.locales?.[story?.originalLanguage]?.summary),
    body: cleanString(story?.body || story?.locales?.[story?.originalLanguage]?.body),
    publishedAt: cleanString(story?.publishedAt),
    originalUrl: cleanString(story?.originalUrl)
  });
  return createHash('sha256').update(material).digest('hex');
}

export function canRetryStory(entry, now = new Date(), config = {}) {
  const attempts = Number(entry?.attempts || 0);
  const maxAttempts = Number(config.maxAttempts || 3);
  if (attempts >= maxAttempts) return false;
  if (!entry?.lastAttemptAt) return true;
  const last = new Date(entry.lastAttemptAt).getTime();
  if (Number.isNaN(last)) return true;
  const waitMs = Number(config.retryAfterMinutes || 60) * 60 * 1000;
  return normalizedNow(now).getTime() - last >= waitMs;
}

function editorialLookup(records = []) {
  const byId = new Map();
  const byUrl = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record !== 'object') continue;
    if (cleanString(record.id)) byId.set(cleanString(record.id), record);
    if (cleanString(record.originalUrl)) byUrl.set(cleanString(record.originalUrl), record);
  }
  return { byId, byUrl };
}

export function selectEvaluationCandidates({ stories, sources, editorial, state, now = new Date(), config = {} }) {
  const reference = normalizedNow(now);
  const sourceMap = new Map((Array.isArray(sources) ? sources : []).map(item => [item?.id, item]));
  const editorialMap = editorialLookup(editorial);
  const states = state?.stories && typeof state.stories === 'object' ? state.stories : {};
  const maxAgeMs = Number(config.candidateMaxAgeDays || 14) * DAY_MS;
  const limit = Number(config.maxEvaluationsPerRun || 6);

  return (Array.isArray(stories) ? stories : [])
    .filter(item => {
      const source = sourceMap.get(item?.sourceId);
      if (sourcePriority(source) < 0) return false;
      const published = new Date(item?.publishedAt).getTime();
      if (Number.isNaN(published) || reference.getTime() - published < 0 || reference.getTime() - published > maxAgeMs) return false;
      const existing = editorialMap.byId.get(item.id) || editorialMap.byUrl.get(item.originalUrl);
      if (existing && isManualRecordProtected(existing)) return false;
      const storyState = states[item.id];
      const fingerprint = sourceFingerprint(item);
      const sourceChanged = Boolean(storyState?.sourceFingerprint && storyState.sourceFingerprint !== fingerprint);
      if (sourceChanged) return true;
      if (existing?.editorialState === 'adapted' || existing?.editorialState === 'withheld') return false;
      if (storyState?.sourceFingerprint === fingerprint && ['source-only', 'adapted', 'withheld'].includes(storyState?.status)) return false;
      return canRetryStory(storyState, reference, config);
    })
    .sort((a, b) => {
      const priority = sourcePriority(sourceMap.get(b.sourceId)) - sourcePriority(sourceMap.get(a.sourceId));
      if (priority) return priority;
      const dateDelta = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (dateDelta) return dateDelta;
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, Math.max(0, limit));
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'with', 'new', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'de', 'del', 'en', 'con', 'para', 'nueva', 'nuevo']);

function titleTokens(value) {
  return new Set(cleanString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token)));
}

function tokenSimilarity(a, b) {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.min(left.size, right.size);
}

export function findCorroboratingStory(story, stories = []) {
  let best = null;
  let bestScore = 0;
  for (const candidate of Array.isArray(stories) ? stories : []) {
    if (!candidate || candidate.id === story?.id || candidate.sourceId === story?.sourceId) continue;
    const score = tokenSimilarity(story?.title, candidate.title);
    if (score >= 0.6 && score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function localeErrors(locales, lang, label) {
  const locale = locales?.[lang];
  const errors = [];
  if (!cleanString(locale?.title)) errors.push(`${label} title is required`);
  if (!cleanString(locale?.summary)) errors.push(`${label} summary is required`);
  if (!cleanString(locale?.body)) errors.push(`${label} body is required`);
  return errors;
}

function hardFacts(value) {
  const text = cleanString(value);
  const facts = new Set();
  for (const match of text.matchAll(/(?:[$€£]\s?\d+(?:[.,]\d+)?|\b\d+(?:\.\d+){1,3}\b|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}\b|\b\d+(?:[.,]\d+)?\s?(?:%|GB|TB|MB|GHz|MHz|mAh)\b)/gi)) {
    facts.add(match[0].toLowerCase().replace(/\s+/g, ''));
  }
  return facts;
}

function sourceEvidence(story, extraEvidence = '') {
  return [story?.title, story?.summary, story?.body, story?.publishedAt, extraEvidence].map(cleanString).filter(Boolean).join(' ');
}

function copiedLongSentence(story, generated) {
  const source = [story?.summary, story?.body].map(cleanString).filter(Boolean).join(' ');
  if (source.length < 80) return false;
  const sentences = source.split(/(?<=[.!?])\s+/).map(item => item.trim()).filter(item => item.length >= 80);
  const output = cleanString(generated);
  return sentences.some(sentence => output.includes(sentence));
}

export function validateAdaptation(story, generation, { extraEvidence = '' } = {}) {
  const errors = [
    ...localeErrors(generation?.locales, 'es', 'Spanish'),
    ...localeErrors(generation?.locales, 'en', 'English')
  ];

  if (errors.length) return { ok: false, errors };

  const evidenceFacts = hardFacts(sourceEvidence(story, extraEvidence));
  const output = ['es', 'en'].flatMap(lang => {
    const locale = generation.locales[lang];
    return [locale.title, locale.summary, locale.body];
  }).join(' ');
  const outputFacts = hardFacts(output);
  const unsupported = [...outputFacts].filter(fact => !evidenceFacts.has(fact));
  if (unsupported.length) errors.push(`Adaptation contains unsupported hard facts: ${unsupported.join(', ')}`);

  for (const lang of ['es', 'en']) {
    const locale = generation.locales[lang];
    if (copiedLongSentence(story, `${locale.summary} ${locale.body}`)) {
      errors.push(`${lang} adaptation copies a long source sentence verbatim`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function canonicalRecord(record) {
  return {
    id: cleanString(record?.id),
    originalUrl: cleanString(record?.originalUrl),
    editorialState: cleanString(record?.editorialState),
    locales: record?.locales || {},
    categories: Array.isArray(record?.categories) ? record.categories : [],
    featuredRank: record?.featuredRank ?? null
  };
}

export function automaticRecordHash(record) {
  return createHash('sha256').update(JSON.stringify(canonicalRecord(record))).digest('hex');
}

export function isManualRecordProtected(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.automation?.generatedBy !== AUTOMATION_ID) return true;
  const expected = cleanString(record.automation?.autoHash);
  if (!expected) return true;
  return automaticRecordHash(record) !== expected;
}

function bodyWithNotice(lang, value) {
  const notice = ADAPTATION_NOTICE[lang];
  const body = cleanString(value).split(notice).join('').trim();
  return `${notice}\n\n${body}`.trim();
}

export function buildEditorialRecord(story, generation, metadata = {}) {
  const record = {
    id: story.id,
    originalUrl: story.originalUrl,
    editorialState: 'adapted',
    locales: {
      es: {
        title: cleanString(generation?.locales?.es?.title),
        summary: cleanString(generation?.locales?.es?.summary),
        body: bodyWithNotice('es', generation?.locales?.es?.body)
      },
      en: {
        title: cleanString(generation?.locales?.en?.title),
        summary: cleanString(generation?.locales?.en?.summary),
        body: bodyWithNotice('en', generation?.locales?.en?.body)
      }
    },
    categories: Array.isArray(generation?.categories) && generation.categories.length ? [...new Set(generation.categories)] : [...(story.categories || [])],
    featuredRank: generation?.featuredRank ?? null,
    automation: {
      generatedBy: AUTOMATION_ID,
      model: cleanString(metadata.model),
      evaluatedAt: cleanString(metadata.evaluatedAt),
      adaptedAt: cleanString(metadata.adaptedAt),
      validation: 'passed',
      autoHash: ''
    }
  };
  record.automation.autoHash = automaticRecordHash(record);
  return record;
}
