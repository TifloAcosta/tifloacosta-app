import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const native = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const contact = native('NativeContact.swift');
const screens = native('NativeScreens.swift');
const news = native('NativeNews.swift');
const media = native('NativeMedia.swift');
const web = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('Contacto y redes existe como sección nativa operativa, no provisional', () => {
  assert.match(screens, /case \.contacto: NativeContactScreen\(\)/);
  assert.doesNotMatch(screens, /case \.favoritos, \.libro, \.contacto, \.privacidad/);
  for (const heading of ['Sobre TifloAcosta', 'Contacto directo', 'Redes sociales', 'Escucha el podcast', 'Web oficial']) {
    assert.ok(contact.includes('Section("' + heading + '")'), 'Sección omitida: ' + heading);
  }
  assert.match(contact, /Link\(destination: url\)/);
  assert.match(contact, /\.accessibilityLabel\(item\.title\)/);
  assert.match(contact, /\.accessibilityAction\(named: Text\("Compartir enlace"\)\)/);
  assert.match(contact, /\.listRowBackground\(TifloVisual\.surfaceRaised\)/);
  assert.match(contact, /\.tifloScreenSurface\(\)/);
  assert.doesNotMatch(contact, /WKWebView|UIWebView|import Capacitor/);
});

test('Los enlaces de Contacto y redes coinciden con los enlaces oficiales de la web', () => {
  const urls = [
    'https://wa.me/34603516398',
    'mailto:tifloacosta@gmail.com',
    'https://www.youtube.com/@tifloacosta',
    'https://www.instagram.com/tifloacosta/',
    'https://www.facebook.com/profile.php?id=61586738581998',
    'https://facebook.com/tony.acostaacosta',
    'https://open.spotify.com/show/6z5BbrUhRuMANB5BFJfdfB',
    'https://podcasts.apple.com/es/podcast/canal-tifloacosta/id1567846456',
    'https://www.ivoox.com/podcast-canal-tifloacosta_sq_f11282163_1.html',
    'https://podimo.com/es/shows/canal-tifloacosta',
    'https://www.radio.es/podcast/canal-tifloacosta',
  ];
  for (const url of urls) {
    assert.ok(contact.includes(url), 'Falta enlace en iOS: ' + url);
    assert.ok(web.includes(url), 'El enlace iOS no está respaldado por la web: ' + url);
  }
});

test('Actualidad muestra selector de formatos multimedia antes de los resultados de noticias', () => {
  const first = news.indexOf('title: "Seleccionar contenidos multimedia"');
  const category = news.indexOf('title: "Categoría"');
  assert.ok(first > 0 && category > first, 'El selector multimedia debe preceder al de noticias');
  for (const choice of ['Selecciona un formato','Podcasts','Canales de YouTube','Todos los formatos']) {
    assert.ok(news.includes('"' + choice + '"'));
  }
  assert.match(news, /NativeMediaScreen\(\s*initialFormatIndex:/);
  assert.match(media, /_formatIndex = State\(initialValue:/);
  assert.match(media, /title: "Fuente o canal"/);
  assert.match(media, /title: "Idioma"/);
  assert.match(media, /prompt: "Buscar podcasts y canales"/);
});
