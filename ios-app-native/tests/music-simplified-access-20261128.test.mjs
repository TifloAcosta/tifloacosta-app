import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../Sources/'+name, import.meta.url), 'utf8');
const music = read('NativeMyMusic.swift');
const recognition = read('NativeMusicRecognition.swift');
const account = read('NativeAcoustIDAccount.swift');
const lookup = read('NativeAcoustIDLookup.swift');
test('lookup is allowed without a personal key until service requires it', () => {
    const identify = recognition.split('func identify(_ audioURL:')[1].split('private func request(')[0];
    assert.doesNotMatch(identify, /guard let user else/);
    assert.match(identify, /request\("lookup", client: client, user: user/);
    assert.match(identify, /NativeAcoustIDKeychain.read\(\.active\) == user/);
    assert.match(lookup, /code == 4 \|\| code == 21/);
    assert.match(recognition, /path == "lookup", NativeAcoustIDLookup.requiresUserKey/);
    assert.doesNotMatch(music, /guard NativeMusicRecognition.hasActiveAccount|if NativeMusicRecognition.hasActiveAccount/);
});
test('authorization saves the personal key and resumes only the unfinished tracks', () => {
    assert.match(account, /openURL\(payload.link.url\)/);
    assert.match(account, /NativeAcoustIDKeychain.save\(payload.apikey, in: \.active\)/);
    assert.match(account, /onAuthorized\?\(\)/);
    assert.match(account, /DisclosureGroup\("Clave personal de AcoustID"/);
    assert.match(music, /ids.dropFirst\(max\(0, recognitionCompleted - recognitionBaseCompleted\)\)/);
    assert.match(music, /identify\(pending, resuming: true\)/);
    assert.match(music, /recognitionBaseCompleted \+ completed/);
    assert.match(music, /AcoustID recibe la huella acústica y la duración. El audio se queda en el dispositivo./);
});
test('one focus stop per song exposes the same actions as the visual menu', () => {
    assert.match(music, /@Environment\(\\\.accessibilityVoiceOverEnabled\)/);
    assert.match(music, /\.accessibilityActions \{ musicTrackActions\(file\) \}/);
    assert.match(music, /Menu\(MusicLocalized.format\("Acciones de %@", file.name\)\) \{ musicTrackActions\(file\) \}\s*\.accessibilityHidden\(voiceOverEnabled\)/);
    const actions = music.split('private func musicTrackActions(')[1].split('private func musicTrackRow(')[0];
    for (const label of ['Identificar canción','Editar información de la canción','Editar género','Añadir a %@','Añadir a lista %@','Eliminar de la biblioteca']) assert.ok(actions.includes(label), label);
    assert.match(actions, /pendingRemoval = file/);
});
test('collection contents are collapsed and new controls translated', () => {
    assert.match(music, /DisclosureGroup\(album.name\)/);
    assert.match(music, /DisclosureGroup\(MusicLocalized.format\("%@, %d canciones", playlist.name/);
    assert.match(music, /case \.folders: musicFoldersSection/);
    assert.match(music, /case \.smartFolders: musicSmartFoldersSection/);
    for(const lang of ['en','de','fr','it','pt']) {
        const strings = read(lang+'.lproj/Localizable.strings');
        for (const key of ['Autorizar cuenta en AcoustID','AcoustID requiere que autorices tu cuenta para identificar canciones. Solo tienes que hacerlo una vez, salvo que la autorización caduque o se revoque.','Opciones de reproducción','Volver a Mi Música']) {
            assert.ok(strings.includes(JSON.stringify(key)+' = '),lang+': '+key);
        }
    }
});
