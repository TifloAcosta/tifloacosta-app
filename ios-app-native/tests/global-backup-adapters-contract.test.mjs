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
    assert.match(source, /smartFolders: snapshot.smartFolders, audioProfiles: profiles/);
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
    assert.match(coordinator, /let prepared = archives[\s\S]*?destination.publish\(archives: prepared, generation: generation\)/);
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
    const capture = section(personal, 'struct NativeBackupPreferencesSnapshot', 'enum NativeBackupMetadataArchive');
    assert.doesNotMatch(capture, /"native-reader-gemini-validated"|"mi-musica-auto-backup-destination-bookmark"/);
    assert.match(personal, /defaults.bool\(forKey: "native-reader-gemini-validated"\)/);
});
test('all six selected archives must exist before publication, and missing stores abort', () => {
    for (const name of ['reader','music','cinema','podcasts','radio','preferences']) {
        assert.ok(coordinator.includes('archives[.' + name + '] = try await'), name);
    }
    assert.match(coordinator, /guard Set\(archives.keys\) == sections/);
    assert.match(coordinator, /throw Failure.missingLiveStore/);
});

test('restore preflight checks the entire generation and each archive without applying data', () => {
    const preflight = section(coordinator, 'func preflightRestore(', 'struct RestoreReport');
    assert.match(preflight, /destination\.verifiedGeneration\(generation\)/);
    assert.match(preflight, /for artifact in manifest\.artifacts/);
    assert.match(preflight, /NativeBackupSectionArchive\.verifyContentsForRestore/);
    assert.match(preflight, /Task\.detached\(priority: \.utility\)/);
    assert.match(preflight, /worker\.cancel\(\)/);
    assert.doesNotMatch(preflight, /restoreBackup\(|UserDefaults|removeItem|publish\(/);
});
test('restore structural checks reject ambiguous ZIP paths and require section metadata', () => {
    const preflight = archive.slice(archive.indexOf('static func validateForRestore('));
    assert.match(preflight, /entry\.type == \.file/);
    assert.match(preflight, /try validatePath\(path\)/);
    assert.match(preflight, /normalizedPaths\.insert\(normalized\)\.inserted/);
    assert.match(preflight, /!parents\.contains\(normalized\)/);
    assert.match(preflight, /!normalizedPaths\.contains\(parent\)/);
    assert.match(preflight, /required\.isSubset\(of: paths\)/);
    assert.match(preflight, /Int64\(exactly: entry\.uncompressedSize\)/);
    assert.match(preflight, /addingReportingOverflow/);
    assert.match(preflight, /next <= limit, paths\.count <= entryLimit/);
    for (const name of ['documentos.json','carpetas.json','manifest.json','catalogo-personal.json','historial.json','snapshot.json']) {
        assert.ok(preflight.includes('"' + name + '"'), name);
    }
    assert.doesNotMatch(preflight, /archive\.extract|copyItem|removeItem/);
});

test('restore checks CRC and actual decoded bytes before reading metadata snapshots', () => {
    const source = section(archive, 'static func verifyContentsForRestore(', 'static func validateForRestore(');
    assert.match(source, /try validateForRestore\(section: section, source: source\)/);
    assert.match(source, /archive\.extract\(entry\) \{ chunk in/);
    assert.match(source, /UInt64\(chunk.count\) <= entry.uncompressedSize - written/);
    assert.match(source, /written == entry.uncompressedSize, checksum == entry.checksum/);
    assert.match(source, /chunk.count <= 32_000_000 - snapshot.count/);
    assert.match(source, /NativeBackupPersonalDataValidation\.validate/);
    assert.doesNotMatch(source, /copyItem|removeItem|UserDefaults/);
});
test('personal data validation rejects unsupported versions duplicate identifiers and unapproved preferences', () => {
    const source = section(personal, 'enum NativeBackupPersonalDataValidation', 'enum NativeBackupPersonalDataMerge');
    for (const name of ['NativePodcastBackupSnapshot','NativeRadioBackupSnapshot','NativeBackupPreferencesSnapshot']) {
        assert.ok(source.includes('decoder.decode(' + name + '.self'), name);
    }
    assert.equal((source.match(/value\.schemaVersion == 1/g)||[]).length, 3);
    assert.match(source, /Set\(value\.savedEpisodes\.map\(\\\.id\)\)\.count == value\.savedEpisodes\.count/);
    assert.match(source, /Set\(ids\)\.count == ids\.count/);
    assert.match(source, /value\.requiresDirectoryLookup == value\.favorites\.filter/);
    for (const key of ['integer','boolean','number','string']) {
        assert.ok(source.includes('NativeBackupPreferencesSnapshot.' + key + 'Keys'));
    }
    assert.match(source, /value\.numbers\.values\.allSatisfy/);
    assert.match(source, /eligible\(\$0\.sourceURL\)/);
    assert.doesNotMatch(source, /UserDefaults|URLSession|\.filename\b/);
});

test('prepared metadata merges preserve current records and do not manufacture downloads or streams', () => {
    const source = section(personal, 'enum NativeBackupPersonalDataMerge', 'enum NativeBackupLibraryValidation');
    assert.match(source, /favorites\.union\(backup\.favorites\)/);
    assert.match(source, /appendMissing\(followed, backup\.followed/);
    assert.match(source, /!currentIDs\.contains\(\$0\.id\)/);
    assert.match(source, /max\(0, 200 - progress\.count\)/);
    assert.match(source, /!downloadedIDs\.contains\(\$0\.id\)/);
    assert.match(source, /progressNotImported: missing\.count - accepted\.count/);
    assert.match(source, /UUID\(uuidString: entry\.stationID\)/);
    assert.match(source, /unresolved\.append\(entry\)/);
    assert.match(source, /guard let stream = entry\.streamURL/);
    assert.match(source, /max\(0, 100 - recentlyRead\.count\)/);
    assert.match(source, /recentlyRead: recentlyRead \+ accepted/);
    assert.match(source, /ids\.insert\(id\(\$0\)\)\.inserted/);
    assert.doesNotMatch(source, /UserDefaults|URLSession|FileManager|\.filename\b/);
});

test('library restore decodes all three typed indexes and rejects missing or orphaned media', () => {
    const source = section(personal, 'enum NativeBackupLibraryValidation', 'struct NativeBackupDefaultsBeforeState');
    for (const name of ['NativeReadingDocument','NativeCinemaLocalItem','NativeCinemaRecent']) {
        assert.ok(source.includes('decoder.decode([' + name + '].self'), name);
    }
    assert.match(source, /Set\(documents\.map\(\\\.id\)\)\.count == documents\.count/);
    assert.match(source, /String\(pieces\[1\]\) == document\.id\.uuidString/);
    assert.match(source, /\(0\.\.\.100\)\.contains\(document\.lastPercent/);
    assert.match(source, /NativeMusicBackupValidation\.validate/);
    assert.match(source, /item\.storedName == item\.id\.uuidString \+ "\." \+ ext/);
    assert.equal((source.match(/expected == mediaPaths/g)||[]).length, 2);
    assert.doesNotMatch(source, /UserDefaults|copyItem|removeItem/);
});
test('music global restore validates stable track identities, locations and playlist references', () => {
    const source = music.slice(music.indexOf('enum NativeMusicBackupValidation'));
    assert.match(source, /decoder|JSONDecoder\(\)/);
    assert.match(source, /backup\.catalog\.version == 1, backup\.includesAudioFiles/);
    assert.match(source, /id == track\.id, track\.locations\.count == 1/);
    assert.match(source, /location\.remoteId == "audio\/" \+ id \+ "\." \+ ext/);
    assert.match(source, /expected == mediaPaths/);
    assert.match(source, /Set\(folder\.trackIds\)\.isSubset\(of: trackIDs\)/);
    assert.match(source, /Set\(playlist\.trackIds\)\.isSubset\(of: trackIDs\)/);
    assert.match(source, /trackIDs\.contains\(local\.uuidString\)/);
    assert.match(source, /NativeBackupReferencePolicy\.eligibleID\(remote\)/);
    assert.doesNotMatch(source, /UUID\(\)|copyItem|UserDefaults/);
});
test('streamed library metadata is bounded consistently on creation and restore', () => {
    assert.match(archive, /maximumLibraryMetadataBytes = 128 \* 1024 \* 1024/);
    assert.match(archive, /data\.count <= maximumLibraryMetadataBytes - libraryMetadataBytes/);
    assert.match(archive, /chunk\.count <= maximumLibraryMetadataBytes - metadataBytes/);
    assert.match(archive, /else if captureLibraryMetadata/);
    assert.match(archive, /else if !metadataOnly \{ mediaPaths\.insert\(entry\.path\) \}/);
    assert.match(archive, /NativeBackupLibraryValidation\.validate\(section: section, metadata: metadata, mediaPaths: mediaPaths\)/);
});

test('live personal restore adapters encode before applying and restore both persisted and observed state', () => {
    const podcast = read('NativePodcastLibrary.swift');
    const favorites = read('NativeFavorites.swift');
    const activity = read('NativeReadingActivity.swift');
    const youtube = read('NativeYouTubePersonalLibrary.swift');
    assert.match(podcast, /func prepareBackupRestore\(_ backup: NativePodcastBackupSnapshot/);
    assert.match(podcast, /let nextProgress = try encoder\.encode\(plan\.playbackProgress\)/);
    assert.match(podcast, /section: \.podcasts, apply:/);
    assert.match(podcast, /self\.playbackProgress = oldProgress/);
    assert.match(radio, /section: \.radio, apply: \{ defaults\.set\(next, forKey: key\) \}/);
    assert.match(radio, /rollback: \{ before\.restore\(\) \}/);
    assert.match(favorites, /self\.keys = old/);
    assert.match(activity, /self\.recentlyRead = oldHistory/);
    assert.match(youtube, /videoIDs\.insert\(\$0\.id\)\.inserted/);
    assert.match(youtube, /self\.videos = oldVideos/);
    assert.match(personal, /else \{ defaults\.removeObject\(forKey: key\) \}/);
    assert.match(personal, /NativeYouTubePersonalLibrary\.shared\.prepareBackupLibrary\(backup, recovery: recovery\)/);
});

test('restore validates scalar choices and voice profiles without overwriting existing settings', () => {
    assert.match(personal, /100 \+ NativeReaderSpeedOptions\.rates\.count/);
    assert.match(personal, /value\.pauseSeconds\.count == 5/);
    assert.match(personal, /value\.volume\.map/);
    assert.match(personal, /NativeAppLanguage\.codes\.indices\.contains\(value\)/);
    assert.match(personal, /if let current = defaults\.object\(forKey: key\)/);
    assert.match(personal, /else \{ updates\[key\] = value \}/);
    assert.match(personal, /key != "mi-musica-shuffle"/);
    assert.match(personal, /omittedKeys: omitted\.sorted\(\)/);
    assert.match(voiceProfiles, /storage != migratedKey/);
    assert.match(voiceProfiles, /defaults\.object\(forKey: storage\) == nil/);
    assert.match(voiceProfiles, /try JSONEncoder\(\)\.encode\(profile\)/);
});

test('preferences transaction exposes omissions and reverses every prepared component', () => {
    const source = personal.slice(personal.indexOf('enum NativeBackupPreferencesRestore'));
    assert.match(source, /NativeBackupPreferencesComponents\.prepare/);
    assert.match(source, /NativeBackupSettingsRestore\.prepare/);
    assert.match(source, /section: \.preferences, apply:/);
    assert.match(source, /for part in parts\.reversed\(\)/);
    assert.match(source, /if let firstError \{ throw firstError \}/);
    assert.match(source, /omittedKeys: settings\.omittedKeys/);
    assert.match(source, /historyNotImported: components\.readingPlan\.historyNotImported/);
});

test('verified archive staging writes only private paths and checks actual bytes and CRC', () => {
    const source = section(archive, 'static func stageForRestore(', 'static func verifyContentsForRestore(');
    assert.match(source, /try verifyContentsForRestore\(section: section, source: source\)/);
    assert.match(source, /fm\.temporaryDirectory/);
    assert.match(source, /try validatePath\(entry\.path\)/);
    assert.match(source, /written == entry\.uncompressedSize, crc == entry\.checksum/);
    assert.match(source, /if !finished \{ try\? fm\.removeItem\(at: staging\) \}/);
});
test('media restore steps preserve original IDs and reverse index and media changes', () => {
    const reading = section(reader, 'func prepareGlobalBackupRestore(', 'func createGlobalBackupArchive()');
    const audio = section(music, 'func prepareGlobalBackupRestore(', 'func createGlobalBackupArchive()');
    const movies = section(cinema, 'func prepareGlobalBackupRestore(', 'func createGlobalBackupArchive()');
    const disk = read('NativeBackupFileRestore.swift');
    assert.match(reading, /pendingFileImports\.isEmpty/);
    assert.match(reading, /!currentIDs\.contains\(\$0\.id\)/);
    assert.match(reading, /self\.documents = oldDocuments/);
    assert.match(audio, /trackIDs\.insert\(id\)\.inserted/);
    assert.match(audio, /additions\.append\(\.init\(id: id/);
    assert.match(audio, /orderedEntries: list\.orderedEntries/);
    assert.match(audio, /omitted\.append\(contentsOf: profilePlan\.omitted\)/);
    assert.doesNotMatch(audio, /UUID\(\)/);
    assert.match(movies, /!ids\.contains\(\$0\.id\)/);
    assert.match(movies, /historyPlan\.rollback/);
    assert.match(disk, /!fm\.fileExists\(atPath: item\.target\.path\)/);
    assert.match(disk, /attemptedIndexes\.reversed\(\)/);
    assert.match(disk, /if let firstError \{ throw firstError \}[\s\S]*?for target in moved\.reversed\(\)/);
});

test('local restore stages every archive before preparing six section steps and executing one transaction', () => {
    const source = coordinator.slice(coordinator.indexOf('func restoreLocalGeneration('));
    assert.match(source, /guard !backupOperationBusy, isManagingBackups, !requiresRecovery else \{ throw Failure\.busy \}/);
    assert.match(coordinator, /isCreating \|\| isRestoring \|\| isTransferringCloudBackup \|\| isRunningAutomaticBackup/);
    assert.match(source, /defer \{[\s\S]*?try checkRecovery\(\)[\s\S]*?isRestoring = false/);
    assert.match(source, /destination\.verifiedGeneration\(generation\)/);
    assert.match(source, /NativeBackupSectionArchive\.stageForRestore/);
    assert.match(source, /worker\.cancel\(\)/);
    assert.match(source, /for url in staged\.values/);
    assert.match(source, /Set\(staged\.keys\) == selected/);
    for (const name of ['reader','music','cinema','podcasts','radio','preferences']) {
        assert.ok(source.includes('case .' + name + ':'), name);
    }
    assert.match(source, /if previewOnly \{ return report \}/);
    assert.match(source, /guard approvedOmissions == omissions/);
    assert.match(source, /NativeBackupRestoreTransaction\.execute\(expected: selected, steps: steps\)/);
    assert.match(source, /guard liveStoresAreQuiescent\(\)/);
});

test('journal records before-state before applying live changes and is replayed before stores load', () => {
    const source = coordinator.slice(coordinator.indexOf('func restoreLocalGeneration('));
    const journal = read('NativeBackupRestoreJournal.swift');
    const payload = read('NativeBackupRecoveryPayload.swift');
    const app = read('TifloAcostaNativeApp.swift');
    assert.ok(source.indexOf('try journal.begin(') < source.indexOf('try NativeBackupRestoreTransaction.execute('));
    assert.match(source, /prepareGlobalBackupRestore\(staging: url, recovery: recovery\)/);
    assert.match(source, /prepareRestore\(staging: url, recovery: recovery\)/);
    assert.match(source, /downloadedIDs: ids, recovery: recovery/);
    assert.match(source, /NativeRadioBackupAdapter\.prepareBackupRestore\(snapshot, recovery: recovery\)/);
    assert.match(source, /NativeBackupPreferencesRestore\.prepare\(snapshot, favorites: favorites, activity: activity, recovery: recovery\)/);
    assert.match(payload, /allowedPath\(path, media: media\)/);
    assert.match(payload, /values\.isSymbolicLink == false/);
    assert.match(payload, /allowedKey\(item\.key\)/);
    assert.match(journal, /try handle\.synchronize\(\)/);
    assert.ok(app.indexOf('NativeBackupRestoreJournal.application.recover') < app.indexOf('NativeAppLanguage.initializeIfMissing()'));
    assert.match(app, /if recoveryFailed \|\| backups\.requiresRecovery \{/);
});

test('global music backup maps EQ to track identity and validates recovered profiles', () => {
    const player = read('NativeMusicPlayer.swift');
    assert.match(music, /profiles\[stableProfile\] = profile/);
    assert.match(music, /songNames\[\(location\.remoteId as NSString\)\.lastPathComponent\] = file\.fileName/);
    assert.match(music, /try profilePlan\.apply\(\)/);
    assert.match(music, /try profilePlan\.rollback\(\)/);
    assert.match(player, /profile\.gains\.count == 5/);
    assert.match(player, /playlistIDs\.contains\(id\)/);
    assert.match(player, /albumKeys\.contains/);
    assert.match(player, /defaults\.object\(forKey: target\) == nil/);
    assert.match(coordinator, /NativeRemotePlaybackOwner\.current == nil/);
    assert.match(coordinator, /NativeMusicBackupAdapter\.readyForRestore/);
    assert.match(archive, /expectedBytes > available/);
});

test('partial restore approval is specific to the reviewed omissions and includes excluded podcast references', () => {
    assert.match(coordinator, /case incompleteRestore\(RestoreReport\)/);
    assert.match(coordinator, /approvedOmissions: RestoreOmissionSummary\? = nil/);
    assert.match(coordinator, /let omissions = report\.omissionSummary/);
    assert.match(coordinator, /excludedPodcastReferences = snapshot\.excludedReferences/);
    assert.match(coordinator, /throw Failure\.incompleteRestore\(report\)/);
    assert.match(personal, /let playable = missing\.filter/);
    assert.match(personal, /\$0\.seconds <= \$0\.duration/);
});

test('iCloud transfer preserves local copies, verifies downloads and gates cloud permissions', () => {
    const cloud = read('NativeBackupCloudStore.swift');
    const transport = read('NativeBackupGenerationTransfer.swift');
    const store = read('NativeBackupGenerationStore.swift');
    assert.match(cloud, /fm\.url\(forUbiquityContainerIdentifier: Self\.containerIdentifier\)/);
    assert.match(cloud, /current\.isEqual\(session\.token\)/);
    assert.match(cloud, /fm\.setUbiquitous\(true, itemAt: staging, destinationURL: target\)/);
    assert.match(cloud, /ubiquitousItemIsUploaded != true/);
    assert.match(cloud, /ubiquitousItemHasUnresolvedConflicts == true/);
    assert.match(cloud, /startDownloadingUbiquitousItem/);
    assert.match(cloud, /try local\.adoptVerifiedStaging/);
    assert.match(transport, /written == item\.byteCount/);
    assert.match(transport, /NativeBackupManifest\.fingerprint/);
    assert.match(store, /guard existing == manifest/);
    assert.match(coordinator, /func uploadToICloud/);
    assert.match(coordinator, /func downloadFromICloud/);
    assert.match(read('App.entitlements'), /com\.apple\.developer\.ubiquity-container-identifiers/);
    assert.match(read('App.entitlements'), /CloudDocuments/);
});

test('cloud history distinguishes conflicts from pending transfer and import checks section schema before publication', () => {
    const cloud = read('NativeBackupCloudStore.swift');
    assert.match(cloud, /case pending, uploaded, conflicted, failed/);
    assert.match(cloud, /catch Failure\.conflict/);
    assert.match(cloud, /uploadState = \.failed/);
    assert.ok(cloud.indexOf('try validateSection(item.section') < cloud.indexOf('try local.adoptVerifiedStaging'));
    assert.match(coordinator, /importGeneration\(generation, local: local\) \{ section, url in/);
    assert.match(coordinator, /verifyContentsForRestore\(section: section, source: url\)/);
});

test('cloud history discovers remote-only generations and reports incomplete metadata gathering', () => {
    const cloud = read('NativeBackupCloudStore.swift');
    assert.match(cloud, /NSMetadataQueryUbiquitousDataScope/);
    assert.match(cloud, /NSMetadataQueryDidFinishGathering/);
    assert.match(cloud, /query\.disableUpdates\(\)/);
    assert.match(cloud, /query\.enableUpdates\(\)/);
    assert.match(cloud, /directory\.deletingLastPathComponent\(\)\.standardizedFileURL\.resolvingSymlinksInPath\(\)\.path == expected/);
    assert.match(cloud, /var ids = discovery\.ids/);
    assert.match(cloud, /initialMetadataGatheringComplete: discovery\.finished/);
});

test('local recovery journal is excluded from automatic device backup and protected on iOS', () => {
    const journal = read('NativeBackupRestoreJournal.swift');
    assert.match(journal, /values\.isExcludedFromBackup = true/);
    assert.match(journal, /FileProtectionType\.completeUntilFirstUserAuthentication/);
    assert.match(journal, /\.completeFileProtectionUntilFirstUserAuthentication/);
    assert.match(journal, /attributes\[\.type\] as\? FileAttributeType == \.typeDirectory/);
});
test('cloud download retries delayed metadata but preserves other errors and cancellation', () => {
    const cloud = read('NativeBackupCloudStore.swift');
    const download = section(cloud, 'private func download(', 'func importGeneration(');
    assert.match(download, /guard isMissing\(error\) else \{ throw error \}/);
    assert.match(download, /try check\(session\)/);
    assert.match(download, /clock\.now < deadline/);
    assert.match(download, /requested = false/);
});

test('automatic backup is opt-in, account-bound and resumes a reserved generation without automatic restoration', () => {
    const policy = read('NativeBackupSyncPolicy.swift');
    const cloud = read('NativeBackupCloudStore.swift');
    const run = section(coordinator, 'func runAutomaticBackupIfDue(', 'func synchronizedHistory(');
    assert.match(policy, /if let pending \{ return \.resume\(pending\) \}/);
    assert.match(policy, /values\.isExcludedFromBackup = true/);
    assert.match(cloud, /BackupAutomationAuthorizations-v1/);
    assert.match(cloud, /requireAutomaticAuthorization\(automaticAuthorization, session: session\)/);
    assert.match(run, /guard var policy = try automaticStore\.load\(\) else \{ return \.disabled \}/);
    assert.ok(run.indexOf('try automaticStore.save(policy)') < run.indexOf('createGeneration(sections:'));
    assert.match(run, /local\.hasGeneration\(generation\)/);
    assert.match(run, /if uploaded == \.uploaded/);
    assert.doesNotMatch(run, /restoreLocalGeneration|removeItem/);
    assert.match(coordinator, /func disableAutomaticBackups/);
    assert.match(coordinator, /isRunningAutomaticBackup/);
});
test('merged cloud history flags mismatching manifests and only proposes safe retention candidates', () => {
    const policy = read('NativeBackupSyncPolicy.swift');
    assert.match(policy, /here != there\?\.manifest/);
    assert.match(policy, /guard remoteHistoryComplete, keepPerSection >= 1/);
    assert.match(policy, /protected\.formUnion\(local\.prefix\(keepPerSection\)/);
    assert.match(policy, /entry\.availability == \.both/);
    assert.match(coordinator, /NativeBackupSyncPolicy\.history\(local: here, remote: remote\)/);
});

test('restore reports all preserved overlapping identities and scopes approval to one generation', () => {
    const recovery = read('NativeBackupRecoveryPayload.swift');
    assert.match(recovery, /struct NativeBackupPreservedIdentity: Hashable/);
    assert.match(recovery, /SHA256\.hash\(data: Data\(identifier\.utf8\)\)/);
    assert.match(coordinator, /generation: manifest\.generation, preservedExisting: preservedExisting/);
    assert.match(coordinator, /preservedExisting: recovery\.preservedIdentities/);
    assert.match(coordinator, /!preservedExisting\.isEmpty/);
    for (const [file, section] of [
        ['NativeTifloLector.swift', 'reader'], ['NativeMyMusic.swift', 'music'],
        ['NativeAccessibleCinemaLibrary.swift', 'cinema'], ['NativePodcastLibrary.swift', 'podcasts'],
        ['NativeRadioBrowser.swift', 'radio'], ['NativeBackupPersonalData.swift', 'preferences']
    ]) {
        assert.ok(read(file).includes('recordPreserved(section: "' + section + '"'), file);
    }
});

test('automatic backup keeps local recovery independent of cloud and defers on low power', () => {
    const run = section(coordinator, 'func runAutomaticBackupIfDue(', 'func synchronizedHistory(');
    const merged = section(coordinator, 'func synchronizedHistory(', 'func iCloudHistory(');
    assert.match(run, /!ProcessInfo\.processInfo\.isLowPowerModeEnabled/);
    assert.ok(run.indexOf('createGeneration(sections:') < run.indexOf('uploadGeneration(generation:'));
    assert.doesNotMatch(run, /verifyAutomaticAuthorization/);
    assert.match(merged, /remote: \[\]/);
    assert.match(merged, /initialMetadataGatheringComplete: false, localSpaceCandidates: \[\], cloudError: error/);
    assert.match(coordinator, /replacePending: Bool = false/);
    assert.match(coordinator, /throw Failure\.pendingAutomaticBackup/);
});

test('restore preview requires a management session and exact explicit approval even without omissions', () => {
    const source = coordinator.slice(coordinator.indexOf('func restoreLocalGeneration('));
    assert.match(source, /previewOnly: Bool = true/);
    assert.ok(source.indexOf('if previewOnly { return report }') < source.indexOf('try journal.begin('));
    assert.match(source, /guard approvedOmissions == omissions/);
    assert.match(source, /isManagingBackups, !requiresRecovery/);
    assert.match(coordinator, /var blocksExternalActions: Bool/);
    const home = read('NativeScreens.swift');
    assert.match(home, /guard !backups\.blocksExternalActions else \{ return \}/);
    assert.match(home, /task\(id: automaticBackupEligible\)/);
    assert.match(home, /canCollectSnapshot: \{ automaticBackupEligible && !Task\.isCancelled \}/);
});

test('native backup management keeps one route, separate local/cloud operations and reversible preview', () => {
    const settings = read('NativeUpdatesSettings.swift');
    const ui = read('NativeBackupManagementScreen.swift');
    assert.match(settings, /backups\.beginManagement\(\)/);
    assert.match(settings, /fullScreenCover\(isPresented: \$showBackups, onDismiss: \{ backups\.endManagement\(\) \}/);
    assert.match(ui, /Toggle\(LocalizedStringKey\(section\.backupLabel\)/);
    assert.match(ui, /backups\.create\(sections: selected/);
    assert.match(ui, /backups\.downloadFromICloud/);
    assert.match(ui, /approvedOmissions: approved, previewOnly: approved == nil/);
    assert.match(ui, /approved: report\.omissionSummary/);
    assert.match(ui, /confirmation = \.restore/);
    assert.match(ui, /@AccessibilityFocusState/);
    assert.match(ui, /UIAccessibility\.post\(notification: \.announcement/);
    assert.match(ui, /Button\("Cancelar operación", role: \.cancel\) \{ job\?\.cancel\(\) \}/);
    assert.match(ui, /interactiveDismissDisabled\(busy\)/);
    assert.match(ui, /if metadataComplete && !cloudUnavailable/);
    assert.match(ui, /entries = NativeBackupSyncPolicy\.history\(local: local, remote: \[\]\)/);
    assert.doesNotMatch(ui, /removeItem|deleteGeneration|restoreAutomatically/);
});
test('all dynamic backup labels and confirmation text exist in five non-Spanish catalogs', () => {
    const ui = read('NativeBackupManagementScreen.swift');
    const keys = new Set([...ui.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)]
        .map(m => m[1]).filter(x => x.trim() && x !== ', ' && !x.startsWith('tiflo.')));
    for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
        const dict = read(language + '.lproj/Localizable.strings');
        const missing = [...keys].filter(key => !dict.includes('"' + key + '" ='));
        assert.deepEqual(missing, [], language + ': backup keys missing');
    }
});

test('backup collection rechecks the live-store and foreground gates at each archive boundary', () => {
    const source = section(coordinator, 'private func createGeneration(', 'func history(');
    const gate = section(source, 'func checkCollection()', '        if sections.contains(.reader)');
    assert.match(gate, /try Task\.checkCancellation\(\)/);
    assert.match(gate, /guard canCollectSnapshot\(\), NativeRemotePlaybackOwner\.current == nil/);
    assert.match(gate, /reader\.readyForGlobalRestore, NativeMusicBackupAdapter\.readyForRestore/);
    assert.match(gate, /podcastDownloads\?\.downloadingID == nil/);
    const boundaries = source.match(/try checkCollection\(\)/g) || [];
    assert.equal(boundaries.length, 7);
    assert.ok(source.lastIndexOf('try checkCollection()') < source.indexOf('destination.publish('));
    assert.match(source, /defer \{[\s\S]*?removeItem\(at: archive\.deletingLastPathComponent\(\)\)/);
    const ui = read('NativeBackupManagementScreen.swift');
    assert.match(ui, /canCollectSnapshot: \{ canCollect && !Task\.isCancelled \}/);
    assert.match(ui, /if cloud \{\s*try Task\.checkCancellation\(\)\s*guard canCollect/);
    const automatic = section(coordinator, 'func runAutomaticBackupIfDue(', 'func synchronizedHistory(');
    assert.match(automatic, /canCollectSnapshot: \{ canCollectSnapshot\(\) && !ProcessInfo\.processInfo\.isLowPowerModeEnabled \}/);
});
