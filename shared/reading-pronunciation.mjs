const STORAGE_KEY = 'tiflolector.pronunciation.v1';
const MAX_ENTRIES = 200;
const MAX_TERM = 100;
const MAX_REPLACEMENT = 200;

export function normalizePronunciationRules(input) {
  const output = [];
  const seen = new Set();
  for (const entry of Array.isArray(input) ? input : []) {
    const term = String(entry?.term ?? '').trim().slice(0, MAX_TERM);
    const replacement = String(entry?.replacement ?? '').trim().slice(0, MAX_REPLACEMENT);
    const key = term.toLocaleLowerCase();
    if (!term || !replacement || seen.has(key)) continue;
    seen.add(key);
    output.push({ term, replacement });
    if (output.length >= MAX_ENTRIES) break;
  }
  return output;
}

export function loadPronunciationRules(storage = globalThis.localStorage) {
  try {
    return normalizePronunciationRules(JSON.parse(storage?.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function savePronunciationRules(entries, storage = globalThis.localStorage) {
  const normalized = normalizePronunciationRules(entries);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function applyPronunciationRules(value, entries) {
  const original = String(value ?? '');
  const rules = normalizePronunciationRules(entries).sort((a, b) => b.term.length - a.term.length);
  if (!rules.length) return original;
  // Single pass: replacement text is never matched again by a different rule.
  const escaped = rules.map(({ term }) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(escaped.join('|'), 'giu');
  const lookup = new Map(rules.map(rule => [rule.term.toLocaleLowerCase(), rule.replacement]));
  return original.replace(expression, match => lookup.get(match.toLocaleLowerCase()) ?? match);
}
