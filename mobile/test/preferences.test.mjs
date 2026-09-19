import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PREFERENCES,
  applyPreferences,
  createPreferencesStore
} from '../src/core/preferences.mjs';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    value: key => values.get(key)
  };
}

test('preferences fall back to approved defaults when storage is empty or corrupt', () => {
  const empty = createPreferencesStore({ storage: memoryStorage() });
  assert.deepEqual(empty.load(), DEFAULT_PREFERENCES);

  const corrupt = createPreferencesStore({
    storage: memoryStorage({ 'tiflo-mobile-preferences-v1': '{not json' })
  });
  assert.deepEqual(corrupt.load(), DEFAULT_PREFERENCES);
});

test('preferences sanitize unsupported values instead of trusting stored data', () => {
  const storage = memoryStorage({
    'tiflo-mobile-preferences-v1': JSON.stringify({
      lang: 'fr', textSize: 'huge', theme: 'blue', spacing: 'tiny', bold: 'yes'
    })
  });
  const store = createPreferencesStore({ storage });
  assert.deepEqual(store.load(), DEFAULT_PREFERENCES);
});

test('saving preferences preserves valid choices and writes one stable object', () => {
  const storage = memoryStorage();
  const store = createPreferencesStore({ storage });
  const saved = store.save({
    lang: 'en', textSize: 'xlarge', theme: 'dark', spacing: 'wide', bold: true
  });
  assert.deepEqual(saved, {
    lang: 'en', textSize: 'xlarge', theme: 'dark', spacing: 'wide', bold: true
  });
  assert.deepEqual(JSON.parse(storage.value('tiflo-mobile-preferences-v1')), saved);
});

test('blocked storage does not crash preference loading or saving', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  const store = createPreferencesStore({ storage: blocked });
  assert.deepEqual(store.load(), DEFAULT_PREFERENCES);
  assert.deepEqual(store.save({ lang: 'en' }), { ...DEFAULT_PREFERENCES, lang: 'en' });
  assert.deepEqual(store.reset(), DEFAULT_PREFERENCES);
});

test('visual preferences replace only TifloAcosta preference classes and set document language', () => {
  const classes = new Set(['native-shell']);
  const root = {
    lang: '',
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name))
    }
  };

  applyPreferences(root, {
    lang: 'en', textSize: 'large', theme: 'dark', spacing: 'comfortable', bold: true
  });

  assert.equal(root.lang, 'en');
  assert.equal(classes.has('native-shell'), true);
  assert.equal(classes.has('text-large'), true);
  assert.equal(classes.has('theme-dark'), true);
  assert.equal(classes.has('spacing-comfortable'), true);
  assert.equal(classes.has('text-bold'), true);
});
