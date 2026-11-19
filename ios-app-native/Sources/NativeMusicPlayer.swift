import Foundation
import AVFoundation
import Combine
import MediaPlayer
import UIKit

/// The remote command center is shared by every audio section in the app.
/// A command must only act on the player that currently owns playback.
@MainActor
enum NativeRemotePlaybackOwner {
    enum Destination: Equatable { case reader, music }
    private(set) static var current: Destination?

    static func claim(_ destination: Destination) {
        current = destination
        let remote = MPRemoteCommandCenter.shared()
        remote.nextTrackCommand.isEnabled = destination == .music
        remote.previousTrackCommand.isEnabled = destination == .music
    }

    static func release(_ destination: Destination) {
        guard current == destination else { return }
        current = nil
        MPRemoteCommandCenter.shared().nextTrackCommand.isEnabled = false
        MPRemoteCommandCenter.shared().previousTrackCommand.isEnabled = false
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
}

@MainActor
enum NativeReaderPlaybackBridge {
    static var pauseActiveReader: (() -> Void)?
}

private struct MusicAudioSnapshot: Codable {
    let name: String
    let gains: [Float]
}

/// Motor de Mi Música; no comparte sesión ni preferencias con la lectura TTS.
@MainActor
final class NativeMusicPlayer: ObservableObject {
    static let shared = NativeMusicPlayer()
    @Published private(set) var currentName = ""
    @Published private(set) var isPlaying = false
    @Published private(set) var position: TimeInterval = 0
    @Published private(set) var duration: TimeInterval = 0
    @Published var error: String?
    @Published private(set) var repeatMode = UserDefaults.standard.string(forKey: "mi-musica-repeat") ?? "off"
    @Published private(set) var shuffleEnabled = UserDefaults.standard.bool(forKey: "mi-musica-shuffle")
    @Published private(set) var sleepRemaining = 0

    static let frequencies: [Float] = [80, 250, 1000, 4000, 12000]
    static let presets: [(name: String, gains: [Float])] = [
        ("Normal", [0, 0, 0, 0, 0]),
        ("Rock", [4, 2, -1, 3, 2]),
        ("Pop", [2, 1, 0, 2, 2]),
        ("Clásica", [0, 0, 0, 1, 2]),
        ("Jazz", [2, 1, 0, 1, 1]),
        ("Claridad vocal", [-2, -1, 1, 3, 2]),
        ("Graves", [5, 3, 0, -1, -1])
    ]
    @Published private(set) var selectedPreset = UserDefaults.standard.string(forKey: "mi-musica-eq-preset") ?? "Normal"
    @Published private(set) var gains: [Float] = [0, 0, 0, 0, 0]
    @Published private(set) var currentHasOverride = false

