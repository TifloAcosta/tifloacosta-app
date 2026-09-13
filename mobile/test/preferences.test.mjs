import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreferencesStore, DEFAULT_PREFERENCES, applyPreferences } from '../src/core/preferences.mjs';

function memoryStorage(raw = null) {
  let value = raw;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    current: () => value
  };
}

test('preferences survive storage and invalid data falls back safely', () => {
  const storage = memoryStorage('{bad json');
  const store = createPreferencesStore(storage);
  assert.deepEqual(store.get(), DEFAULT_PREFERENCES);
  const updated = store.update({ lang: 'en', theme: 'dark', bold: true });
  assert.equal(updated.lang, 'en');
  assert.equal(updated.theme, 'dark');
  assert.equal(updated.bold, true);
  const restored = createPreferencesStore(storage);
  assert.deepEqual(restored.get(), updated);
});

test('invalid preference values are ignored', () => {
  const store = createPreferencesStore(memoryStorage());
  const updated = store.update({ lang: 'xx', textSize: 'gigantic', spacing: 'wide' });
  assert.equal(updated.lang, 'es');
  assert.equal(updated.textSize, 'normal');
  assert.equal(updated.spacing, 'wide');
});

test('visual preferences apply predictable html classes', () => {
  const classSet = new Set(['unrelated']);
  const target = {
    classList: {
      add: (...values) => values.forEach(value => classSet.add(value)),
      remove: (...values) => values.forEach(value => classSet.delete(value))
    },
    setAttribute(name, value) { this[name] = value; }
  };
  applyPreferences(target, { ...DEFAULT_PREFERENCES, lang: 'en', textSize: 'large', theme: 'dark', spacing: 'wide', bold: true });
  assert.equal(target.lang, 'en');
  assert.ok(classSet.has('text-large'));
  assert.ok(classSet.has('theme-dark'));
  assert.ok(classSet.has('spacing-wide'));
  assert.ok(classSet.has('text-bold'));
  assert.ok(classSet.has('unrelated'));
});
