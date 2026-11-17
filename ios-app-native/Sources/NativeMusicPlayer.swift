import Foundation
import AVFoundation
import Combine

@MainActor
final class NativeMusicPlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published private(set) var currentName = ""
    @Published private(set) var isPlaying = false
    @Published private(set) var position: TimeInterval = 0
    @Published private(set) var duration: TimeInterval = 0
    @Published var error: String?

    private var audio: AVAudioPlayer?
    private var queue: [(name: String, url: URL)] = []
    private var index = -1
    private var timer: Timer?

    func play(name: String, url: URL, queue: [(name: String, url: URL)]) {
        self.queue = queue
        guard let position = queue.firstIndex(where: { $0.url == url }) else { return }
        index = position
        startCurrent()
    }

    private func startCurrent() {
        guard queue.indices.contains(index) else { stop(); return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            let item = queue[index]
            audio?.stop()
            let player = try AVAudioPlayer(contentsOf: item.url)
            player.delegate = self
            player.prepareToPlay()
            guard player.play() else { throw NSError(domain: "MiMusica", code: 1, userInfo: [NSLocalizedDescriptionKey: "No se pudo iniciar la reproducción."]) }
            audio = player
            currentName = item.name
            duration = player.duration
            position = 0
            isPlaying = true
            timer?.invalidate()
            timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.position = self?.audio?.currentTime ?? 0 }
            }
        } catch {
            self.error = "No se pudo reproducir la canción: \(error.localizedDescription)"
            isPlaying = false
        }
    }

    func toggle() {
        guard let audio else { return }
        if audio.isPlaying { audio.pause() } else { audio.play() }
        isPlaying = audio.isPlaying
    }

    func next() { index += 1; startCurrent() }
    func previous() { index = max(0, index - 1); startCurrent() }

    func skip(seconds: TimeInterval) {
        guard let audio else { return }
        audio.currentTime = min(max(audio.currentTime + seconds, 0), audio.duration)
        position = audio.currentTime
    }

    func stop() {
        audio?.stop()
        audio = nil
        timer?.invalidate()
        timer = nil
        currentName = ""
        isPlaying = false
        position = 0
        duration = 0
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.next() }
    }
}
