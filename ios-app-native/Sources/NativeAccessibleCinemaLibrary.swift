import Foundation
import SwiftUI
import AVFoundation
import MediaPlayer
import UniformTypeIdentifiers

/// Files added by the user for private playback. No third-party audiovisual
/// catalogue is copied or redistributed by the app.
struct NativeCinemaLocalItem: Codable, Hashable, Identifiable {
    let id: UUID
    let title: String
    let storedName: String
    let language: AccessibleCinemaLanguage
    let kind: AccessibleCinemaKind
    var lastSeconds: Double
    let importedAt: Date

    /// Video and audio share playback progress but only video needs a layer.
    var isVideoFile: Bool {
        ["mp4", "m4v", "mov"].contains(
            URL(fileURLWithPath: storedName).pathExtension.lowercased())
    }
}

enum NativeCinemaLocalError: LocalizedError {
    case unsupported
    case oversized
    case missing
    case invalidFile

    var errorDescription: String? {
        switch self {
        case .unsupported: MusicLocalized.message("Elige un archivo de audio o vídeo compatible.")
        case .oversized: MusicLocalized.message("El archivo supera el tamaño máximo permitido de 2 GB.")
        case .missing: MusicLocalized.message("El archivo ya no está disponible en la biblioteca.")
        case .invalidFile: MusicLocalized.message("No se puede importar este archivo.")
        }
    }
}

