import Foundation
import AVFoundation
import Combine

#if canImport(PhononTTS)
import PhononTTS

/// Optional iOS 18+ native Phonon adapter, linked only by the dedicated
/// Phonon development project. Existing iOS 17 users keep the ordinary build.
@available(iOS 18.0, *)
@MainActor
final class NativePhononDriver {
    static let shared = NativePhononDriver()
    private var model: Phonon?

    private func load() async throws -> Phonon {
        guard NativePhononModelStore.isInstalled else {
            throw NativePhononRuntime.RuntimeError.modelMissing
        }
        if let model { return model }
        let loaded = try await Phonon.load(
            models: NativePhononModelStore.directory, language: .english)
        model = loaded
        return loaded
    }

    func voiceNames() async throws -> [String] {
        try await load().voices
    }

    func generate(text: String, voice: String) async throws -> Data {
        let tts = try await load()
        try Task.checkCancellation()
        if !voice.isEmpty && voice != tts.voice {
            try await tts.setVoice(voice)
        }
        let samples = try await tts.synthesize(text)
        try Task.checkCancellation()
        guard !samples.isEmpty else {
            throw NativePhononRuntime.RuntimeError.empty
        }
        var pcm = Data(capacity: samples.count * 2)
        for sample in samples {
            let bounded = min(1.0, max(-1.0, sample))
            let value = Int16((bounded * 32767.0).rounded())
            let bits = UInt16(bitPattern: value).littleEndian
            pcm.append(UInt8(bits & 0xff))
            pcm.append(UInt8(bits >> 8))
        }
        return NativeGeminiSpeech.wav(pcm: pcm)
    }

    func unload() { model = nil }
}
#endif

enum NativePhononRuntime {
    enum RuntimeError: LocalizedError {
        case engineUnavailable, modelMissing, empty
        var errorDescription: String? {
            switch self {
            case .engineUnavailable:
                return "El motor Phonon nativo no está incluido en esta compilación."
            case .modelMissing:
                return "Instala primero el modelo Phonon desde Motores externos."
            case .empty:
                return "Phonon no ha generado sonido."
            }
        }
    }

    static var isUsable: Bool {
        #if canImport(PhononTTS)
        if #available(iOS 18, *) { return NativePhononModelStore.isInstalled }
        #endif
        return false
    }

    @MainActor
    static func voices() async throws -> [String] {
        #if canImport(PhononTTS)
        if #available(iOS 18, *) { return try await NativePhononDriver.shared.voiceNames() }
        #endif
        throw RuntimeError.engineUnavailable
    }

    @MainActor
    static func generate(text: String, voice: String) async throws -> Data {
        #if canImport(PhononTTS)
        if #available(iOS 18, *) {
            return try await NativePhononDriver.shared.generate(text: text, voice: voice)
        }
        #endif
        throw RuntimeError.engineUnavailable
    }
}

@MainActor
final class NativePhononPreview: ObservableObject {
    @Published private(set) var busy = false
    @Published private(set) var playing = false
    @Published var message = ""
    private var task: Task<Void, Never>?
    private var player: AVAudioPlayer?
    private var generation = 0

    func listen(voice: String) {
        stop()
        busy = true
        message = "Preparando muestra Phonon."
        let token = generation
        task = Task {
            do {
                let sound = try await NativePhononRuntime.generate(
                    text: "Hello. This is a sample of the Phonon voice.",
                    voice: voice)
                try Task.checkCancellation()
                guard token == generation else { return }
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                try AVAudioSession.sharedInstance().setActive(true)
                player = try AVAudioPlayer(data: sound)
                player?.prepareToPlay()
                playing = player?.play() ?? false
                message = playing ? "Reproduciendo muestra Phonon." :
                    "No se ha podido reproducir la muestra."
            } catch is CancellationError {
                // Stop invalidates outstanding synthesis and playback.
            } catch {
                guard token == generation else { return }
                message = error.localizedDescription
            }
            if token == generation { busy = false }
        }
    }

    func stop() {
        generation += 1
        task?.cancel()
        task = nil
        player?.stop()
        player = nil
        playing = false
        busy = false
    }
}
