import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const screens = read('NativeScreens.swift');
const bookPrivacy = read('NativeBookPrivacy.swift');
const app = read('TifloAcostaNativeApp.swift');
const settings = read('NativeUpdatesSettings.swift');
const english = read('en.lproj/Localizable.strings');

test('Mi libro y Privacidad son pantallas nativas completas, no provisionales', () => {
  assert.match(read('NativeContact.swift'), /NavigationLink\s*\{\s*NativeBookScreen\(\)/);
  assert.doesNotMatch(screens, /case \.libro: NativeBookScreen\(\)/);
  assert.doesNotMatch(screens, /case libro = "Mi libro"/);
  assert.match(screens, /case \.privacidad: NativePrivacyAccessibilityScreen\(\)/);
  assert.doesNotMatch(screens, /case \.favoritos, \.libro, \.privacidad/);
  assert.match(bookPrivacy, /struct NativeBookScreen: View/);
  assert.match(bookPrivacy, /struct NativePrivacyAccessibilityScreen: View/);
  assert.match(bookPrivacy, /AsyncImage\(url: coverURL\)/);
  assert.match(bookPrivacy, /"https:\/\/tifloacosta\.com\/book-cover\.jpg"/);
  assert.match(bookPrivacy, /9798185909218/);
  assert.match(bookPrivacy, /Buscar la edición impresa en Amazon/);
  assert.match(bookPrivacy, /Buscar la edición Kindle en Amazon/);
  assert.match(bookPrivacy, /https:\/\/tifloacosta\.com\/privacidad\//);
  assert.match(bookPrivacy, /Comunicar una barrera de accesibilidad/);
  assert.doesNotMatch(bookPrivacy, /GoatCounter|OneSignal|WKWebView|UIWebView|import Capacitor/);
  assert.equal((bookPrivacy.match(/\.tifloScreenSurface\(\)/g) || []).length, 2);
});

test('Idioma persistente en Configuración cambia el entorno nativo y el catálogo', () => {
  assert.match(settings, /@AppStorage\("native-ios-language"\) private var languageIndex = 0/);
  assert.match(settings, /NativeAdjustableChoice\(\s*title: "Idioma de la aplicación"/);
  assert.match(settings, /choices: \["Español", "English"\]/);
  assert.match(settings, /selectedIndex: \$languageIndex/);
  assert.match(app, /@AppStorage\("native-ios-language"\) private var languageIndex = 0/);
  assert.match(app, /\.environment\(\\\.locale, Locale\(identifier: languageIndex == 1 \? "en" : "es"\)\)/);
  assert.match(screens, /Text\(LocalizedStringKey\(destination\.rawValue\)\)/);
  assert.match(screens, /Text\(LocalizedStringKey\(currentValue\)\)/);
  assert.match(screens, /catalog\.resources\.filter \{ \$0\.lang == \(languageIndex == 1 \? "en" : "es"\) \}/);
  assert.match(read('NativeNews.swift'), /catalog\.news\.filter \{ \$0\.lang == \(languageIndex == 1 \? "en" : "es"\) \}/);
  for (const entry of ['"Idioma de la aplicación"','"Configuración"','"Mi libro"','"Privacidad y accesibilidad"','"Contacto y redes"','"Redes sociales"']) {
    assert.ok(english.includes(entry), 'Falta traducción: ' + entry);
  }
});

test('Las tres secciones respetan el catálogo de origen sin introducir pantallas web', () => {
  const podcasts = read('NativePodcasts.swift');
  const contact = read('NativeContact.swift');
  assert.ok(podcasts.includes('Section("Escuchar en otras plataformas")'));
  assert.ok(!contact.includes('Section("Escucha el podcast")'));
  for (const name of ['Spotify','Apple Podcasts','iVoox','Podimo','radio.es']) {
    assert.ok(podcasts.includes('name: "' + name + '"'));
    assert.ok(!contact.includes('title: "' + name + '"'));
  }
});
