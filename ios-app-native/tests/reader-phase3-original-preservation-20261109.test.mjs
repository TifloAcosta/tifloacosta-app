import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reader = readFileSync(new URL("../Sources/NativeTifloLector.swift", import.meta.url), "utf8");
const formats = readFileSync(new URL("../Sources/NativeReaderFormats.swift", import.meta.url), "utf8");

test("fase 3: conserva la ruta opcional para no romper bibliotecas antiguas", () => {
  assert.match(reader, /var originalRelativePath: String\? = nil/);
  assert.match(reader, /originalRelativePath: originalPath/);
});
test("fase 3: el archivo fuente se copia y se elimina junto a la obra", () => {
  assert.match(formats, /static func storeOriginal\(/);
  assert.match(formats, /FileManager\.default\.copyItem\(at: source, to: destination\)/);
  assert.match(reader, /NativeReaderFormats\.deleteOriginal\(for: document\.id\)/);
});
test("fase 3: documento original accesible en las acciones de VoiceOver y del lector", () => {
  assert.match(reader, /accessibilityAction\(named: Text\("Compartir documento original"\)\)/);
  assert.match(reader, /Button\("Compartir documento original"\)/);
  assert.match(reader, /NativeShare\.present\(url: original\)/);
});
test("fase 3: no confundir texto extraído con archivo de origen", () => {
  assert.match(reader, /Button\("Exportar texto"\)/);
  assert.match(reader, /El documento original no está disponible/);
});
