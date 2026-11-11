import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const files = ['NativeUpdatesSettings.swift','NativeReaderSettings.swift','NativeReaderAdvanced.swift','NativeTifloLector.swift','NativeNews.swift','NativeScreens.swift'];
const keyPattern = /^"((?:[^"\\]|\\.)+)"\s*=\s*".*";$/gm;

test('Todos los textos literales de Configuración, TifloLector, Noticias y Vídeos existen en cinco catálogos', () => {
  const required = new Set();
  const pattern = /(?:Text|Section|Button|Toggle|NavigationLink|navigationTitle|accessibilityHint|accessibilityLabel|Picker|LabeledContent)\(\s*"([^"]{4,})"/g;
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(pattern)) {
      if (!match[1].includes('\\(')) required.add(match[1]);
    }
  }
  for (const lang of ['en','pt','fr','it','de']) {
    const strings = read(lang + '.lproj/Localizable.strings');
    const keys = new Set([...strings.matchAll(keyPattern)].map(match => match[1]));
    assert.deepEqual([...required].filter(key => !keys.has(key)), [], lang + ': textos sin traducir');
  }
});

test('Las filas dinámicas de atajos Siri fuerzan resolución localizada de título y explicación', () => {
  const source = read('NativeUpdatesSettings.swift');
  assert.match(source, /Text\(LocalizedStringKey\(shortcuts\[index\]\.name\)\)/);
  assert.match(source, /Text\(LocalizedStringKey\(shortcuts\[index\]\.detail\)\)/);
});

test('Crear marca desde texto reconoce pulsación larga real y preserva el fragmento aun en pausa', () => {
  const source = read('NativeTifloLector.swift');
  const fragment = source.slice(source.indexOf('private func readerFragment(at index: Int)'), source.indexOf('private var readingContent'));
  const action = source.slice(source.indexOf('private func bookmarkFromContextMenu(at fragment: Int)'),source.indexOf('private func readerFragment(at index: Int)'));
  assert.match(fragment, /\.onLongPressGesture\(minimumDuration: 0\.7\)/);
  assert.match(fragment, /\.accessibilityAction\(named: Text\("Crear marca"\)\)/);
  assert.doesNotMatch(fragment, /\.contextMenu \{/);
  assert.match(action, /readingOffset = textLayout\.fragmentStarts\[fragment\]/);
  assert.doesNotMatch(action, /!speech\.isPaused/);
  assert.match(action, /addBookmark\(\)/);
});
