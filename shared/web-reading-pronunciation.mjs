// Pronunciation changes affect spoken text only, never the imported document.
const MAX_ENTRIES = 150;
const MAX_SOURCE_CHARS = 80;
const MAX_REPLACEMENT_CHARS = 120;

function text(value) {
  return String(value ?? '').trim().replace(/\s+/gu, ' ');
}

function escapeRegExp(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/gu, '\\$&');
}

export function normalizePronunciationEntries(input) {
  const result = [];
  const seen = new Set();
  for (const entry of Array.isArray(input) ? input : []) {
    const original = text(entry?.original);
    const replacement = text(entry?.replacement);
    if (!original || !replacement || original.length > MAX_SOURCE_CHARS ||
        replacement.length > MAX_REPLACEMENT_CHARS ||
        /[\r\n]/u.test(original + replacement)) continue;
    const key = original.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ original, replacement });
    if (result.length >= MAX_ENTRIES) break;
  }
  return result;
}

// Single-pass substitution prevents replacement text from being replaced again.
// Unicode boundaries protect words with accents, ñ, and non-Latin alphabets.
export function applyPronunciationEntries(value, entries) {
  const source = String(value ?? '');
  const sorted = normalizePronunciationEntries(entries)
    .sort((a, b) => b.original.length - a.original.length);
  if (!source || !sorted.length) return source;
  const pattern = sorted.map(entry => escapeRegExp(entry.original)).join('|');
  const matcher = new RegExp('(^|[^\\p{L}\\p{N}])(' + pattern + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
  const replacements = new Map(sorted.map(entry => [entry.original.toLocaleLowerCase(), entry.replacement]));
  return source.replace(matcher, (whole, prefix, match) =>
    prefix + (replacements.get(match.toLocaleLowerCase()) ?? match));
}

// Wrap native iOS or browser TTS at the append-units boundary.
// Original document, navigation indices, offsets and stored text are unchanged.
export function createPronunciationSpeechAdapter(adapter, getEntries = () => []) {
  if (!adapter || typeof adapter.appendTtsUnits !== 'function') return adapter;
  return {
    ...adapter,
    appendTtsUnits(payload = {}) {
      const values = typeof getEntries === 'function' ? getEntries() : [];
      const units = Array.isArray(payload.units) ? payload.units : [];
      const spokenUnits = units.map(unit => ({
        ...unit,
        text: applyPronunciationEntries(unit.text, values)
      }));
      return adapter.appendTtsUnits({ ...payload, units: spokenUnits });
    }
  };
}
