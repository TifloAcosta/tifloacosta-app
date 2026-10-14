import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readMobile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('iOS library reading settings are grouped under Audio, Visual and General with a persistent navigation default', async () => {
  const source = await readMobile('src/screens/reading-library.mjs');
  assert.match(source, /const audioGroup = settingsGroup/);
  assert.match(source, /const visualGroup = settingsGroup/);
  assert.match(source, /const generalGroup = settingsGroup/);
  assert.match(source, /settingsPanel\.append\(settingsMenu, audioGroup, visualGroup, generalGroup, settingsStatus, closeSettings\)/);
  assert.match(source, /group\.hidden = entry\.group !== group/);
  assert.match(source, /group\.hidden = true/);
  assert.match(source, /opener\.focus\(\)/);
  assert.match(source, /'reading\.navigationMode', navigationModeSelect/);
});

test('document navigation settings stay inside initially closed, labelled controls', async () => {
  const source = await readMobile('src/screens/reading-book.mjs');
  assert.match(source, /readingSettingsContent\.hidden = true/);
  assert.match(source, /generalSettings\.hidden = true/);
  assert.match(source, /readingSettingsSummary\.setAttribute\('aria-expanded', 'false'\)/);
  assert.match(source, /generalSettings\.append\(navigationLabel, navigationSelect/);
  assert.match(source, /readingSettingsContent\.append\(voiceButton, visualButton, dictionaryButton, generalSettingsSummary, generalSettings\)/);
});

test('iOS native document translation offers a visible read result action and focuses content', async () => {
  const [panel, controls] = await Promise.all([
    readMobile('src/screens/reading-translation-panel.mjs'),
    readMobile('src/screens/reading-translation-controls.mjs')
  ]);
  assert.match(panel, /readTranslationButton\.hidden = !complete/);
  assert.match(panel, /onOpenTranslation\?\.\(\)/);
  assert.match(panel, /readingUnit\?\.focus\?\.\(\)/);
  assert.match(controls, /onOpenTranslation: \(\) => showTranslation\(\)/);
});

test('web reading settings are collapsible and translation output is reachable', async () => {
  const [html, source] = await Promise.all([
    readRepo('index.html'),
    readRepo('web-reading.js')
  ]);
  assert.match(html, /<details id="reading-settings-disclosure"/);
  assert.match(html, /id="reading-default-navigation"/);
  assert.match(html, /id="reading-translation-read"/);
  assert.match(source, /primaryActions\.append\(mark, readingSettingsMenu, moreButton\)/);
  assert.match(source, /await switchTranslationView\(true\)/);
});

test('content refresh protects reader focus and Novedades retains publication dates', async () => {
  const [app, builder, novedades] = await Promise.all([
    readMobile('src/app.mjs'),
    readRepo('scripts/build-mobile-content.mjs'),
    readMobile('src/screens/new-content.mjs')
  ]);
  assert.match(app, /contentScreens\.has\(router\.current\(\)\?\.name\)/);
  assert.match(app, /restoreOriginFocus\(root, focusedId\)/);
  assert.match(builder, /newsDate: item\.newsDate/);
  assert.match(novedades, /Última novedad publicada/);
});