    private let engine = AVAudioEngine()
    private let node = AVAudioPlayerNode()
    private let equalizer = AVAudioUnitEQ(numberOfBands: 5)
    private var file: AVAudioFile?
    private var queue: [(name: String, url: URL)] = []
    private var originalQueue: [(name: String, url: URL)] = []
    private var index = -1
    private var timer: Timer?
    private var sleepUntil: Date?
    private var startFrame: AVAudioFramePosition = 0
    private var generation = 0
    private var remoteCommandTokens: [Any] = []

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .music, !currentName.isEmpty else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: currentName,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteCommandTokens.isEmpty else { return }
        let remoteCommandCenter = MPRemoteCommandCenter.shared()
        UIApplication.shared.beginReceivingRemoteControlEvents()
        remoteCommandCenter.playCommand.isEnabled = true
        remoteCommandCenter.pauseCommand.isEnabled = true
        remoteCommandCenter.togglePlayPauseCommand.isEnabled = true
        let play = remoteCommandCenter.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .music, let self,
                      !self.isPlaying else { return }
                self.toggle()
            }
            return .success
        }
        let pause = remoteCommandCenter.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .music, let self,
                      self.isPlaying else { return }
                self.toggle()
            }
            return .success
        }
        let toggle = remoteCommandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .music else { return }
                self?.toggle()
            }
            return .success
        }
        let next = remoteCommandCenter.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .music else { return }
                self?.next()
            }
            return .success
        }
        let previous = remoteCommandCenter.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .music else { return }
                self?.previous()
            }
            return .success
        }
        remoteCommandTokens = [play, pause, toggle, next, previous]
    }

    private func unregisterRemoteCommands() {
        guard remoteCommandTokens.count == 5 else { return }
        let remoteCommandCenter = MPRemoteCommandCenter.shared()
        remoteCommandCenter.playCommand.removeTarget(remoteCommandTokens[0])
        remoteCommandCenter.pauseCommand.removeTarget(remoteCommandTokens[1])
        remoteCommandCenter.togglePlayPauseCommand.removeTarget(remoteCommandTokens[2])
        remoteCommandCenter.nextTrackCommand.removeTarget(remoteCommandTokens[3])
        remoteCommandCenter.previousTrackCommand.removeTarget(remoteCommandTokens[4])
        remoteCommandTokens = []
    }

    func pauseForReader() {
        if isPlaying { toggle() }
    }

    init() {
        engine.attach(node)
        engine.attach(equalizer)
        for (index, band) in equalizer.bands.enumerated() {
            band.filterType = .parametric
            band.frequency = Self.frequencies[index]
            band.bandwidth = 1
            band.bypass = false
        }
        if selectedPreset == "Personalizado",
           let saved = UserDefaults.standard.array(forKey: "mi-musica-eq-bands") as? [Double],
           saved.count == 5 {
            gains = saved.map { Float($0).clamped(to: -12...12) }
        } else {
            gains = Self.presets.first(where: { $0.name == selectedPreset })?.gains ?? [0, 0, 0, 0, 0]
        }
        applyEqualizer()
    }

    func selectPreset(_ name: String) {
        guard let preset = Self.presets.first(where: { $0.name == name }) else { return }
        selectedPreset = preset.name
        gains = preset.gains
        applyEqualizer()
    }

    func adjustBand(_ index: Int, by amount: Float) {
        guard gains.indices.contains(index) else { return }
        gains[index] = (gains[index] + amount).clamped(to: -12...12)
        selectedPreset = "Personalizado"
        applyEqualizer()
    }

    func saveAsGeneral() {
        UserDefaults.standard.set(selectedPreset, forKey: "mi-musica-eq-preset")
        UserDefaults.standard.set(gains.map(Double.init), forKey: "mi-musica-eq-bands")
    }

    private func overrideKey(_ url: URL) -> String { "mi-musica-eq-song-" + url.lastPathComponent }

    func saveForCurrent() {
        guard queue.indices.contains(index) else { return }
        let snapshot = MusicAudioSnapshot(name: selectedPreset, gains: gains)
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: overrideKey(queue[index].url))
        currentHasOverride = true
    }

    func removeCurrentOverride() {
        guard queue.indices.contains(index) else { return }
        UserDefaults.standard.removeObject(forKey: overrideKey(queue[index].url))
        loadProfile(for: queue[index].url)
    }

    private func loadProfile(for url: URL) {
        let saved = UserDefaults.standard.data(forKey: overrideKey(url))
            .flatMap { try? JSONDecoder().decode(MusicAudioSnapshot.self, from: $0) }
        currentHasOverride = saved != nil
        if let saved, saved.gains.count == 5 {
            selectedPreset = saved.name
            gains = saved.gains.map { $0.clamped(to: -12...12) }
        } else {
            selectedPreset = UserDefaults.standard.string(forKey: "mi-musica-eq-preset") ?? "Normal"
            if selectedPreset == "Personalizado",
               let custom = UserDefaults.standard.array(forKey: "mi-musica-eq-bands") as? [Double], custom.count == 5 {
                gains = custom.map { Float($0).clamped(to: -12...12) }
            } else {
                gains = Self.presets.first(where: { $0.name == selectedPreset })?.gains ?? [0, 0, 0, 0, 0]
            }
        }
        applyEqualizer()
    }

    private func applyEqualizer() {
        for (index, band) in equalizer.bands.enumerated() { band.gain = gains[index] }
        // Atenuación preventiva al reforzar frecuencias: limita el riesgo de saturación.
        equalizer.globalGain = gains.contains(where: { $0 > 0 }) ? -6 : 0
    }

    func play(name: String, url: URL, queue: [(name: String, url: URL)]) {
        originalQueue = queue
        self.queue = shuffleEnabled ? queue.filter { $0.url == url } + queue.filter { $0.url != url }.shuffled() : queue
        guard let position = self.queue.firstIndex(where: { $0.url == url }) else { return }
        index = position
        startCurrent()
    }

    private func startCurrent() {
        guard queue.indices.contains(index) else { stop(); return }
        do {
            NativeReaderPlaybackBridge.pauseActiveReader?()
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            let item = queue[index]
            loadProfile(for: item.url)
            generation += 1
            node.stop()
            let audioFile = try AVAudioFile(forReading: item.url)
            file = audioFile
            engine.disconnectNodeOutput(node)
            engine.disconnectNodeOutput(equalizer)
            engine.connect(node, to: equalizer, format: audioFile.processingFormat)
            engine.connect(equalizer, to: engine.mainMixerNode, format: audioFile.processingFormat)
            startFrame = 0
            duration = Double(audioFile.length) / audioFile.processingFormat.sampleRate
            position = 0
            currentName = item.name
            try schedule(from: 0)
            if !engine.isRunning { try engine.start() }
            node.play()
            isPlaying = true
            NativeRemotePlaybackOwner.claim(.music)
            registerRemoteCommands()
            updateNowPlaying()
            startTimer()
        } catch {
            self.error = "No se pudo reproducir la canción: \(error.localizedDescription)"
            stop()
        }
    }

    private func schedule(from frame: AVAudioFramePosition) throws {
        guard let file else { return }
        let remaining = file.length - frame
        guard remaining > 0 else { return }
        let count = AVAudioFrameCount(min(remaining, AVAudioFramePosition(UInt32.max)))
        let thisGeneration = generation
        node.scheduleSegment(file, startingFrame: frame, frameCount: count, at: nil,
                             completionCallbackType: .dataPlayedBack) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.generation == thisGeneration else { return }
                if self.repeatMode == "one" { self.startCurrent() } else { self.next() }
            }
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if let audioFile = self.file, let render = self.node.lastRenderTime,
                   let played = self.node.playerTime(forNodeTime: render) {
                    self.position = min(self.duration, Double(self.startFrame) / audioFile.processingFormat.sampleRate + Double(played.sampleTime) / played.sampleRate)
                    self.updateNowPlaying()
                }
                if let until = self.sleepUntil {
                    self.sleepRemaining = max(0, Int(ceil(until.timeIntervalSinceNow)))
                    if self.sleepRemaining == 0 { self.cancelSleep(); self.stop() }
                }
            }
        }
    }

    func toggle() {
        guard file != nil else { return }
        if isPlaying {
            node.pause()
        } else {
            NativeReaderPlaybackBridge.pauseActiveReader?()
            NativeRemotePlaybackOwner.claim(.music)
            registerRemoteCommands()
            node.play()
        }
        isPlaying.toggle()
        updateNowPlaying()
    }

    func next() {
        index += 1
        if index >= queue.count && repeatMode == "all" { index = 0 }
        startCurrent()
    }

    func previous() { index = max(0, index - 1); startCurrent() }

    func skip(seconds: TimeInterval) {
        guard let file else { return }
        let target = min(max(position + seconds, 0), duration)
        generation += 1
        node.stop()
        startFrame = min(file.length - 1, AVAudioFramePosition(target * file.processingFormat.sampleRate))
        do {
            try schedule(from: startFrame)
            NativeReaderPlaybackBridge.pauseActiveReader?()
            NativeRemotePlaybackOwner.claim(.music)
            registerRemoteCommands()
            node.play()
            isPlaying = true
            position = target
            updateNowPlaying()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func changeRepeat() {
        repeatMode = repeatMode == "off" ? "all" : repeatMode == "all" ? "one" : "off"
        UserDefaults.standard.set(repeatMode, forKey: "mi-musica-repeat")
    }

    func toggleShuffle() {
        shuffleEnabled.toggle()
        UserDefaults.standard.set(shuffleEnabled, forKey: "mi-musica-shuffle")
        guard queue.indices.contains(index) else { return }
        let currentURL = queue[index].url
        queue = shuffleEnabled ? [queue[index]] + queue.filter { $0.url != currentURL }.shuffled() : originalQueue
        index = queue.firstIndex(where: { $0.url == currentURL }) ?? 0
    }

    func setSleep(minutes: Int) {
        sleepUntil = Date().addingTimeInterval(TimeInterval(minutes * 60))
        sleepRemaining = minutes * 60
    }

    func cancelSleep() { sleepUntil = nil; sleepRemaining = 0 }

    func stop() {
        generation += 1
        node.stop()
        engine.stop()
        file = nil
        timer?.invalidate()
        timer = nil
        currentName = ""
        isPlaying = false
        position = 0
        duration = 0
        unregisterRemoteCommands()
        NativeRemotePlaybackOwner.release(.music)
    }
}

private extension Float {
    func clamped(to range: ClosedRange<Float>) -> Float { min(max(self, range.lowerBound), range.upperBound) }
}
