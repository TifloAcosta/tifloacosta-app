import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const expected = {
  "NativeDownloads.swift": [
    "var note = MusicLocalized.message(\"El servidor se comprobará al descargar.\")",
    "note = MusicLocalized.message(\"El servidor no admite análisis previo; se comprobará al descargar.\")",
    "note = MusicLocalized.message(\"El servidor ha respondido correctamente.\")",
    "note = MusicLocalized.message(\"No se pudo verificar el acceso previo. Se comprobará al descargar.\")",
    "MusicLocalized.format(\"%@ reconocido. %@\", MusicLocalized.message(item.type), note)",
    "alertText = MusicLocalized.format(\"«%@» importado a TifloLector.\", file.title)",
    "alertText = MusicLocalized.format(\"No se pudo importar «%@»: %@\", file.title, error.localizedDescription)",
    "catch { alertText = MusicLocalized.format(\"No se pudo eliminar la descarga: %@\", error.localizedDescription) }"
  ],
  "NativeDocuments.swift": [
    "announce(MusicLocalized.message(\"El documento aún no está disponible para leer.\"))",
    "announce(MusicLocalized.message(\"Lectura iniciada.\"))",
    "announce(MusicLocalized.message(\"Documento guardado en TifloLector.\"))",
    "announce(MusicLocalized.format(\"No se pudo guardar: %@\", error.localizedDescription))",
    "announce(MusicLocalized.message(\"Selecciona la ubicación para descargar el archivo.\"))",
    "announce(MusicLocalized.format(\"No se pudo descargar: %@\", error.localizedDescription))",
    "Button(MusicLocalized.message(readingActivity.isSaved(.resource, item: item)\n                            ? \"Quitar de Leer después\" : \"Guardar para leer después\"))",
    "announce(MusicLocalized.message(saved ? \"Recurso guardado para leer después.\" :\n                                \"Recurso retirado de Leer después.\"))",
    "Button(MusicLocalized.message(imported ? \"Guardado en TifloLector\" : \"Guardar en TifloLector\"))"
  ],
  "NativeReaderDocumentTranslation.swift": [
    "translationError = MusicLocalized.format(\"No se pudo traducir el documento: %@\", error.localizedDescription)"
  ]
};
const keys = ["El servidor se comprobará al descargar.","El servidor no admite análisis previo; se comprobará al descargar.","El servidor ha respondido correctamente.","No se pudo verificar el acceso previo. Se comprobará al descargar.","%@ reconocido. %@","«%@» importado a TifloLector.","No se pudo importar «%@»: %@","No se pudo eliminar la descarga: %@","El documento aún no está disponible para leer.","Lectura iniciada.","Documento guardado en TifloLector.","No se pudo guardar: %@","Selecciona la ubicación para descargar el archivo.","No se pudo descargar: %@","Quitar de Leer después","Guardar para leer después","Recurso guardado para leer después.","Recurso retirado de Leer después.","Guardado en TifloLector","Guardar en TifloLector","No se pudo traducir el documento: %@"];
test('download, resource and translation status messages use the selected app language', () => {
  for (const [file, snippets] of Object.entries(expected)) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const snippet of snippets) assert.ok(source.includes(snippet), file + ': ' + snippet);
  }
  for (const language of ['en','fr','de','it','pt']) {
    const raw = readFileSync(new URL(language + '.lproj/Localizable.strings', root), 'utf8');
    for (const key of keys) assert.ok(raw.includes(JSON.stringify(key) + ' = '), language + ': ' + key);
  }
});
