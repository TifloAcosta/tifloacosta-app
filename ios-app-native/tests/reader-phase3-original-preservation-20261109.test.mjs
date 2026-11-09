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

test("fase 3: la copia ZIP incluye datos de biblioteca y archivos asociados", () => {
  assert.match(reader, /func exportBackup\(\) throws -> URL/);
  assert.match(reader, /documentos\.json/);
  assert.match(reader, /carpetas\.json/);
  assert.match(reader, /"ReaderMedia", "ReaderOriginals"/);
  assert.match(reader, /zipItem\(at: staging, to: destination, shouldKeepParent: false\)/);
  assert.match(reader, /Button\("Exportar copia de seguridad"\)/);
});

test("fase 3: restaurar ZIP sin sobrescribir libros que ya existen", () => {
  assert.match(reader, /func restoreBackup\(from source: URL\) throws -> Int/);
  assert.match(reader, /let currentIDs = Set\(documents\.map\(\\.id\)\)/);
  assert.match(reader, /filter \{ !currentIDs\.contains\(\$0\.id\) \}/);
  assert.match(reader, /guard !manager\.fileExists\(atPath: target\.path\)/);
  assert.match(reader, /copied\.forEach \{ try\? manager\.removeItem\(at: \$0\) \}/);
});
test("fase 3: lectura del respaldo y verificación de rutas antes de importar", () => {
  assert.match(reader, /entry\.type == \.file \|\| entry\.type == \.directory/);
  assert.match(reader, /NativeReaderFormatError\.oversizedArchive/);
  assert.match(reader, /UUID\(uuidString: String\(components\[1\]\)\) != nil/);
  assert.match(reader, /Se han recuperado/);
  assert.match(reader, /Button\("Restaurar copia de seguridad"\)/);
  assert.match(reader, /shouldKeepParent: false/);
});
