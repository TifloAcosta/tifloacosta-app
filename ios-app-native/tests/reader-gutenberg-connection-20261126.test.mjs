import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../Sources/'+p,import.meta.url),'utf8');
const src=read('NativeReaderExternalCatalogs.swift');
test('Gutenberg requests use the official endpoint and an identifiable application user agent',()=>{
 assert.ok(src.includes('https://www.gutenberg.org/ebooks/search.opds/'));
 assert.ok(src.includes('["www.gutenberg.org", "gutenberg.org"].contains(host)'));
 assert.ok(src.includes('CFBundleShortVersionString'));
 assert.ok(src.includes('tifloacosta@gmail.com'));
 assert.ok(src.includes('forHTTPHeaderField: "User-Agent"'));
 assert.ok(src.includes('var request = catalogRequest(url)'));
 assert.ok(src.includes('var request = catalogRequest(link.url)'));
});
test('Gutenberg rejection is distinct from an empty catalogue and provides a manual official link',()=>{
 for(const token of ['http.statusCode == 403','http.statusCode == 429','!loading && !feedFailed && filtered.isEmpty','feedFailed && !loading','https://www.gutenberg.org/','Task.isCancelled, currentURL == url']) assert.ok(src.includes(token),token);
 for(const lang of ['en','pt','fr','it','de']) for(const key of ["Proyecto Gutenberg ha rechazado la conexión. Puedes consultar su web oficial.","Proyecto Gutenberg ha limitado temporalmente las consultas. Inténtalo más tarde.","Abrir Proyecto Gutenberg en la web"]) assert.ok(read(lang+'.lproj/Localizable.strings').includes('"'+key+'" = '),lang+' '+key);
});

test('native feed supports retries, valid OPDS roots, and server-side Gutenberg search without double filtering',()=>{
 for(const token of ['Button("Reintentar") { loadRevision += 1 }','if isGutenberg { return entries }','guard parser.parse(), hasFeedRoot','root["groups"]','term.isEmpty ? nil','loadRevision == revision','parser.shouldResolveExternalEntities = false']) assert.ok(src.includes(token),token);
});

test('Gutenberg service unavailability respects Retry-After across sessions for catalogues and downloads',()=>{
 for(const token of ['http.statusCode == 503','http.value(forHTTPHeaderField: "Retry-After")','UserDefaults.standard.set(date, forKey: gutenbergRetryKey)','try respectGutenbergRetryAfter(url)','try respectGutenbergRetryAfter(link.url)','date > Date()']) assert.ok(src.includes(token),token);
 for(const lang of ['en','pt','fr','it','de']) for(const key of ["Proyecto Gutenberg no está disponible temporalmente. Inténtalo más tarde.","Proyecto Gutenberg solicita esperar hasta %@ antes de volver a conectar."]) assert.ok(read(lang+'.lproj/Localizable.strings').includes('"'+key+'" = '),lang+' '+key);
});