/// Metadata is stored independently of TifloLector and Mi música.
/// Audio is copied only after a file is explicitly chosen through Files.
@MainActor
final class NativeCinemaLocalLibrary: ObservableObject {
    static let shared = NativeCinemaLocalLibrary()
    @Published private(set) var items: [NativeCinemaLocalItem] = []

    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TifloCinemaPersonal", isDirectory: true)
    }
    private static var indexURL: URL {
        directory.appendingPathComponent("catalogo-personal.json")
    }
    private static let allowedExtensions: Set<String> = [
        "mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf",
        "flac", "mp4", "m4v", "mov"
    ]
    private static let maximumFileSize: Int64 = 2_000_000_000

    init() {
        try? FileManager.default.createDirectory(
            at: Self.directory, withIntermediateDirectories: true)
        if let bytes = try? Data(contentsOf: Self.indexURL),
           let saved = try? JSONDecoder().decode([NativeCinemaLocalItem].self, from: bytes) {
            items = saved.filter {
                FileManager.default.fileExists(
                    atPath: Self.directory.appendingPathComponent($0.storedName).path)
            }
        }
    }

    func fileURL(for item: NativeCinemaLocalItem) -> URL? {
        let url = Self.directory.appendingPathComponent(item.storedName)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    @discardableResult
    func importAudio(from url: URL, language: AccessibleCinemaLanguage,
                     kind: AccessibleCinemaKind) throws -> NativeCinemaLocalItem {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let ext = url.pathExtension.lowercased()
        guard Self.allowedExtensions.contains(ext) else {
            throw NativeCinemaLocalError.unsupported
        }
        let properties = try url.resourceValues(
            forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard properties.isRegularFile == true, properties.isSymbolicLink != true else {
            throw NativeCinemaLocalError.invalidFile
        }
        if Int64(properties.fileSize ?? 0) > Self.maximumFileSize {
            throw NativeCinemaLocalError.oversized
        }

        let id = UUID()
        let filename = id.uuidString + "." + ext
        let destination = Self.directory.appendingPathComponent(filename)
        try FileManager.default.copyItem(at: url, to: destination)

        let item = NativeCinemaLocalItem(
            id: id,
            title: url.deletingPathExtension().lastPathComponent,
            storedName: filename,
            language: language,
            kind: kind,
            lastSeconds: 0,
            importedAt: .now
        )
        do {
            try persist(items + [item])
            items.append(item)
            return item
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
    }

    func savePosition(_ seconds: Double, for id: UUID) {
        guard seconds.isFinite, seconds >= 0,
              let index = items.firstIndex(where: { $0.id == id }),
              items[index].lastSeconds != seconds else { return }
        // The caller already batches periodic saves. Forced pause/close saves
        // must retain fractional seconds rather than losing up to 0.99 s.
        var updated = items
        updated[index].lastSeconds = seconds
        guard (try? persist(updated)) != nil else { return }
        items = updated
    }

    func remove(_ item: NativeCinemaLocalItem) throws {
        let updated = items.filter { $0.id != item.id }
        try persist(updated)
        items = updated
        let url = Self.directory.appendingPathComponent(item.storedName)
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }

    private func persist(_ values: [NativeCinemaLocalItem]) throws {
        let bytes = try JSONEncoder().encode(values)
        try bytes.write(to: Self.indexURL, options: .atomic)
    }
}

/// One private player for Multicines. It never changes VoiceOver speech rate,
/// hardware volume, Mi música or TifloLector reading position.
@MainActor
final class NativeCinemaAudioPlayer: ObservableObject {
    static let shared = NativeCinemaAudioPlayer()
    @Published private(set) var currentID: UUID?
    /// Distinguish a temporary Drive preview from a permanently imported item.
    @Published private(set) var currentCloudReference: String?
    @Published private(set) var currentCloudIsVideo = false
    @Published private(set) var playing = false
    @Published private(set) var seconds: Double = 0
    @Published private(set) var duration: Double = 0
    @Published private(set) var playbackError: String?

    private var player: AVPlayer?
    private var temporaryPlaybackFile: URL?
    private var publicDriveLoader: NativeCinemaDriveResourceLoader?
    private var audiocinematecaLoader: NativeAudiocinematecaResourceLoader?
    /// Expose the same AVPlayer to the native video surface without creating
    /// a second, competing playback engine or duplicate transport controls.
    var videoPlayer: AVPlayer? { player }
    private var lastSavedSecond: Double = -10
    private weak var activeLibrary: NativeCinemaLocalLibrary?
    @Published private(set) var currentTitle = ""
    @Published private(set) var buffering = false
    private var pendingRestore: Double?
    private var seekToken: UUID?
    private var endObserver: NSObjectProtocol?
    private var historyTitle = ""
    private var completed = false
    private var movieQueue: [NativePodcastEpisode] = []
    private var movieWorkTitle = ""
    private var remoteCommandTokens: [Any] = []
    private var progressTimer: Timer?

    func open(_ item: NativeCinemaLocalItem, library: NativeCinemaLocalLibrary) throws {
        guard let url = library.fileURL(for: item) else {
            throw NativeCinemaLocalError.missing
        }
        pauseAndSave(library: library)
        currentCloudReference = nil
        currentCloudIsVideo = false
        playbackError = nil
        // If session activation fails, do not leave a half-open item with
        // playback state advertised as ready.
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try AVAudioSession.sharedInstance().setActive(true)
        player = AVPlayer(url: url)
        activeLibrary = library
        currentTitle = item.title
        currentID = item.id
        currentCloudIsVideo = item.isVideoFile
        historyTitle = item.title
        let restored = max(0, item.lastSeconds)
        seconds = restored
        duration = 0
        lastSavedSecond = restored
        pendingRestore = restored > 0 ? restored : nil
        NativeRemotePlaybackOwner.onInterrupted(.cinema) { [weak self] in
            self?.pauseForOtherAudio()
        }
        NativeRemotePlaybackOwner.claim(.cinema)
        registerRemoteCommands()
        playing = true
        buffering = true
        if pendingRestore == nil { player?.play() }
        beginProgressTracking(library: library)
        NativeCinemaRecentStore.shared.allow(key: historyKey)
        save(library: library, force: true)
        updateNowPlaying()
    }

    /// Plays one deliberately selected cloud file after a temporary download.
    /// This does NOT add it to the user's personal collection or promise
    /// streaming before the download finishes. Existing remote controls,
    /// background audio, seek and pause are reused.
    func openTemporaryFile(
        _ file: URL,
        title: String,
        reference: String,
        library: NativeCinemaLocalLibrary
    ) throws {
        let temporaryRoot = FileManager.default.temporaryDirectory.standardizedFileURL
        let parent = file.standardizedFileURL.deletingLastPathComponent()
        guard file.isFileURL, !reference.isEmpty,
              parent.deletingLastPathComponent().standardizedFileURL == temporaryRoot,
              FileManager.default.fileExists(atPath: file.path) else {
            throw NativeCinemaLocalError.invalidFile
        }
        pauseAndSave(library: library)
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try AVAudioSession.sharedInstance().setActive(true)
        player = AVPlayer(url: file)
        temporaryPlaybackFile = file
        activeLibrary = library
        playbackError = nil
        currentTitle = title
        currentID = UUID()
        currentCloudReference = reference
        historyTitle = title
        currentCloudIsVideo = ["mp4", "m4v", "mov"].contains(file.pathExtension.lowercased())
        let restored = max(0, UserDefaults.standard.double(forKey: "cinema.cloud.position." + reference))
        seconds = restored
        duration = 0
        lastSavedSecond = restored
        pendingRestore = restored > 0 ? restored : nil
        NativeRemotePlaybackOwner.onInterrupted(.cinema) { [weak self] in
            self?.pauseForOtherAudio()
        }
        NativeRemotePlaybackOwner.claim(.cinema)
        registerRemoteCommands()
        playing = true
        buffering = true
        if pendingRestore == nil { player?.play() }
        beginProgressTracking(library: library)
        NativeCinemaRecentStore.shared.allow(key: historyKey)
        save(library: library, force: true)
        updateNowPlaying()
    }

    /// Streams an explicitly selected public Drive work with AVFoundation's
    /// supported custom-scheme resource loader. It can send the required iOS
    /// bundle and resource-key HTTP headers, unlike an unconfigured AVPlayer URL.
    func openPublicStream(
        asset: AVURLAsset,
        loader: NativeCinemaDriveResourceLoader,
        title: String,
        reference: String,
        isVideo: Bool,
        library: NativeCinemaLocalLibrary
    ) throws {
        guard !reference.isEmpty, NativeCinemaPublicDrive.configuredKey != nil else {
            throw NativeCinemaPublicDriveError.denied
        }
        pauseAndSave(library: library)
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try AVAudioSession.sharedInstance().setActive(true)
        publicDriveLoader = loader
        player = AVPlayer(playerItem: AVPlayerItem(asset: asset))
        activeLibrary = library
        playbackError = nil
        currentTitle = title
        currentID = UUID()
        currentCloudReference = reference
        historyTitle = title
        currentCloudIsVideo = isVideo
        let restored = max(0, UserDefaults.standard.double(
            forKey: "cinema.cloud.position." + reference))
        seconds = restored
        duration = 0
        lastSavedSecond = restored
        pendingRestore = restored > 0 ? restored : nil
        NativeRemotePlaybackOwner.onInterrupted(.cinema) { [weak self] in
            self?.pauseForOtherAudio()
        }
        NativeRemotePlaybackOwner.claim(.cinema)
        registerRemoteCommands()
        playing = true
        buffering = true
        if pendingRestore == nil { player?.play() }
        beginProgressTracking(library: library)
        NativeCinemaRecentStore.shared.allow(key: historyKey)
        save(library: library, force: true)
        updateNowPlaying()
    }

    func openAudiocinematecaStream(
        asset: AVURLAsset,
        loader: NativeAudiocinematecaResourceLoader,
        title: String,
        reference: String,
        isVideo: Bool,
        library: NativeCinemaLocalLibrary
    ) throws {
        guard reference.hasPrefix("audiocinemateca:") else {
            throw NativeAudiocinematecaCatalogueError.denied
        }
        try openAuthorizedCinemaStream(asset: asset, loader: loader, title: title, reference: reference,
                                       isVideo: isVideo, library: library)
    }

    func openTapeTerritory(_ url: URL, title: String, slug: String, library: NativeCinemaLocalLibrary) throws {
        try openAuthorizedCinemaStream(asset: AVURLAsset(url: url), loader: nil, title: title,
                                       reference: "tape-territory:" + slug, isVideo: true, library: library)
    }

    private func openAuthorizedCinemaStream(asset: AVURLAsset, loader: NativeAudiocinematecaResourceLoader?,
                                            title: String, reference: String, isVideo: Bool,
                                            library: NativeCinemaLocalLibrary) throws {
        pauseAndSave(library: library)
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
        try AVAudioSession.sharedInstance().setActive(true)
        audiocinematecaLoader = loader
        player = AVPlayer(playerItem: AVPlayerItem(asset: asset))
        activeLibrary = library
        playbackError = nil
        currentTitle = title
        currentID = UUID()
        currentCloudReference = reference
        historyTitle = title
        currentCloudIsVideo = isVideo
        let restored = max(0, UserDefaults.standard.double(
            forKey: "cinema.cloud.position." + reference))
        seconds = restored
        duration = 0
        lastSavedSecond = restored
        pendingRestore = restored > 0 ? restored : nil
        NativeRemotePlaybackOwner.onInterrupted(.cinema) { [weak self] in
            self?.pauseForOtherAudio()
        }
        NativeRemotePlaybackOwner.claim(.cinema)
        registerRemoteCommands()
        playing = true
        buffering = true
        if pendingRestore == nil { player?.play() }
        beginProgressTracking(library: library)
        NativeCinemaRecentStore.shared.allow(key: historyKey)
        save(library: library, force: true)
        updateNowPlaying()
    }

    func setRecoveryTitle(_ title: String, library: NativeCinemaLocalLibrary) {
        historyTitle = title
        save(library: library, force: true)
    }

    func openMoviePart(_ part: NativePodcastEpisode, workTitle: String,
                       followedBy remaining: [NativePodcastEpisode], library: NativeCinemaLocalLibrary,
                       previousPosition: Double = 0) throws {
        guard part.audioURL.scheme == "https", part.audioURL.host != nil,
              part.audioURL.user == nil, part.audioURL.password == nil else { throw NativeCinemaLocalError.invalidFile }
        let reference = "movies-for-the-blind:" + NativeCinemaRecent.digest(part.id)
        if UserDefaults.standard.object(forKey: "cinema.cloud.position." + reference) == nil,
           previousPosition.isFinite && previousPosition > 0 {
            UserDefaults.standard.set(previousPosition, forKey: "cinema.cloud.position." + reference)
        }
        try openAuthorizedCinemaStream(asset: AVURLAsset(url: part.audioURL), loader: nil,
            title: part.title, reference: reference, isVideo: false, library: library)
        movieQueue = remaining
        movieWorkTitle = workTitle
        setRecoveryTitle(workTitle, library: library)
    }

    private func cleanUpTemporaryPlayback() {
        guard let file = temporaryPlaybackFile else { return }
        temporaryPlaybackFile = nil
        // Storage always writes into a UUID directory directly below tmp.
        // Never delete a different folder supplied through an arbitrary URL.
        let folder = file.standardizedFileURL.deletingLastPathComponent()
        if folder.deletingLastPathComponent() == FileManager.default.temporaryDirectory.standardizedFileURL {
            try? FileManager.default.removeItem(at: folder)
        }
    }

    private func beginProgressTracking(library: NativeCinemaLocalLibrary) {
        progressTimer?.invalidate()
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let item = player?.currentItem {
            endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime,
                object: item, queue: .main) { [weak self, weak library] _ in
                Task { @MainActor [weak self, weak library] in
                    guard let self, let library, self.player?.currentItem === item,
                          self.playing, NativeRemotePlaybackOwner.current == .cinema else { return }
                    self.finished(library: library)
                }
            }
        }
        progressTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) {
            [weak self, weak library] _ in
            Task { @MainActor [weak self, weak library] in
                guard let self, let library, self.currentID != nil else { return }
                // Keep the saved position current even after leaving Multicines.
                self.refresh(library: library)
            }
        }
    }

    func toggle(library: NativeCinemaLocalLibrary) {
        guard let player else { return }
        if playing {
            refresh(library: library)
            player.pause()
            playing = false
            buffering = false
            save(library: library, force: true)
        } else {
            guard playbackError == nil else { return }
            NativeRemotePlaybackOwner.claim(.cinema)
            registerRemoteCommands()
            completed = false
            playing = true
            buffering = true
            if pendingRestore == nil && seekToken == nil { player.play() }
        }
        updateNowPlaying()
    }

    func seek(by delta: Double, library: NativeCinemaLocalLibrary) {
        guard let player, playbackError == nil, player.currentItem?.status == .readyToPlay,
              pendingRestore == nil, seekToken == nil else { return }
        guard let next = NativeCinemaRules.seekTarget(position: seconds, delta: delta, duration: duration) else { return }
        completed = false
        performSeek(next, library: library)
    }

    private func performSeek(_ target: Double, library: NativeCinemaLocalLibrary) {
        guard let player else { return }
        let token = UUID()
        seekToken = token
        player.seek(to: CMTime(seconds: target, preferredTimescale: 600),
                    toleranceBefore: .zero, toleranceAfter: .zero) { [weak self, weak library] success in
            Task { @MainActor [weak self, weak library] in
                guard let self, let library, self.seekToken == token, self.player === player else { return }
                self.seekToken = nil
                if success {
                    let actual = player.currentTime().seconds
                    if self.completed { self.seconds = 0 }
                    else if actual.isFinite && actual >= 0 { self.seconds = actual }
                    self.save(library: library, force: true)
                    if self.playing && NativeRemotePlaybackOwner.current == .cinema { player.play() }
                } else {
                    self.playing = false
                    self.buffering = false
                    player.pause()
                    self.playbackError = MusicLocalized.message("No se pudo recuperar la posición de reproducción.")
                    self.unregisterRemoteCommands()
                    NativeRemotePlaybackOwner.release(.cinema)
                }
                self.updateNowPlaying()
            }
        }
    }

    func refresh(library: NativeCinemaLocalLibrary) {
        guard let player, playbackError == nil else { return }
        if player.currentItem?.status == .failed || player.error != nil {
            player.pause()
            playing = false
            buffering = false
            playbackError = MusicLocalized.message(
                "No se pudo reproducir este archivo. Comprueba que el formato es compatible.")
            save(library: library, force: true)
            unregisterRemoteCommands()
            NativeRemotePlaybackOwner.release(.cinema)
            return
        }
        let length = player.currentItem?.duration.seconds ?? 0
        if length.isFinite && length > 0 { duration = length }
        if let restored = pendingRestore, player.currentItem?.status == .readyToPlay {
            pendingRestore = nil
            performSeek(duration > 0 ? min(restored, duration) : restored, library: library)
        }
        buffering = playing && (pendingRestore != nil || seekToken != nil ||
            player.timeControlStatus == .waitingToPlayAtSpecifiedRate || player.currentItem?.status != .readyToPlay)
        if !completed && pendingRestore == nil && seekToken == nil && player.currentItem?.status == .readyToPlay {
            let elapsed = player.currentTime().seconds
            if elapsed.isFinite && elapsed >= 0 { seconds = elapsed }
            save(library: library, force: false)
        }
        updateNowPlaying()
    }

    private func finished(library: NativeCinemaLocalLibrary) {
        guard let player else { return }
        let remaining = movieQueue
        let work = movieWorkTitle
        player.pause()
        playing = false
        buffering = false
        seekToken = nil
        pendingRestore = nil
        seconds = 0
        completed = true
        save(library: library, force: true)
        NativeCinemaRecentStore.shared.markFinished(key: historyKey)
        if let next = remaining.first {
            do {
                try openMoviePart(next, workTitle: work, followedBy: Array(remaining.dropFirst()), library: library)
            } catch { playbackError = error.localizedDescription }
        } else {
            performSeek(0, library: library)
        }
        updateNowPlaying()
    }

    func pauseForOtherAudio() {
        guard playing else { return }
        if let activeLibrary { refresh(library: activeLibrary) }
        player?.pause()
        playing = false
        buffering = false
        if let activeLibrary { save(library: activeLibrary, force: true) }
        updateNowPlaying()
    }

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .cinema, !currentTitle.isEmpty else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: currentTitle,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: seconds,
            MPNowPlayingInfoPropertyPlaybackRate: playing && !buffering ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteCommandTokens.isEmpty else { return }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        let commands = MPRemoteCommandCenter.shared()
        let play = commands.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .cinema,
                      let self, !self.playing, let library = self.activeLibrary else { return }
                self.toggle(library: library)
            }
            return .success
        }
        let pause = commands.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .cinema,
                      let self, self.playing, let library = self.activeLibrary else { return }
                self.toggle(library: library)
            }
            return .success
        }
        let toggle = commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .cinema,
                      let self, let library = self.activeLibrary else { return }
                self.toggle(library: library)
            }
            return .success
        }
        remoteCommandTokens = [play, pause, toggle]
    }

    private func unregisterRemoteCommands() {
        guard remoteCommandTokens.count == 3 else { return }
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.removeTarget(remoteCommandTokens[0])
        commands.pauseCommand.removeTarget(remoteCommandTokens[1])
        commands.togglePlayPauseCommand.removeTarget(remoteCommandTokens[2])
        remoteCommandTokens = []
    }

    func pauseAndSave(library: NativeCinemaLocalLibrary) {
        refresh(library: library)
        save(library: library, force: true)
        player?.pause()
        progressTimer?.invalidate()
        progressTimer = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver); self.endObserver = nil }
        seekToken = nil
        pendingRestore = nil
        buffering = false
        completed = false
        movieQueue = []
        movieWorkTitle = ""
        player = nil
        publicDriveLoader?.cancel()
        publicDriveLoader = nil
        audiocinematecaLoader?.cancel()
        audiocinematecaLoader = nil
        cleanUpTemporaryPlayback()
        playing = false
        currentID = nil
        currentCloudReference = nil
        currentCloudIsVideo = false
        seconds = 0
        duration = 0
        currentTitle = ""
        historyTitle = ""
        activeLibrary = nil
        playbackError = nil
        unregisterRemoteCommands()
        NativeRemotePlaybackOwner.release(.cinema)
    }

    private var historyKey: String { currentCloudReference.map(NativeCinemaRecent.digest) ?? currentID?.uuidString ?? "" }

    private func save(library: NativeCinemaLocalLibrary, force: Bool) {
        guard let currentID else { return }
        if force || abs(seconds - lastSavedSecond) >= 5 {
            if let reference = currentCloudReference {
                UserDefaults.standard.set(seconds, forKey: "cinema.cloud.position." + reference)
            } else {
                library.savePosition(seconds, for: currentID)
            }
            lastSavedSecond = seconds
            if !historyTitle.isEmpty && !completed {
                let source = currentCloudReference.map(NativeCinemaRecent.source) ?? "personal"
                NativeCinemaRecentStore.shared.remember(key: historyKey, source: source, title: historyTitle, seconds: seconds, duration: duration)
            }
        }
    }
}
