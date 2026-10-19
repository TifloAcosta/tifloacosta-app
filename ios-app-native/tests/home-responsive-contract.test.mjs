import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screens = readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');
const home = screens.slice(
  screens.indexOf('struct NativeHomeScreen: View {'),
  screens.indexOf('private struct NativePendingSectionScreen: View {')
);

test('la portada usa distribución compacta, sin separación automática de lista agrupada', () => {
  assert.match(home, /ScrollView\s*\{/);
  assert.match(home, /LazyVStack\(spacing: 0\)/);
  assert.doesNotMatch(home, /List\s*\{|listStyle\(\.insetGrouped\)/);
  assert.match(home, /frame\(maxWidth: 680\)/);
});

test('la tipografía dinámica no se recorta ni se desactiva en la portada', () => {
  assert.match(home, /dynamicTypeSize\.isAccessibilitySize/);
  assert.match(home, /VStackLayout\(alignment: \.leading/);
  assert.match(home, /fixedSize\(horizontal: false, vertical: true\)/);
  assert.doesNotMatch(home, /dynamicTypeSize,\s*\.[A-Za-z]/);
});

test('la portada conserva búsqueda y rutas sin controles duplicados', () => {
  assert.match(home, /TextField\("Introduce tu búsqueda"/);
  assert.match(home, /\.onSubmit\(search\)/);
  assert.match(home, /Button\(action: search\)/);
  assert.match(home, /\.navigationDestination\(for: NativeDestination\.self\)/);
  assert.match(home, /\.accessibilityLabel\(Text\(LocalizedStringKey\(destination\.rawValue\)\)\)/);
  assert.match(home, /\.accessibilityAddTraits\(\.isHeader\)/);
});
