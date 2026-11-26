import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const archive = read('NativeBackupSectionArchive.swift');
const reader = read('NativeTifloLector.swift');
const music = read('NativeMyMusic.swift');
const coordinator = read('NativeBackupCoordinator.swift');
const section = (source, begin, end) => source.slice(source.indexOf(begin), source.indexOf(end, source.indexOf(begin)));

test('reader global backup snapshots complete persisted reading records and only referenced files', () => {
    const source = section(reader, 'func createGlobalBackupArchive()', 'func restoreBackup(');
    assert.match(source, /let snapshot = documentsForPersistence\(\)/);
    assert.match(source, /let folderSnapshot = folders/);
    assert.match(source, /document\.trackPaths \?\? \[\]/);
    assert.match(source, /document\.originalRelativePath/);
    assert.match(source, /String\(pieces\[1\]\) == document\.id\.uuidString/);
    assert.match(source, /"documentos.json": encoder.encode\(snapshot\)/);
    assert.match(source, /"carpetas.json": encoder.encode\(folderSnapshot\)/);
    assert.match(source, /Task.detached\(priority: \.utility\)/);
    assert.doesNotMatch(source, /contentsOfDirectory|UserDefaults\.standard\.dictionaryRepresentation/);
});

test('music global backup captures ordered playlists, local audio, folders and edited metadata', () => {
    const source = section(music, 'func createGlobalBackupArchive()', 'func createCompleteArchive()');
    assert.match(source, /let index = exportIndex\(\)\?\.text/);
    assert.match(source, /let sourceFiles = files/);
    assert.match(source, /locations: \[MusicPortableLocation\(provider: "archive"/);
    assert.match(source, /folders: snapshot.folders, playlists: snapshot.playlists/);
    assert.match(source, /smartFolders: snapshot.smartFolders, audioProfiles: snapshot.audioProfiles/);
    assert.match(source, /hasEditedTrackInformation: file.hasEditedTrackInformation/);
    assert.match(source, /guard tracks.count == media.count/);
    assert.match(source, /manifest.count <= 8_388_608/);
    assert.match(music, /hasEditedTrackInformation: track.hasEditedTrackInformation\)\)/);
    assert.equal((music.match(/mp3\|m4a\|m4b\|aac\|wav\|aif\|aiff\|caf\|flac\|ogg/g)||[]).length, 2);
});

test('section archive rejects duplicate paths, unsafe roots and oversized restores', () => {
    assert.match(archive, /paths.insert\(path\).inserted/);
    assert.match(archive, /rootValues.isSymbolicLink == false/);
    assert.match(archive, /Array\(components.prefix\(prefix.count\)\) == prefix/);
    assert.match(archive, /attributes.isSymbolicLink == false/);
    assert.match(archive, /values.isRegularFile == true, values.isSymbolicLink == false/);
    assert.match(archive, /next <= maxBytes/);
    assert.match(archive, /files.count \+ metadata.count <= maxEntries/);
    assert.match(archive, /else \{ try\? fm.removeItem\(at: work\) \}/);
    assert.match(archive, /Task.checkCancellation\(\)/);
});

test('coordinator never publishes a subset of a requested selection', () => {
    assert.match(coordinator, /supportedSections: Set<NativeBackupManifest.Section> = \[.reader, .music\]/);
    assert.match(coordinator, /sections.isSubset\(of: Self.supportedSections\)/);
    assert.match(coordinator, /guard !isCreating/);
    assert.match(coordinator, /archives\[.reader\] = try await reader.createGlobalBackupArchive\(\)/);
    assert.match(coordinator, /archives\[.music\] = try await NativeMusicBackupAdapter.createArchive\(\)/);
    assert.match(coordinator, /let prepared = archives[\s\S]*?destination.publish\(archives: prepared\)/);
    assert.match(coordinator, /for archive in archives.values/);
});
