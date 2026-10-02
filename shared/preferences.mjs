export const PREFERENCES_KEY = 'tiflo-mobile-preferences-v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  lang: 'es',
  textSize: 'normal',
  theme: 'auto',
  spacing: 'normal',
  bold: false
});

const allowed = {
  lang: new Set(['es', 'en']),
  textSize: new Set(['normal', 'large', 'xlarge', 'max']),
  theme: new Set(['auto', 'light', 'dark']),
  spacing: new Set(['normal', 'comfortable', 'wide'])
};

export function normalizePreferences(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    lang: allowed.lang.has(source.lang) ? source.lang : DEFAULT_PREFERENCES.lang,
    textSize: allowed.textSize.has(source.textSize) ? source.textSize : DEFAULT_PREFERENCES.textSize,
    theme: allowed.theme.has(source.theme) ? source.theme : DEFAULT_PREFERENCES.theme,
    spacing: allowed.spacing.has(source.spacing) ? source.spacing : DEFAULT_PREFERENCES.spacing,
    bold: typeof source.bold === 'boolean' ? source.bold : DEFAULT_PREFERENCES.bold
  };
}

export function createPreferencesStore({ storage = globalThis.localStorage, key = PREFERENCES_KEY } = {}) {
  let current = { ...DEFAULT_PREFERENCES };
  let languageChosen = false;

  function load() {
    try {
      const raw = storage?.getItem?.(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        languageChosen = allowed.lang.has(parsed?.lang);
        current = normalizePreferences(parsed);
      } else {
        languageChosen = false;
        current = { ...DEFAULT_PREFERENCES };
      }
    } catch {
      languageChosen = false;
      current = { ...DEFAULT_PREFERENCES };
    }
    return { ...current };
  }

  function save(changes = {}) {
    if (allowed.lang.has(changes?.lang)) languageChosen = true;
    current = normalizePreferences({ ...current, ...changes });
    try { storage?.setItem?.(key, JSON.stringify(current)); } catch { /* optional storage */ }
    return { ...current };
  }

  function reset() {
    current = { ...DEFAULT_PREFERENCES };
    try {
      if (languageChosen) storage?.setItem?.(key, JSON.stringify(current));
      else storage?.removeItem?.(key);
    } catch { /* optional storage */ }
    return { ...current };
  }

  function getCurrent() {
    return { ...current };
  }

  function needsLanguageChoice() {
    return !languageChosen;
  }

  return { load, save, reset, getCurrent, needsLanguageChoice };
}

const preferenceClasses = [
  'text-large', 'text-xlarge', 'text-max',
  'theme-light', 'theme-dark',
  'spacing-comfortable', 'spacing-wide',
  'text-bold'
];

export function applyPreferences(root, preferences) {
  if (!root?.classList) return;
  const value = normalizePreferences(preferences);
  root.lang = value.lang;
  root.classList.remove(...preferenceClasses);
  if (value.textSize !== 'normal') root.classList.add(`text-${value.textSize}`);
  if (value.theme !== 'auto') root.classList.add(`theme-${value.theme}`);
  if (value.spacing !== 'normal') root.classList.add(`spacing-${value.spacing}`);
  if (value.bold) root.classList.add('text-bold');
}
