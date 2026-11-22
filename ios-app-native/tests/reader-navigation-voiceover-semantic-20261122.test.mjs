import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('Sources/NativeTifloLector.swift');
const formats = read('Sources/NativeReaderFormats.swift');
const braille = read('Sources/NativeReaderContinuousBrailleText.swift');
const selectable = read('Sources/NativeReaderSelectableText.swift');
const part = (start, end) => source.split(start)[1]?.split(end)[0] ?? '';

test('adjustable playback reads the reached unit rather than the current percent', () => {
  const row = part('private var playbackRow: some View {', '@ViewBuilder\n    private var trackButtons');
  assert.match(row, /\.accessibilityValue\(navigationAccessibilityValue\)/);
  assert.match(row, /case \.increment: moveUnit\(1\)/);
  assert.match(row, /case \.decrement: moveUnit\(-1\)/);
  assert.doesNotMatch(row, /accessibilityValue\(MusicLocalized\.format\("%d por ciento"/);
  const result = part('private var navigationAccessibilityValue: String {', 'private var excerpt: String');
  assert.match(result, /navigationFeedback/);
  assert.match(result, /Modo de navegación/);
  assert.match(result, /private func navigateText\(to offset: Int, unit: Int\)/);
});

test('options exclude absent chapters, headings and fake virtual pages', () => {
  const options = part('private var navigationOptions:', 'private var effectiveNavigationUnit:');
  assert.match(options, /if textLayout\.hasRealPages && textLayout\.namedPages\.count > 1/);
  assert.match(options, /if textLayout\.headingStarts\.count > 1/);
  assert.match(options, /if textLayout\.chapterStarts\.count > 1 \|\| daisySections\.count > 1/);
  assert.match(options, /if textLayout\.paragraphStarts\.count > 2/);
  assert.match(options, /if textLayout\.sentenceStarts\.count > 2/);
  assert.match(source, /Modo anterior no disponible\. Modo de navegación:/);
});

test('Markdown hash prefixes are never read in headings, selectable text, or braille', () => {
  const helper = part('enum NativeReaderHeadingDisplay {', 'private struct NativeReaderNavigationPoint:');
  assert.match(helper, /String\(repeating: " ", count: match\.range\.length\)/);
  assert.match(helper, /#\{1,6\}/);
  assert.match(source, /var result = NativeReaderHeadingDisplay\.mask\(in: source\)/);
  assert.match(source, /NativeReaderHeadingDisplay\.mask\(in: textLayout\.fragments\[index\]\)/);
  assert.match(source, /title: NativeReaderHeadingDisplay\.title\(line\)/);
  assert.match(source, /NativeReaderHeadingDisplay\.title\(point\.title/);
  assert.match(selectable, /NativeReaderHeadingDisplay\.mask\(in: text\)/);
  assert.match(braille, /for marker in markerStart\.\.<end \{ characters\[marker\] = " " \}/);
  const textLayout = part('private struct NativeReaderTextLayout {', '// Reproductor local de vídeo');
  assert.match(textLayout, /var headings: \[Int\] = \[\]/);
  assert.doesNotMatch(textLayout, /var headings: \[Int\] = \[0\]/);
});

test('HTML heading levels remain distinct so subheadings are not treated as chapters', () => {
  assert.match(formats, /for level in 1\.\.\.6/);
  assert.match(formats, /String\(repeating: "#", count: level\)/);
  assert.match(source, /#\{1,2\}/);
});

test('audio navigation works before Play and bookmark swipes do not auto-play', () => {
  const skip = part('private func skipReading(_ direction: Int) {', 'private func addBookmark()');
  assert.match(skip, /let audio = try\? AVAudioPlayer\(contentsOf: url\)/);
  assert.match(skip, /pendingDaisyAudioSeconds = target/);
  assert.match(skip, /library\.saveAudioPosition\(/);
  assert.doesNotMatch(skip, /Posición: %d por ciento/);
  const marks = part('private func moveBetweenMarks(_ direction: Int) {', '// Quitar de las etiquetas de marcas');
  assert.match(marks, /pendingDaisyAudioSeconds = mark\.seconds/);
  assert.match(marks, /navigateText\(to: next, unit: 6\)/);
  assert.doesNotMatch(marks, /playTrack\(/);
});

test('new spoken navigation feedback is translated in every supported language', () => {
  const keys = [
    'Modo de navegación: %@',
    'Modo anterior no disponible. Modo de navegación: %@',
    'El modo elegido no está disponible en este libro.',
    'No hay más elementos del modo elegido en esa dirección.',
    'Avanzado un minuto.',
    'Retrocedido un minuto.',
    'No hay más recorrido en esa dirección.',
    'Marca: pista %d',
    'Desliza arriba o abajo para navegar por el modo elegido.'
  ];
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const catalog = read('Sources/' + language + '.lproj/Localizable.strings');
    for (const key of keys) {
      assert.ok(catalog.includes('"' + key + '" = '), language + ': ' + key);
    }
  }
});
