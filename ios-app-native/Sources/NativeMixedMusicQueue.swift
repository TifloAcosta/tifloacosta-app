import SwiftUI

/// Ordered playlist coordinator. Provider completion signals are connected separately.
@MainActor
final class NativeMixedMusicQueue: ObservableObject {
    static let shared = NativeMixedMusicQueue()

    @Published private(set) var entries: [MusicPlaylistEntry] = []
    @Published private(set) var currentIndex = -1
    @Published var error: String?

    private var localURLs: [UUID: URL] = [:]
    private var playlistID: UUID?
    private var playbackGeneration = 0
    private var pendingRemoteTask: Task<Void, Never>?

    func play(entries: [MusicPlaylistEntry], playlistID: UUID, localURLs: [UUID: URL]) {
        stopPlaying()
        self.entries = entries
        self.playlistID = playlistID
        self.localURLs = localURLs
        currentIndex = 0
        error = nil
        playCurrent()
    }

    func next() {
        guard !entries.isEmpty else { return }
        stopPlaying()
        currentIndex += 1
        playCurrent()
    }

    func previous() {
        guard !entries.isEmpty else { return }
        stopPlaying()
        currentIndex = max(0, currentIndex - 1)
        playCurrent()
    }

    func stop() {
        stopPlaying()
        entries = []
        localURLs = [:]
        playlistID = nil
        currentIndex = -1
    }

    private func stopPlaying() {
        playbackGeneration += 1
        pendingRemoteTask?.cancel()
        pendingRemoteTask = nil
        NativeMusicPlayer.shared.onPlaybackFinished = nil
        NativeAppleMusicPlayer.shared.onPlaybackFinished = nil
        NativeAudiusPlayer.shared.onPlaybackFinished = nil
        NativeJamendoPlayer.shared.onPlaybackFinished = nil
        NativeMusicPlayer.shared.stop()
        NativeAppleMusicPlayer.shared.stop()
        NativeAudiusPlayer.shared.stop()
        NativeJamendoPlayer.shared.stop()
    }

    func finishedNaturally(generation: Int) {
        guard generation == playbackGeneration else { return }
        next()
    }

    private func playCurrent() {
        while entries.indices.contains(currentIndex) {
            let entry = entries[currentIndex]
            let generation = playbackGeneration
            let finished: () -> Void = { [weak self] in
                self?.finishedNaturally(generation: generation)
            }
            switch entry.provider {
            case .local:
                guard let id = entry.localId, let url = localURLs[id],
                      FileManager.default.fileExists(atPath: url.path) else {
                    error = MusicLocalized.format("Esta canción ya no está disponible. Se conserva en tu lista.")
                    currentIndex += 1
                    continue
                }
                NativeMusicPlayer.shared.onPlaybackFinished = finished
                NativeMusicPlayer.shared.play(name: entry.title, url: url,
                    queue: [(name: entry.title, url: url)], playlistID: playlistID)
            case .appleMusic:
                guard let remoteID = entry.appleMusicSongId, !remoteID.isEmpty else {
                    currentIndex += 1
                    continue
                }
                NativeAppleMusicPlayer.shared.onPlaybackFinished = finished
                pendingRemoteTask = Task { @MainActor in
                    guard generation == playbackGeneration else { return }
                    let played = await NativeAppleMusicPlayer.shared.playSaved(id: remoteID, title: entry.title)
                    if !played && generation == playbackGeneration {
                        error = MusicLocalized.format("Esta canción no se pudo reproducir. Se conserva en tu lista.")
                        next()
                    }
                }
            case .audius:
                guard let remoteID = entry.appleMusicSongId, !remoteID.isEmpty else {
                    currentIndex += 1
                    continue
                }
                NativeAudiusPlayer.shared.onPlaybackFinished = finished
                let played = NativeAudiusPlayer.shared.play(id: remoteID, title: entry.title)
                if !played {
                    error = MusicLocalized.format("Esta canción no se pudo reproducir. Se conserva en tu lista.")
                    currentIndex += 1
                    continue
                }
            case .jamendo:
                guard let remoteID = entry.appleMusicSongId, !remoteID.isEmpty else {
                    currentIndex += 1
                    continue
                }
                NativeJamendoPlayer.shared.onPlaybackFinished = finished
                pendingRemoteTask = Task { @MainActor in
                    guard generation == playbackGeneration else { return }
                    let played = await NativeJamendoPlayer.shared.playSaved(id: remoteID)
                    if !played && generation == playbackGeneration {
                        error = MusicLocalized.format("Esta canción no se pudo reproducir. Se conserva en tu lista.")
                        next()
                    }
                }
            }
            return
        }
        stop()
    }
}
