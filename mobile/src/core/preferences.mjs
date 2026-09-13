const STORAGE_KEY = 'tiflo-mobile-preferences-v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  lang: 'es',
  textSize: 'normal',
  theme: 'auto',
  spacing: 'normal',
  bold: false
});

const ALLOWED = {
  lang: new Set(['es', 'en']),
  textSize: new Set(['normal', 'large', 'xlarge', 'max']),
  theme: new Set(['auto', 'light', 'dark']),
  spacing: new Set(['normal', 'comfortable', 'wide'])
};

function sanitize(value = {}) {
  const next = { ...DEFAULT_PREFERENCES };
  for (const key of ['lang', 'textSize', 'theme', 'spacing']) {
    if (ALLOWED[key].has(value[key])) next[key] = value[key];
  }
  if (typeof value.bold === 'boolean') next.bold = value.bold;
  return next;
}

function read(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function write(storage, value) {
  try {
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Preferences still work for the current session if persistence is blocked.
  }
}

export function applyPreferences(target, preferences) {
  if (!target) return;
  target.setAttribute('lang', preferences.lang);
  const classes = [
    'text-normal', 'text-large', 'text-xlarge', 'text-max',
    'theme-auto', 'theme-light', 'theme-dark',
    'spacing-normal', 'spacing-comfortable', 'spacing-wide',
    'text-bold'
  ];
  target.classList.remove(...classes);
  target.classList.add(`text-${preferences.textSize}`);
  target.classList.add(`theme-${preferences.theme}`);
  target.classList.add(`spacing-${preferences.spacing}`);
  if (preferences.bold) target.classList.add('text-bold');
}

export function createPreferencesStore(storage = globalThis.localStorage) {
  let current = read(storage);
  return {
    get() {
      return { ...current };
    },
    update(patch = {}) {
      current = sanitize({ ...current, ...patch });
      write(storage, current);
      return { ...current };
    }
  };
}

export { STORAGE_KEY };
