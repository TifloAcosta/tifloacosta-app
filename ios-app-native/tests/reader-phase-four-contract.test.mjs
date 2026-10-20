import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const catalogs = source('NativeReaderExternalCatalogs.swift');
const reader = source('NativeTifloLector.swift');

test('una única entrada Importar conserva Archivos e incorpora bibliotecas en línea', () => {
    assert.match(reader, /Button\("Importar", systemImage:/);
    assert.match(reader, /confirmationDialog\("Importar"/);
    assert.match(reader, /Button\("Desde Archivos"\)/);
    assert.match(reader, /Button\("Bibliotecas en línea"\)/);
    assert.match(reader, /NativeReaderCatalogsScreen\(\)/);
});

test('se preservan títulos de catálogo, biblioteca local y opciones de importación anteriores', () => {
    assert.match(reader, /preferredTitle: String\? = nil/);
    assert.match(reader, /NativeReaderFormats\.read\(url, documentID: identifier\)/);
    assert.match(reader, /NativeReaderFormats\.deleteStoredFiles\(for: identifier\)/);
    assert.match(catalogs, /library\.importDocuments\(from: \[prepared\], preferredTitle: title\)/);
});

test('Proyecto Gutenberg y catálogos OPDS 1 y 2 se exploran con búsqueda y paginación', () => {
    assert.match(catalogs, /https:\/\/www\.gutenberg\.org\/ebooks\/search\.opds\//);
    assert.match(catalogs, /XMLParserDelegate/);
    assert.match(catalogs, /JSONSerialization\.jsonObject/);
    assert.match(catalogs, /Mostrar más resultados/);
    assert.match(catalogs, /Buscar en todo Proyecto Gutenberg/);
    assert.match(catalogs, /onDelete/);
});

test('la descarga usa HTTPS y limita formatos, tamaños y enlaces de compra o préstamo', () => {
    assert.match(catalogs, /url\.scheme\?\.lowercased\(\) == "https"/);
    assert.match(catalogs, /bookLimit = 80 \* 1024 \* 1024/);
    assert.match(catalogs, /isDirectAcquisition/);
    assert.doesNotMatch(catalogs, /acquisition\/borrow/);
    assert.match(catalogs, /response\.mimeType\?\.lowercased\(\) == "text\/html"/);
});

test('Bookshare no aparenta acceso autorizado inexistente ni almacena contraseñas', () => {
    assert.match(catalogs, /Link\("Abrir Bookshare"/);
    assert.match(catalogs, /Bookshare exige una cuenta elegible y autorización de su API/);
    assert.doesNotMatch(catalogs, /client_secret|passwordField|usernameField/);
});
