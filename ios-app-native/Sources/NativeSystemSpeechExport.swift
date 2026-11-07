import Foundation
import AVFoundation

/// On-device synthesis for audio and full-text DAISY exports. No API key or
/// network account is needed. Output is 24 kHz, mono, signed 16-bit PCM WAV,
/// matching the existing MP3 and DAISY timebase.
@MainActor
enum NativeSystemSpeechExport {
    enum ExportError: LocalizedError {
        case noAudio, unsupportedVoice, invalidFormat, conversion
        var errorDescription: String? {
            switch self {
            case .noAudio:
                return "La voz del sistema no produjo audio exportable. Prueba otra voz instalada."
            case .unsupportedVoice:
                return "La voz seleccionada ya no está disponible en el iPhone."
            case .invalidFormat:
                return "iOS devolvió un formato de voz que no puede exportarse."
            case .conversion:
                return "No se pudo convertir el audio de la voz al formato de exportación."
            }
        }
    }

    static func generate(_ text: String, voice: String) async throws -> Data {
        try Task.checkCancellation()
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { throw ExportError.noAudio }
        let utterance = AVSpeechUtterance(string: content)
        if !voice.isEmpty {
            guard let selected = AVSpeechSynthesisVoice(identifier: voice) else {
                throw ExportError.unsupportedVoice
            }
            utterance.voice = selected
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: "es-ES")
        }
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        let synthesizer = AVSpeechSynthesizer()
        var pcm = Data()
        var callbackError: Error?
        let conversion = PCMConversionState()
        // write provides synthesized PCM buffers (rather than speaker audio).
        // An empty buffer is the framework's end-of-utterance signal.
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var completed = false
            synthesizer.write(utterance) { buffer in
                guard !completed else { return }
                guard let input = buffer as? AVAudioPCMBuffer else {
                    callbackError = ExportError.invalidFormat
                    completed = true
                    continuation.resume(throwing: ExportError.invalidFormat)
                    return
                }
                if input.frameLength == 0 {
                    completed = true
                    continuation.resume(returning: ())
                    return
                }
                do {
                    pcm.append(try conversion.convertTo24kPCM(input))
                } catch {
                    callbackError = error
                    completed = true
                    continuation.resume(throwing: error)
                }
            }
        }
        if let callbackError { throw callbackError }
        try Task.checkCancellation()
        guard !pcm.isEmpty else { throw ExportError.noAudio }
        return NativeGeminiSpeech.wav(pcm: pcm)
    }

    /// Keep the sample-rate converter's state across consecutive speech buffers.
    /// Reinitializing it for every block can produce abrupt boundaries.
    private final class PCMConversionState {
        private var converter: AVAudioConverter?
        private let headroom: Float = 0.88

        func convertTo24kPCM(_ input: AVAudioPCMBuffer) throws -> Data {
            guard let outputFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32, sampleRate: 24_000,
                channels: 1, interleaved: false) else {
                throw ExportError.conversion
            }
            if converter?.inputFormat != input.format {
                converter = AVAudioConverter(from: input.format, to: outputFormat)
            }
            guard let converter else { throw ExportError.conversion }
            let estimate = Int((Double(input.frameLength) * 24_000 /
                                input.format.sampleRate).rounded(.up)) + 512
            guard let converted = AVAudioPCMBuffer(
                pcmFormat: outputFormat, frameCapacity: AVAudioFrameCount(max(512, estimate))) else {
                throw ExportError.conversion
            }
            var supplied = false
            var error: NSError?
            let status = converter.convert(to: converted, error: &error) { _, inputStatus in
                if !supplied {
                    supplied = true
                    inputStatus.pointee = .haveData
                    return input
                }
                inputStatus.pointee = .noDataNow
                return nil
            }
            guard status != .error, error == nil,
                  let channel = converted.floatChannelData?[0] else {
                throw error ?? ExportError.conversion
            }
            var data = Data(capacity: Int(converted.frameLength) * 2)
            for index in 0..<Int(converted.frameLength) {
                let sample = max(-1, min(1, channel[index] * headroom))
                let bits = UInt16(bitPattern: Int16((sample * 32767).rounded())).littleEndian
                data.append(UInt8(bits & 0xff))
                data.append(UInt8((bits >> 8) & 0xff))
            }
            return data
        }
    }
}
