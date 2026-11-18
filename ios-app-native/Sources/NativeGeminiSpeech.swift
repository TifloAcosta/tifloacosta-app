import Foundation
import AVFoundation

/// Google AI Studio Gemini TTS output. Credentials never enter request URLs or logs.
enum NativeGeminiSpeech {
    static let model = "gemini-2.5-flash-preview-tts"
    static let voices = ["Kore", "Puck", "Aoede", "Charon", "Fenrir", "Leda", "Orus", "Zephyr"]

    enum Error: LocalizedError {
        case missingKey, invalidResponse, emptyAudio, invalidPCM, refused, quota, unavailable
        var errorDescription: String? {
            switch self {
            case .missingKey: return "Configura la clave Gemini en Motores externos."
            case .invalidResponse: return "Gemini no devolvió audio válido."
            case .emptyAudio: return "Gemini no generó audio."
            case .invalidPCM: return "El formato de audio no es compatible."
            case .refused: return "Google rechazó la clave o sus permisos."
            case .quota: return "Se ha alcanzado el límite de uso de Gemini."
            case .unavailable: return "No se pudo utilizar el servicio Gemini."
            }
        }
    }

    static func generate(_ text: String, voice: String = "Kore") async throws -> Data {
        guard let key = try NativeVoiceCredentialStore.get("gemini"), !key.isEmpty else {
            throw Error.missingKey
        }
        let fragment = String(text.prefix(1600)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fragment.isEmpty else { throw Error.emptyAudio }
        let chosenVoice = voices.contains(voice) ? voice : "Kore"
        let payload: [String: Any] = [
            "contents": [["parts": [["text": "Read exactly this text aloud, without additions: " + fragment]]]],
            "generationConfig": [
                "responseModalities": ["AUDIO"],
                "speechConfig": ["voiceConfig": ["prebuiltVoiceConfig": ["voiceName": chosenVoice]]]
            ]
        ]
        let endpoint = URL(string:
            "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent")!
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 50
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw Error.invalidResponse }
        switch http.statusCode {
        case 200..<300: break
        case 401, 403: throw Error.refused
        case 429: throw Error.quota
        default: throw Error.unavailable
        }
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let candidates = root["candidates"] as? [[String: Any]],
              let content = candidates.first?["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]],
              let inline = parts.compactMap({ $0["inlineData"] as? [String: Any] }).first,
              let encoded = inline["data"] as? String,
              let audio = Data(base64Encoded: encoded) else {
            throw Error.invalidResponse
        }
        let mime = (inline["mimeType"] as? String ?? "").lowercased()
        if audio.starts(with: Data("RIFF".utf8)) { return audio }
        guard mime.contains("pcm") || mime.contains("l16"), audio.count.isMultiple(of: 2) else {
            throw Error.invalidPCM
        }
        return wav(pcm: audio)
    }

    static func wav(pcm: Data, sampleRate: UInt32 = 24000) -> Data {
        // Gemini legacy generateContent returns 16-bit mono 24kHz PCM.
        var output = Data()
        func word(_ value: UInt32) {
            let v = value.littleEndian
            withUnsafeBytes(of: v) { output.append(contentsOf: $0) }
        }
        func half(_ value: UInt16) {
            let v = value.littleEndian
            withUnsafeBytes(of: v) { output.append(contentsOf: $0) }
        }
        output.append(contentsOf: "RIFF".utf8)
        word(UInt32(pcm.count) + 36)
        output.append(contentsOf: "WAVEfmt ".utf8)
        word(16); half(1); half(1)
        word(sampleRate); word(sampleRate * 2)
        half(2); half(16)
        output.append(contentsOf: "data".utf8)
        word(UInt32(pcm.count))
        output.append(pcm)
        return output
    }
}

@MainActor
final class NativeGeminiPreview: ObservableObject {
    @Published private(set) var busy = false
    @Published private(set) var playing = false
    @Published var message = ""
    private var player: AVAudioPlayer?

    func listen(_ text: String, voice: String) {
        stop()
        busy = true
        message = "Generando audio. Se aplicarán las cuotas de tu cuenta."
        Task {
            do {
                let audio = try await NativeGeminiSpeech.generate(text, voice: voice)
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                try AVAudioSession.sharedInstance().setActive(true)
                player = try AVAudioPlayer(data: audio)
                player?.prepareToPlay()
                playing = player?.play() ?? false
                message = playing ? "Reproduciendo con Gemini." : "No se pudo reproducir el audio."
            } catch {
                message = error.localizedDescription
            }
            busy = false
        }
    }
    func stop() {
        player?.stop()
        player = nil
        playing = false
    }
}
