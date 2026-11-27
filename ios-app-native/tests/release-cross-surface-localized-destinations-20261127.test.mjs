import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => {
  const raw = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  return new Map([...raw.matchAll(/^"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";\s*$/gm)].map(m => [m[1], m[2]]));
};

test('reader, music and received destination labels match the app in share and navigation help', () => {
  for (const language of ['en', 'fr', 'de', 'it', 'pt']) {
    const app = read('Sources/' + language + '.lproj/Localizable.strings');
    const share = read('ShareExtension/Localizations/' + language + '.lproj/Localizable.strings');
    const reader = app.get('TifloLector');
    const inbox = app.get('Recibidos');
    const music = app.get('Mi Música');
    assert.equal(app.get('Mi música'), music);
    assert.ok(share.get('Guardar en TifloLector').includes(reader));
    assert.ok(share.get('Guardar en Mi música').includes(music));
    for (const catalog of [app, share]) {
      for (const [key, value] of catalog) {
        if (key.includes('TifloLector')) assert.ok(value.includes(reader), language + ': reader / ' + key);
        if (key.includes('Recibidos') && key !== 'Recibidos: %d de %d.') {
          assert.ok(value.includes(inbox), language + ': inbox / ' + key);
        }
      }
    }
  }
});
