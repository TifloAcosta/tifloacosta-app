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

test("fase 3: exportación de audio multipista empaquetada sin perder pistas", () => {
  assert.match(reader, /func exportAudioTracks\(_ document: NativeReadingDocument\) throws -> URL/);
  assert.match(reader, /for \(index, path\) in paths\.enumerated\(\)/);
  assert.match(reader, /Button\("Compartir todas las pistas de audio \(ZIP\)"\)/);
  assert.match(reader, /NativeShare\.present\(url: try library\.exportAudioTracks\(document\)\)/);
  assert.match(reader, /safeTitle \+ "-pistas\.zip"/);
});
test("fase 3: el nombre de exportación conserva Unicode y evita colisiones temporales", () => {
  assert.doesNotMatch(reader, /\[\^A-Za-z0-9 _\.\-\]/);
  assert.match(reader, /let cleanName = latest\.title\.replacingOccurrences/);
  assert.match(reader, /appendingPathComponent\(UUID\(\)\.uuidString, isDirectory: true\)/);
});

test("fase 3: exportadores de audio conectados con controles accesibles", () => {
  assert.match(reader, /Button\("Exportar audio MP3 o DAISY"\)/);
  assert.match(reader, /Picker\("Formato", selection: \$audioExportFormat\)/);
  assert.match(reader, /Picker\("Motor", selection: \$audioExportEngine\)/);
  assert.match(reader, /Picker\("Voz", selection: \$audioExportSystemVoice\)/);
  assert.match(reader, /NativeGeminiAudioExport\.export\(/);
  assert.match(reader, /audioExportTask\?\.cancel\(\)/);
  assert.match(reader, /NativeShare\.present\(url: url\)/);
});

test("fase 3: exportación DAISY incluye verificación del paquete antes de compartirlo", () => {
  const daisy = readFileSync(new URL("../Sources/NativeGeminiDaisyExport.swift", import.meta.url), "utf8");
  const verifier = readFileSync(new URL("../Sources/NativeDaisyPackageVerifier.swift", import.meta.url), "utf8");
  assert.match(daisy, /NativeDaisyPackageVerifier\.validate\(/);
  assert.match(verifier, /"book\.opf", "book\.xml", "book\.ncx", "sync\.smil"/);
  assert.match(verifier, /textRefs\.count == audioRefs\.count/);
  assert.match(verifier, /Reject WAV renamed to MP3/);
});

test("fase 3: metadatos DAISY respetan el idioma seleccionado", () => {
  const daisy = readFileSync(new URL("../Sources/NativeGeminiDaisyExport.swift", import.meta.url), "utf8");
  const audio = readFileSync(new URL("../Sources/NativeGeminiAudioExport.swift", import.meta.url), "utf8");
  assert.match(reader, /Picker\("Idioma del contenido", selection: \$audioExportLanguage\)/);
  assert.match(reader, /language: audioExportLanguage/);
  assert.match(audio, /language: language, progress: progress/);
  assert.match(daisy, /xml:lang="\\\(lang\)"/);
  assert.match(daisy, /<dc:Language>\\\(lang\)<\/dc:Language>/);
});

test("fase 3: todos los segmentos DAISY tienen pista declarada y tiempo positivo", () => {
  const verifier = readFileSync(new URL("../Sources/NativeDaisyPackageVerifier.swift", import.meta.url), "utf8");
  assert.match(verifier, /audioRefs\.allSatisfy\(\{ manifest\.contains\(\$0\) \}\)/);
  assert.match(verifier, /Set\(audioRefs\)\.count == audioRefs\.count/);
  assert.match(verifier, /clipBegins\.count/);
  assert.match(verifier, /finish > beginning/);
});

test("fase 3: una exportación DAISY fallida no deja ZIP incompletos", () => {
  const daisy = readFileSync(new URL("../Sources/NativeGeminiDaisyExport.swift", import.meta.url), "utf8");
  assert.match(daisy, /var verified = false/);
  assert.match(daisy, /if !verified \{ try\? FileManager\.default\.removeItem\(at: output\) \}/);
  assert.match(daisy, /try NativeDaisyPackageVerifier\.validate\(output\)/);
  assert.match(daisy, /verified = true/);
});

test("fase 3: el verificador DAISY no almacena todas las pistas en memoria", () => {
  const verifier = readFileSync(new URL("../Sources/NativeDaisyPackageVerifier.swift", import.meta.url), "utf8");
  assert.match(verifier, /let remaining = max\(0, 65_536 - bytes\.count\)/);
  assert.match(verifier, /audioHeaders\[name\] = bytes/);
  assert.match(verifier, /audioSizes\[name\] = UInt64\(entry\.uncompressedSize\)/);
  assert.match(verifier, /manifest\.allSatisfy\(\{ entries\.contains\(\$0\) \}\)/);
});

test("fase 3: selección múltiple VoiceOver con estados y acciones en lote", () => {
  assert.match(reader, /Button\(selectionMode \? "Terminar selección" : "Selección"\)/);
  assert.match(reader, /"seleccionado" : "no seleccionado"/);
  assert.match(reader, /Button\("Seleccionar todos los visibles"\)/);
  assert.match(reader, /Button\("Deseleccionar todos"\)/);
  assert.match(reader, /Button\("Mover seleccionados a carpeta"\)/);
  assert.match(reader, /Button\("Añadir seleccionados a favoritos"\)/);
  assert.match(reader, /Button\("Quitar seleccionados de favoritos"\)/);
  assert.match(reader, /func moveDocuments\(withIDs ids: Set<UUID>, to folder: String\?\)/);
  assert.match(reader, /func markFavorites\(withIDs ids: Set<UUID>, favorite: Bool\)/);
});

test("fase 3: botón único de carpetas con crear al inicio del listado", () => {
  assert.match(reader, /Button\("Carpeta: \\\(selectedFolderLabel\)"\)/);
  assert.match(reader, /\.sheet\(isPresented: \$showFolderPicker\)/);
  assert.match(reader, /Section\("Elegir carpeta"\)/);
  assert.match(reader, /Button\("Crear carpeta"\)/);
});
test("fase 3: último abierto persiste sin romper documentos anteriores", () => {
  assert.match(reader, /var lastOpenedAt: Date\? = nil/);
  assert.match(reader, /func markOpened\(_ document: NativeReadingDocument\)/);
  assert.match(reader, /\.onAppear \{ library\.markOpened\(document\) \}/);
  assert.match(reader, /"Formato", "Último abierto"/);
});
test("fase 3: título y porcentaje leído son una única etiqueta accesible", () => {
  assert.match(reader, /private func documentRowLabel\(_ doc: NativeReadingDocument\)/);
  assert.match(reader, /por ciento leído/);
  assert.match(reader, /\.accessibilityLabel\(documentRowLabel\(document\)\)/);
});
