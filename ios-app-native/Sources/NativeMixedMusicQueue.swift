import SwiftUI

/// Ordered playlist coordinator. Provider completion signals are connected separately.
@MainActor
final class NativeMixedMusicQueue: ObservableObject {
    static let shared = NativeMixedMusicQueue()

    @Published private(set) var entries: [MusicPlaylistEntry] = []
    @Published private(set) var currentIndex = -1
    @Published var error: String?

    private var localURLs: [UUID: URL] = [:]
    private var playbackGeneration = 0

    func play(entries: [MusicPlaylistEntry], localURLs: [UUID: URL]) {
        stopPlaying()
        self.entries = entries
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
        currentIndex = -1
    }

    private func stopPlaying() {
        playbackGeneration += 1
        NativeMusicPlayer.shared.stop()
        NativeAppleMusicPlayer.shared.stop()
        NativeAudiusPlayer.shared.stop()
        NativeJamendoPlayer.shared.stop()
    }

    private func playCurrent() {
        guard entries.indices.contains(currentIndex) else {
            stop()
            return
        }
        let entry = entries[currentIndex]
        let generation = playbackGeneration
        switch entry.provider {
        case .local:
            guard let id = entry.localId, let url = localURLs[id],
                  FileManager.default.fileExists(atPath: url.path) else {
                error = MusicLocalized.format("Esta canción ya no está disponible. Se conserva en tu lista.")
                next()
                return
            }
            NativeMusicPlayer.shared.play(name: entry.title, url: url, queue: [(name: entry.title, url: url)])
        case .appleMusic:
            guard let remoteID = entry.appleMusicSongId, !remoteID.isEmpty else { next(); return }
            Task { @MainActor in
                guard generation == playbackGeneration else { return }
                await NativeAppleMusicPlayer.shared.playSaved(id: remoteID, title: entry.title)
            }
        case .audius:
            guard let remoteID = entry.appleMusicSongId, !remoteID.isEmpty else { next(); return }
            NativeAudiusPlayer.shared.play(id: remoteID, title: entry.title)
        case .jamendo:
            guard let remoteID = entry.appleMusicSongId, !remoteID.isEmpty else { next(); return }
            Task { @MainActor in
                guard generation == playbackGeneration else { return }
                await NativeJamendoPlayer.shared.playSaved(id: remoteID)
            }
        }
    }
}
