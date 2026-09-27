const DEFAULTS = Object.freeze({
  'speech.rate': 1,
  'speech.voice': '',
  'visual.textSize': 1,
  'visual.fontFamily': 'system',
  'visual.fontWeight': 'normal',
  'visual.lineSpacing': 1.5,
  'visual.paragraphSpacing': 1,
  'visual.readingWidth': 72,
  'visual.foreground': '',
  'visual.background': '',
  'visual.highContrast': false,
  'visual.theme': 'system'
});

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max, fallback) {
  return Math.min(max, Math.max(min, numberOr(value, fallback)));
}

function choice(value, allowed, fallback) {
  const normalized = String(value ?? '').trim();
  return allowed.has(normalized) ? normalized : fallback;
}

function bool(value, fallback = false) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function sanitize(key, value) {
  switch (key) {
    case 'speech.rate': return clamp(value, 0.5, 2, DEFAULTS[key]);
    case 'speech.voice': return String(value ?? '').trim();
    case 'visual.textSize': return clamp(value, 0.75, 2, DEFAULTS[key]);
    case 'visual.fontFamily': return choice(value, new Set(['system', 'serif', 'sans-serif', 'monospace']), DEFAULTS[key]);
    case 'visual.fontWeight': return choice(value, new Set(['normal', 'medium', 'bold']), DEFAULTS[key]);
    case 'visual.lineSpacing': return clamp(value, 1, 2.5, DEFAULTS[key]);
    case 'visual.paragraphSpacing': return clamp(value, 0, 3, DEFAULTS[key]);
    case 'visual.readingWidth': return clamp(value, 30, 100, DEFAULTS[key]);
    case 'visual.foreground':
    case 'visual.background': return String(value ?? '').trim().slice(0, 64);
    case 'visual.highContrast': return bool(value, DEFAULTS[key]);
    case 'visual.theme': return choice(value, new Set(['system', 'light', 'dark']), DEFAULTS[key]);
    default: return value;
  }
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function resolveReadingSettings(globalSettings = {}, bookOverrides = {}, { availableVoices = [] } = {}) {
  const global = plainObject(globalSettings);
  const book = plainObject(bookOverrides);
  const stored = {};
  const effective = {};
  const inherited = {};

  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const hasGlobal = Object.prototype.hasOwnProperty.call(global, key);
    const hasBook = Object.prototype.hasOwnProperty.call(book, key);
    const raw = hasBook ? book[key] : hasGlobal ? global[key] : fallback;
    stored[key] = sanitize(key, raw);
    effective[key] = stored[key];
    inherited[key] = !hasBook;
  }

  const voices = Array.isArray(availableVoices) ? availableVoices : [];
  const preferredVoice = stored['speech.voice'];
  let voiceAvailable = true;
  if (preferredVoice && voices.length) {
    voiceAvailable = voices.some(voice => String(voice?.id ?? '').trim() === preferredVoice);
    if (!voiceAvailable) effective['speech.voice'] = '';
  }

  return {
    effective,
    stored,
    inherited,
    voiceAvailable,
    global: { ...global },
    overrides: { ...book }
  };
}

export const READING_SETTING_DEFAULTS = DEFAULTS;
