import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const format = read('NativeReaderFormats.swift');
const reader = read('NativeTifloLector.swift');
const messages = [
  "Este documento contiene texto en forma de imagen. TifloLector lo reconocerá automáticamente para que puedas leerlo de forma accesible.",
  "Reconocimiento parcial. No se encontró texto en %d páginas procesadas. El texto disponible se ha guardado.",
  "Reconocimiento completado. El documento está listo para su lectura.",
  "Reconocimiento de texto cancelado.",
  "No se pudo completar el reconocimiento o guardar el documento."
];
test('OCR start only when recognition actually begins, once per scanned PDF or image', () => {
    const source = format.slice(format.indexOf('static func read(_ url:'), format.indexOf('static func storedURL'));
    assert.match(source, /if pageText\.isEmpty \{[\s\S]*?if scannedPages == 1 \{ onOCRStart\?\(\) \}[\s\S]*?ocrPDFPage/);
    assert.match(source, /case "jpg", "jpeg", "png"[\s\S]*?onOCRStart\?\(\)[\s\S]*?recognizeText\(in: data\)/);
    assert.equal((source.match(/onOCRStart\?\(\)/g) || []).length, 2);
    assert.match(source, /if pageText\.isEmpty \{ unreadablePages \+= 1 \}/);
});
test('OCR completion announced only after persistence, failures have a distinct status', () => {
    const source = reader.slice(reader.indexOf('func importFile(from url:'), reader.indexOf('private func persistImportedDocument'));
    assert.match(source, /if let existing = documents\.first[\s\S]*?return existing/);
    assert.match(source, /AsyncStream<Void>\.makeStream\(bufferingPolicy: \.bufferingOldest\(1\)\)/);
    assert.match(source, /try await persistImportedDocument\(document\)[\s\S]*?if payload\.ocrAttemptedPages > 0[\s\S]*?payload\.ocrUnreadablePages > 0/);
    assert.match(source, /if await ocrTask\.value[\s\S]*?error is CancellationError/);
    for (const key of messages) assert.ok(source.includes(key), key);
    assert.equal((source.match(/UIAccessibility\.post\(notification: \.announcement, argument: message\)/g) || []).length, 3);
    assert.match(reader, /importSelectedFiles\(from: urls, onOCRStatus:/);
    assert.match(reader, /importFolder\(from: folder, onOCRStatus:/);
});
test('OCR messages are translated and partial message preserves the page count placeholder', () => {
    for (const language of ['en','fr','it','pt','de']) {
        const strings = read(language + '.lproj/Localizable.strings');
        for (const message of messages) {
            const prefix = JSON.stringify(message) + ' = ';
            const lines = strings.split('\n').filter(line => line.startsWith(prefix));
            assert.equal(lines.length, 1, language + ': ' + message);
            if (message.includes('%d')) assert.match(lines[0].slice(prefix.length), /%d/);
        }
    }
});
