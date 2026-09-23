import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadAppInfo } from '../src/core/app-info.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('installed app metadata is normalized from the native Capacitor App plugin', async () => {
  const appPlugin = {
    async getInfo() {
      return { name: 'TifloAcosta', id: 'com.tifloacosta.app', version: '1.3.0', build: '8' };
    }
  };

  assert.deepEqual(await loadAppInfo(appPlugin), { version: '1.3.0', build: '8' });
});

test('missing or failing native metadata degrades safely without invented version numbers', async () => {
  assert.deepEqual(await loadAppInfo(null), { version: '', build: '' });
  assert.deepEqual(await loadAppInfo({ getInfo: async () => { throw new Error('native unavailable'); } }), {
    version: '',
    build: ''
  });
});

test('Settings exposes version and build as ordinary accessible text in both languages', async () => {
  const [settings, i18n] = await Promise.all([
    read('src/screens/settings.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(settings, /appInfo/);
  assert.match(settings, /settings\.appInfo/);
  assert.match(settings, /settings\.version/);
  assert.match(settings, /settings\.build/);
  assert.match(i18n, /appInfo:\s*'Información de la aplicación'/);
  assert.match(i18n, /version:\s*'Versión'/);
  assert.match(i18n, /build:\s*'Compilación'/);
  assert.match(i18n, /appInfo:\s*'App information'/);
  assert.match(i18n, /version:\s*'Version'/);
  assert.match(i18n, /build:\s*'Build'/);
});

test('composition root loads native app information and passes it to Settings', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /loadAppInfo\(App\)/);
  assert.match(app, /appInfo/);
  assert.match(app, /renderSettings\(context\)/);
});
