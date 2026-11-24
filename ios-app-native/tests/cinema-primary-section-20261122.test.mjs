import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screens = readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');
const cinema = readFileSync(new URL('../Sources/NativeAccessibleCinema.swift', import.meta.url), 'utf8');

test('Multicines Accesibles is a native primary destination, not a placeholder', () => {
  assert.match(screens, /case multicines = "Multicines Accesibles"/);
  assert.match(screens, /case \.multicines: NativeAccessibleCinemaScreen\(\)/);
  assert.match(cinema, /struct NativeAccessibleCinemaScreen: View/);
  assert.match(cinema, /NativeAdjustableChoice/);
  assert.match(cinema, /Buscar plataformas y contenidos audiodescritos/);
});

test('the directory distinguishes Spain and Latin America and lists official providers', () => {
  assert.match(cinema, /case spain = "Español de España"/);
  assert.match(cinema, /case latino = "Español de Latinoamérica"/);
  for (const provider of ['audesc-es', 'audesc-latino', 'audiocinemateca',
                          'ami', 'ami-fr', 'ard', 'arte', 'arte-de']) {
    assert.ok(cinema.includes('id: "' + provider + '"'), 'Falta fuente ' + provider);
  }
});

test('source directory respects distribution rights and does not embed private Drive links', () => {
  assert.doesNotMatch(cinema, /drive\.google\.com\/drive\/folders\//);
  assert.doesNotMatch(cinema, /API_KEY|PASSWORD|PRIVATE_KEY/);
  assert.match(cinema, /address: nil, access: "Enlace oficial pendiente de incorporación segura\."/);
  assert.match(cinema, /Abrir plataforma original/);
});

test('the app never claims all titles at an external provider are audio described', () => {
  assert.match(cinema, /no significa que todas sus películas tengan audiodescripción/);
  assert.match(cinema, /Acceso sujeto a restricciones regionales|restricciones regionales|derechos territoriales/);
});

test('partner catalogue stays on the official authenticated site until integration is approved', () => {
  assert.match(cinema, /URL\(string: "https:\/\/audiocinemateca\.com\/catalogo"\)/);
  assert.match(cinema, /Registro gratuito e inicio de sesión en el servicio original/);
  assert.match(cinema, /Catálogo|catálogo|catalogue/);
  assert.doesNotMatch(cinema, /https:\/\/drive\.google\.com\/drive\/folders\//);
});

test('all source descriptions and collection metadata are translated and searchable in all six app languages', () => {
  assert.match(cinema, /parts\.map \{ MusicLocalized\.message\(\$0\) \}\.joined\(separator: " "\)/);
  const keys = new Set([
    'Solo audio con audiodescripción.', 'Vídeo con audiodescripción según el título.',
    ...[...cinema.matchAll(/(?:description|access|geographicNotice|summary|title): "([^"]*)"/g)]
      .map(match => match[1]).filter(Boolean)
  ]);
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = readFileSync(new URL('../Sources/' + language + '.lproj/Localizable.strings', import.meta.url), 'utf8');
    for (const key of keys) {
      assert.ok(catalog.includes('"' + key + '" = '), language + ' lacks translation: ' + key);
    }
  }
});

test('the main cinema directory excludes general TV landing pages and routes to AD-only collections', () => {
  const directory = cinema.slice(
    cinema.indexOf('private enum AccessibleCinemaDirectory'),
    cinema.indexOf('struct NativeAccessibleCinemaScreen')
  );
  const ids = [...directory.matchAll(/\.init\(id: "([^"]+)", name:/g)].map(match => match[1]);
  assert.deepEqual(ids, ['audesc-es', 'audesc-latino', 'audiocinemateca',
    'ami', 'ami-fr', 'ard', 'arte', 'arte-de']);
  for (const excluded of ['foal', 'rtve', 'nfb', 'pbs', 'itvx', 'channel4', 'five', 'abc', 'tubi', 'pluto']) {
    assert.ok(!ids.includes(excluded), 'Generalist homepage leaked into directory: ' + excluded);
  }
  assert.doesNotMatch(directory, /https:\/\/(www\.)?rtve\.es\/play\//);
  assert.doesNotMatch(directory, /https:\/\/www\.arte\.tv\/"\)/);
  assert.match(directory, /id: "ard"[\s\S]*?https:\/\/www\.ardmediathek\.de\/audiodeskription/);
  assert.match(directory, /id: "arte"[\s\S]*?languages: \[\.french\][\s\S]*?https:\/\/www\.arte\.tv\/fr\/videos\/programmes-en-audiodescription\//);
  assert.match(directory, /id: "arte-de"[\s\S]*?languages: \[\.german\][\s\S]*?https:\/\/www\.arte\.tv\/de\/videos\/programme-mit-audiodeskription\//);
  assert.match(directory, /id: "ami"[\s\S]*?languages: \[\.english\]/);
  assert.match(directory, /id: "ami-fr"[\s\S]*?languages: \[\.french\]/);
  assert.match(cinema, /MusicLocalized\.message\(source\.name\)/);
});
