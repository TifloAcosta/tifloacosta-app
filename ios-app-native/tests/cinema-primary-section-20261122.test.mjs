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
  for (const provider of ['audesc-es', 'audesc-latino', 'foal', 'audiocinemateca', 'rtve', 'nfb']) {
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
