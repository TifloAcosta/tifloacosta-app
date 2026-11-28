import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../Sources/'+name, import.meta.url), 'utf8');
const main = read('NativeAccessibleCinema.swift');
const drive = read('NativeCinemaPublicDrive.swift');
const browser = read('NativeCinemaPublishedDriveBrowser.swift');

test('Audesc uses the same correctly named provider with two independent language variants', () => {
    assert.doesNotMatch(main, /Universo Audesc Latina/);
    assert.match(main, /name: "Universo Audesc Latino"/);
    assert.match(main, /source.id == "audesc-es" \? "Español de España" : "Español latino"/);
    assert.match(main, /NavigationLink\("Universo Audesc"\)/);
});

test('Drive indexes the entire reachable tree, retains checkpoints, handles retries and reports incomplete coverage', () => {
    assert.doesNotMatch(drive, /pages < 40|timeIntervalSince\(started\) < 20|result.hits.count < 100/);
    assert.match(drive, /while state.offset < state.queue.count/);
    assert.match(drive, /state.seenFolders.insert\(entry.id\).inserted/);
    assert.match(drive, /state.pages.contains\(Cursor\(folderID: folder.id, token: next\)\)/);
    assert.match(drive, /snapshots\[sourceID\] = state/);
    assert.match(drive, /try Task.checkCancellation\(\)/);
    assert.match(drive, /pageSize: 500/);
    assert.match(drive, /for attempt in 0\.\.<3/);
    assert.match(drive, /if page.incomplete \{ state.failed = true \}/);
    assert.match(drive, /application\/vnd.google-apps.shortcut/);
    assert.match(drive, /hit.path.dropFirst\(\).map\(\\\.name\)/);
});

test('only complete metadata snapshots are stored locally without resource keys, and selection revalidates the live tree', () => {
    assert.match(drive, /guard let date = snapshot.completed, !snapshot.failed/);
    assert.match(drive, /resourceKey: nil/);
    assert.match(drive, /pageCursor: nil/);
    assert.match(drive, /options: \[\.atomic, \.completeFileProtection\]/);
    assert.match(drive, /Date\(\).timeIntervalSince\(value.date\) <= 86_400/);
    assert.match(drive, /Date\(\).timeIntervalSince\(\$0\) < 900/);
    assert.match(drive, /cached.stale = true/);
    assert.match(drive, /failure == \.denied \|\| failure == \.noLongerAvailable/);
    assert.match(browser, /resolveSearchHit\(hit\)/);
    assert.match(drive, /let targets = Array\(hit.path.dropFirst\(\)\) \+ \[hit.entry\]/);
    assert.match(drive, /page.entries.first\(where: \{ \$0.id == target.id \}\)/);
    assert.match(drive, /throw NativeCinemaPublicDriveError.noLongerAvailable/);
});

test('each of 27 directory entries has either a direct catalogue route or an explicit external search, never fabricated availability', () => {
    const directory = main.split('private enum AccessibleCinemaDirectory')[1].split('struct NativeAccessibleCinemaScreen')[0];
    const ids = [...directory.matchAll(/\.init\(id: "([^"]+)"/g)].map(x => x[1]);
    assert.equal(ids.length, 27);
    assert.equal(new Set(ids).size, 27);
    const direct = ['audesc-es','audesc-latino','audiocinemateca','tape-territory','movies-for-the-blind'];
    for (const id of direct) assert.ok(main.includes('"'+id+'"'));
    const external = ids.filter(x => !direct.includes(x));
    assert.equal(external.length, 22);
    assert.match(main, /eligibleSources.filter \{ !\["audesc-es", "audesc-latino", "audiocinemateca", "tape-territory", "movies-for-the-blind"\].contains\(\$0.id\)/);
    assert.match(main, /ForEach\(externalSearchSources\)/);
    assert.match(main, /combinedExternalSearchURL/);
    assert.match(main, /providerSearchURL\(source\)/);
    assert.match(main, /Estos catálogos no se consultan automáticamente/);
    assert.match(main, /adpSearchURL\(provider: provider\)/);
    assert.match(main, /frenchDiscoveryURL\(freeOnly: true\)/);
    assert.match(main, /No hay resultados confirmados/);
});

test('all new search labels translated, progressive results and explicit stale status accessible', () => {
    const keys = ["Universo Audesc Latino","Español latino","%@: %d páginas consultadas","%@: índice anterior, pendiente de actualizar","Índice anterior, pendiente de actualizar: ","Los resultados corresponden únicamente a los catálogos consultados. Las demás plataformas requieren una búsqueda externa.","Actualizar índice de Universo Audesc","Buscar en plataformas externas","Estos catálogos no se consultan automáticamente. Abre la plataforma o busca el título en su web. Comprueba que la obra tenga audiodescripción.","Buscar en la plataforma original","Buscar título en la web","Buscadores especializados","Buscar en todas las webs de estas plataformas"];
    for(const lang of ['en','de','fr','it','pt']) {
        const strings = read(lang+'.lproj/Localizable.strings');
        for (const key of keys) assert.ok(strings.includes(JSON.stringify(key)+' = '),lang+': '+key);
    }
    assert.match(main, /driveSearchProgress/);
    assert.match(main, /staleSources/);
    assert.match(main, /submittedSearch = nil/);
    assert.match(main, /Text\(driveSearchProgress\).accessibilityAddTraits\(\.updatesFrequently\)/);
});
