import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const catalog = source('NativeCatalogStore.swift');
const resources = source('NativeScreens.swift').split('struct NativeResourcesScreen: View {')[1]?.split('struct NativeVideosScreen: View {')[0] ?? '';
const novedades = source('NativeUpdatesSettings.swift').split('struct NativeUpdatesScreen: View {')[1]?.split('struct NativeSettingsScreen: View {')[0] ?? '';

test('iOS puede descargar el catálogo desde el dominio oficial y un origen alternativo', () => {
  assert.match(catalog, /tifloacosta\.com\/mobile-content\.json/);
  assert.match(catalog, /raw\.githubusercontent\.com\/TifloAcosta\/tifloacosta-app\/main\/mobile-content\.json/);
  assert.match(catalog, /for endpoint in endpoints/);
  assert.match(catalog, /reloadIgnoringLocalAndRemoteCacheData/);
  assert.match(catalog, /snapshot\.schemaVersion == 1/);
  assert.match(catalog, /!snapshot\.resources\.isEmpty/);
  assert.match(catalog, /guard !loading else \{ return \}/);
});

test('La sincronización conserva copia local y comunica fecha, origen y errores reales', () => {
  assert.match(catalog, /Data\(contentsOf: cacheURL\)/);
  assert.match(catalog, /data\.write\(to: cacheURL/);
  assert.match(catalog, /lastUpdated = now/);
  assert.match(catalog, /persistTimestamp\(now\)/);
  assert.match(catalog, /lastSource = endpoint\.host/);
  assert.match(catalog, /updateMessage = "Contenido actualizado:/);
  assert.match(catalog, /failures\.append/);
  assert.match(catalog, /Se muestran los contenidos guardados/);
  assert.doesNotMatch(catalog, /"HTTP \\\\ \(/);
});

test('Actualizar Recursos está disponible sin error previo y anuncia el resultado a VoiceOver', () => {
  assert.match(resources, /Button\("Actualizar recursos"\)/);
  assert.match(resources, /\.disabled\(catalog\.loading\)/);
  assert.match(resources, /catalog\.refresh\(\)/);
  assert.match(resources, /UIAccessibility\.post\(notification: \.announcement/);
  assert.match(resources, /Última actualización correcta:/);
});

test('Actualizar Novedades está disponible sin error previo y anuncia el resultado', () => {
  assert.match(novedades, /Button\("Actualizar novedades"\)/);
  assert.match(novedades, /catalog\.refresh\(\)/);
  assert.match(novedades, /UIAccessibility\.post\(notification: \.announcement/);
  assert.match(novedades, /Última actualización correcta:/);
});

test('El catálogo móvil de Recursos contiene Píldoras 25 en ambos idiomas', () => {
  const mobile = JSON.parse(readFileSync(new URL('../../mobile-content.json', import.meta.url), 'utf8'));
  for (const id of ['es-pildoras-2026-25', 'en-pildoras-2026-25']) {
    const found = mobile.resources.filter(x => x.id === id);
    assert.equal(found.length, 1, 'Falta una entrada: ' + id);
    assert.equal(found[0].isNew, true);
  }
});
