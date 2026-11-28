import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const screens = source('NativeScreens.swift');
const reader = source('NativeTifloLector.swift');
const docs = source('NativeDocuments.swift');
const service = source('NativeResourceService.swift');
const catalog = source('NativeCatalogStore.swift');
const youtube = source('NativeYouTubePlayer.swift');
const account = source('NativeYouTubeAccount.swift');
const news = source('NativeNews.swift');
const inline = source('NativeMediaInline.swift');

test('offline catalog and resource copies are persistent, user controlled, and resolved before network', () => {
    assert.match(catalog, /private var cacheURL: URL \{\s*FileManager.default.urls\(for: \.applicationSupportDirectory/);
    assert.match(catalog, /legacyCacheURL/);
    assert.match(service, /RecursosSinConexion/);
    assert.match(service, /JSONEncoder\(\)\.encode\(content\)\.write\(to: destination, options: \.atomic\)/);
    assert.match(service, /SHA256\.hash/);
    const lookup = service.split('private func payload(for')[1];
    assert.ok(lookup.indexOf('JSONDecoder().decode(NativeResourcePayload.self') < lookup.indexOf('URLSession.shared.data(for: request)'));
    assert.match(service, /removeOffline\(/);
    assert.match(service, /while cacheOrder.count > 4/);
    assert.match(screens, /Guardar %d recursos sin conexión/);
    assert.match(screens, /offlineTask\?\.cancel\(\)/);
    assert.match(docs, /Actualizar copia sin conexión/);
    assert.match(docs, /Eliminar copia sin conexión/);
});

test('native document links are explicitly extracted, safe schemes only, shown in order', () => {
    assert.match(docs, /struct NativeResourceReadingBlock: Sendable/);
    assert.match(docs, /URL\(string: raw, relativeTo: source\)\?\.absoluteURL/);
    assert.match(docs, /\["https", "http"\]\.contains\(url.scheme/);
    assert.match(docs, /url.user == nil, url.password == nil/);
    assert.match(docs, /tagged.replaceSubrange\(full, with:/);
    assert.match(docs, /Link\(paragraphs\[index\]\.text, destination: url\)/);
    assert.doesNotMatch(docs + service, /WKWebView|UIWebView/);
    assert.match(service, /NativeResourceReadingBlock.make\(data: content.data, source: content.source/);
});

test('reader prepares text layout away from interface before showing book', () => {
    const opening = reader.split('private struct NativeReaderOpeningScreen: View {')[1].split('struct NativeReadingScreen: View {')[0];
    assert.match(opening, /ProgressView\("Abriendo documento"\)/);
    assert.match(opening, /Task.detached\(priority: \.userInitiated\)/);
    assert.match(opening, /NativeReaderTextLayout\(body\)/);
    assert.match(opening, /guard !Task.isCancelled else \{ return \}/);
    assert.match(opening, /preparedLayout: prepared.layout/);
    assert.match(reader, /self.textLayout = preparedLayout \?\? NativeReaderTextLayout/);
    assert.match(reader, /NativeReaderOpeningScreen\(document: doc/);
});

test('updates aggregate both channel sources without cancelling on subscription pagination', () => {
    const updates = screens.split('private struct NativeYouTubeFollowedUpdatesScreen: View {')[1].split('// Una sola definición de gestos')[0];
    assert.match(updates, /subscriptions \+ local/);
    assert.match(updates, /seen.insert\(\$0.id\).inserted/);
    assert.match(updates, /tokens.insert\(account.subscriptionsNextPageToken\).inserted/);
    assert.match(updates, /generation == loadGeneration, !Task.isCancelled/);
    assert.match(updates, /recentUploads: true/);
    assert.match(updates, /gather\(\)/);
    assert.match(youtube, /URLQueryItem\(name: "uploads", value: "1"\)/);
    assert.match(account, /credential == expectedCredential/);
});

test('news player is presented from stable parent and linked videos use native player', () => {
    assert.match(inline, /@Binding var selectedVideo: NativeYouTubeVideo\?/);
    assert.match(news, /\.sheet\(item: \$selectedMediaVideo\)/);
    assert.match(news, /NativeNewsMetadata.linkedVideos\(item\)/);
    assert.match(news, /NativeYouTubeVideo\(media: media\)/);
    assert.match(news, /selectedVideo = video/);
    assert.match(news, /NativeYouTubePlayerScreen\(video: video\)/);
});

test('new reader and offline controls have all five additional languages', () => {
    const keys = ["Disponible sin conexión","Copia sin conexión eliminada","Actualizar copia sin conexión","Eliminar copia sin conexión","Guardar sin conexión","Copias sin conexión: %d guardadas, %d fallidas.","Guardar %d recursos sin conexión","Abriendo documento"];
    for (const language of ["en","fr","de","it","pt"]) {
        const strings = source(language + '.lproj/Localizable.strings');
        for (const key of keys) assert.ok(strings.includes(JSON.stringify(key) + ' = '), language + ': ' + key);
    }
});
