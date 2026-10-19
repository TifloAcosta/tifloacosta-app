import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const native = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const contact = native('NativeContact.swift');
const screens = native('NativeScreens.swift');
const news = native('NativeNews.swift');
const media = native('NativeMedia.swift');
const inline = native('NativeMediaInline.swift');
const web = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('Contacto y redes existe como sección nativa operativa, no provisional', () => {
  assert.match(screens, /case \.contacto: NativeContactScreen\(\)/);
  assert.doesNotMatch(screens, /case \.favoritos, \.libro, \.contacto, \.privacidad/);
  for (const heading of ['Sobre TifloAcosta', 'Contacto directo', 'Redes sociales', 'Web oficial']) {
    assert.ok(contact.includes('Section("' + heading + '")'), 'Sección omitida: ' + heading);
  }
  assert.match(contact, /Link\(destination: url\)/);
  assert.match(contact, /\.accessibilityLabel\(Text\(LocalizedStringKey\(item\.title\)\)\)/);
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
  ];
  for (const url of urls) {
    assert.ok(contact.includes(url), 'Falta enlace en iOS: ' + url);
    assert.ok(web.includes(url), 'El enlace iOS no está respaldado por la web: ' + url);
  }
  const podcast = native('NativePodcasts.swift');
  const platforms = ['Spotify', 'Apple Podcasts', 'iVoox', 'Podimo', 'radio.es'];
  for (const platform of platforms) {
    assert.ok(podcast.includes('name: "' + platform + '"'), 'Falta plataforma en Podcast: ' + platform);
    assert.ok(!contact.includes('title: "' + platform + '"'), 'Podcast filtrado a Contacto: ' + platform);
  }
  assert.ok(!contact.includes('Escucha el podcast'));
  assert.ok(podcast.includes('Section("Escuchar en otras plataformas")'));
});

test('Actualidad muestra selector de formatos multimedia antes de los resultados de noticias', () => {
  const first = news.indexOf('title: "Seleccionar contenidos multimedia"');
  const category = news.indexOf('title: "Categoría"');
  assert.ok(first > 0 && category > first, 'El selector multimedia debe preceder al de noticias');
  for (const choice of ['Selecciona un formato','Podcasts','Canales de YouTube','Todos los formatos']) {
    assert.ok(news.includes('"' + choice + '"'));
  }
  assert.match(news, /NativeMediaInlineContent\(formatIndex: mediaKindIndex\)/);
  assert.match(media, /_formatIndex = State\(initialValue:/);
  assert.match(inline, /title: "Fuente o canal"/);
  assert.match(inline, /title: "Idioma"/);
  assert.match(inline, /TextField\("Buscar podcasts y vídeos"/);
});
