import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Privacy is a real bilingual mobile screen and route', async () => {
  const [app, privacy, home] = await Promise.all([
    read('src/app.mjs'),
    read('src/screens/privacy.mjs'),
    read('src/screens/home.mjs')
  ]);

  assert.match(app, /import \{ renderPrivacy \} from '\.\/screens\/privacy\.mjs';/);
  assert.match(app, /case 'privacy': renderPrivacy\(context\); break;/);
  assert.match(privacy, /addScreenHeader\(/);
  assert.match(privacy, /Privacidad y accesibilidad/);
  assert.match(privacy, /Privacy and accessibility/);
  assert.match(privacy, /datos|data/i);
  assert.match(privacy, /notificaciones|notifications/i);
  assert.match(privacy, /biblioteca|library/i);
  assert.match(home, /PRIVACY_LABELS/);
});

test('Privacy screen does not steal focus or depend on an external policy page', async () => {
  const privacy = await read('src/screens/privacy.mjs');
  assert.doesNotMatch(privacy, /autofocus/i);
  assert.doesNotMatch(privacy, /https?:\/\//i);
});
