import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const archive = read('NativeBackupSectionArchive.swift');
const reader = read('NativeTifloLector.swift');
const music = read('NativeMyMusic.swift');
const coordinator = read('NativeBackupCoordinator.swift');
const cinema = read('NativeAccessibleCinemaLibrary.swift');
const personal = read('NativeBackupPersonalData.swift');
const radio = read('NativeRadioBrowser.swift');
const voiceProfiles = read('NativeReaderSettings.swift');
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
    assert.match(coordinator, /supportedSections: Set<NativeBackupManifest.Section> = \[.reader, .music, .cinema, .podcasts, .radio, .preferences\]/);
    assert.match(coordinator, /sections.isSubset\(of: Self.supportedSections\)/);
    assert.match(coordinator, /guard !isCreating/);
    assert.match(coordinator, /archives\[.reader\] = try await reader.createGlobalBackupArchive\(\)/);
    assert.match(coordinator, /archives\[.music\] = try await NativeMusicBackupAdapter.createArchive\(\)/);
    assert.match(coordinator, /let prepared = archives[\s\S]*?destination.publish\(archives: prepared\)/);
    assert.match(coordinator, /for archive in archives.values/);
});

test('cinema backs up only selected personal files and stable history, not provider media', () => {
    const source = section(cinema, 'func createGlobalBackupArchive()', 'private func persist(');
    assert.match(source, /let snapshot = items/);
    assert.match(source, /let recent = NativeCinemaRecentStore.shared.entries/);
    assert.match(source, /item.storedName == item.id.uuidString \+ "\." \+ ext/);
    assert.match(source, /"catalogo-personal.json": encoder.encode\(snapshot\)/);
    assert.match(source, /"historial.json": encoder.encode\(recent\)/);
    assert.doesNotMatch(source, /Credentials|URLSession|Cache.shared|currentCloudReference/);
});
test('podcast backup captures personal records and reports excluded URL references', () => {
    assert.match(personal, /url.user == nil, url.password == nil/);
    assert.match(personal, /url.percentEncodedQuery == nil, url.percentEncodedFragment == nil/);
    assert.match(personal, /let followed = library.followed.filter/);
    assert.match(personal, /let progress = library.playbackProgress.filter/);
    assert.match(personal, /let previous = downloads.entries.filter/);
    assert.match(personal, /excludedReferences: excluded/);
    assert.match(personal, /files: \[\], maxBytes: 32_000_000/);
});
test('radio and preferences preserve explicit personal data without copying account records', () => {
    assert.match(radio, /struct NativeRadioBackupEntry: Codable/);
    assert.match(radio, /stationID: station.stationuuid/);
    assert.match(radio, /NativeBackupReferencePolicy.eligible\(station.url_resolved\) \? station.url_resolved : nil/);
    assert.match(radio, /requiresDirectoryLookup: entries.filter/);
    assert.match(personal, /favorites: favorites.keys, savedForLater: activity.savedForLater/);
    assert.match(personal, /recentlyRead: activity.recentlyRead, youtubeVideos: youtube.videos/);
    assert.match(personal, /voiceProfiles: try NativeReaderVoiceProfileStore.backupProfiles/);
    assert.match(voiceProfiles, /where key.hasPrefix\(prefix\)/);
    assert.match(voiceProfiles, /JSONDecoder\(\).decode\(NativeReaderVoiceProfile.self, from: data\)/);
    assert.doesNotMatch(personal, /"native-reader-gemini-validated"|"mi-musica-auto-backup-destination-bookmark"/);
});
test('all six selected archives must exist before publication, and missing stores abort', () => {
    for (const name of ['reader','music','cinema','podcasts','radio','preferences']) {
        assert.ok(coordinator.includes('archives[.' + name + '] = try await'), name);
    }
    assert.match(coordinator, /guard Set\(archives.keys\) == sections/);
    assert.match(coordinator, /throw Failure.missingLiveStore/);
});
