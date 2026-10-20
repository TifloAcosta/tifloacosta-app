import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const swift = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const r = swift('NativeTifloLector.swift');
const f = swift('NativeReaderFormats.swift');
const s = swift('NativeReaderSettings.swift');
const a = swift('NativeReaderAdvanced.swift');

test('OCR de PDF mixtos y reconocimiento calibrable por idioma', () => {
    assert.match(f, /if pageText\.isEmpty/);
    assert.match(f, /ocrPDFPage\(pdf, at: index\)/);
    assert.match(f, /automaticallyDetectsLanguage/);
    assert.match(f, /recognitionLanguages/);
    assert.match(a, /Precisión del OCR/);
});
test('Personal Voice requiere autorización, y los ajustes individuales no descargan voces', () => {
    assert.match(s, /requestPersonalVoiceAuthorization/);
    assert.match(s, /voiceTraits\.contains\(\.isPersonalVoice\)/);
    assert.match(s, /allowVoiceDownloads: false/);
    assert.match(s, /Tono de lectura/);
    assert.match(r, /pitchMultiplier/);
});
test('Diccionario, pronunciación y traducción nativa disponible', () => {
    assert.match(a, /UIReferenceLibraryViewController\(term: term\)/);
    assert.match(a, /Escuchar pronunciación/);
    assert.match(r, /translationPresentation/);
});
test('Índice por estructura y bloques correctamente diferenciados', () => {
    assert.match(r, /namedHeadings/);
    assert.match(r, /hasRealPages/);
    assert.match(r, /jump\(to: point\.offset\)/);
    assert.match(f, /<h\[1-6\]/);
});
