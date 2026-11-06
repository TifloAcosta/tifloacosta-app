import Foundation
import AVFoundation
import SwiftMP3

/// Export text to a single PCM WAV audiobook using a personal Gemini key.
/// Each segment is generated explicitly by user action; no silent truncation.
enum NativeGeminiAudioExport {
    static let maximumCharacters = 60_000
    static let chunkSize = 1_200

    enum Engine: String, CaseIterable, Identifiable {
        case gemini = "Gemini"
        case phonon = "Phonon"
        var id: String { rawValue }
    }

    static func synthesize(_ text: String, voice: String, engine: Engine) async throws -> Data {
        try Task.checkCancellation()
        switch engine {
        case .gemini:
            return try await NativeGeminiSpeech.generate(text, voice: voice)
        case .phonon:
            return try await NativePhononRuntime.generate(text: text, voice: voice)
        }
    }

    enum Format: String, CaseIterable, Identifiable {
        case mp3 = "MP3"
        case m4a = "M4A"
        case wav = "WAV"
        case daisy = "DAISY"
        var id: String { rawValue }
    }

    enum ExportError: LocalizedError {
        case tooLong, empty, unsupportedFormat
        var errorDescription: String? {
            switch self {
            case .tooLong: return "El documento supera el límite de esta exportación (60.000 caracteres)."
            case .empty: return "El documento no contiene texto."
            case .unsupportedFormat: return "Gemini ha devuelto audio con un formato incompatible."
            }
        }
    }

    /// Split at sentence/pause boundaries, retaining all text and whitespace.
    static func chunks(_ text: String) throws -> [String] {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ExportError.empty
        }
        guard text.count <= maximumCharacters else { throw ExportError.tooLong }
        var result: [String] = []
        var rest = text[...]
        while !rest.isEmpty {
            let end = rest.index(rest.startIndex, offsetBy: min(rest.count, chunkSize))
            var split = end
            if end < rest.endIndex {
                var cursor = end
                let minimum = rest.index(rest.startIndex, offsetBy: min(rest.count, chunkSize / 2))
                while cursor > minimum {
                    let previous = rest[rest.index(before: cursor)]
                    if previous == "." || previous == "!" || previous == "?" ||
                        previous == "\n" || previous == " " {
                        split = cursor
                        break
                    }
                    cursor = rest.index(before: cursor)
                }
            }
            result.append(String(rest[..<split]))
            rest = rest[split...]
        }
        return result
    }

    /// Gemini produces 24 kHz mono 16-bit WAV. Copy raw PCM without duplicating headers.
    static func pcm(_ wav: Data) throws -> Data {
        guard wav.count >= 44, String(data: wav.prefix(4), encoding: .ascii) == "RIFF",
              let signature = String(data: wav.subdata(in: 8..<12), encoding: .ascii),
              signature == "WAVE" else { throw ExportError.unsupportedFormat }
        var offset = 12
        while offset + 8 <= wav.count {
            let name = String(data: wav.subdata(in: offset..<offset+4), encoding: .ascii)
            let length = wav.subdata(in: offset+4..<offset+8).withUnsafeBytes {
                UInt32(littleEndian: $0.loadUnaligned(as: UInt32.self))
            }
            let begin = offset + 8
            guard Int(length) <= wav.count - begin else { throw ExportError.unsupportedFormat }
            if name == "data" {
                guard length.isMultiple(of: 2) else { throw ExportError.unsupportedFormat }
                return wav.subdata(in: begin..<begin + Int(length))
            }
            offset = begin + Int(length) + (Int(length) % 2)
        }
        throw ExportError.unsupportedFormat
    }

    /// SwiftMP3 encodes MPEG-1 Layer III at 48 kHz; interpolate Gemini's 24 kHz
    /// mono PCM without using a network encoder or mislabelling the file.
    static func mp3(pcm: Data) throws -> Data {
        guard pcm.count % 2 == 0 else { throw ExportError.unsupportedFormat }
        let encoder = try MP3Encoder(options: MP3EncoderOptions(
            sampleRate: 48_000, bitrateKbps: 64, mode: .mono
        ))
        var session = encoder.newSession()
        var encoded = Data()
        var position = 0
        while position < pcm.count {
            let end = min(pcm.count, position + 4096)
            var samples: [Float] = []
            samples.reserveCapacity((end - position) * 1)
            while position < end {
                let low = UInt16(pcm[position])
                let high = UInt16(pcm[position + 1]) << 8
                let raw = Int16(bitPattern: low | high)
                let current = Float(raw) / 32768
                let nextRaw: Int16
                if position + 3 < pcm.count {
                    let a = UInt16(pcm[position + 2])
                    let b = UInt16(pcm[position + 3]) << 8
                    nextRaw = Int16(bitPattern: a | b)
                } else {
                    nextRaw = raw
                }
                samples.append(current)
                samples.append((current + Float(nextRaw) / 32768) * 0.5)
                position += 2
            }
            encoded.append(session.encode(samples: samples))
        }
        encoded.append(session.flush())
        var result = session.generateID3Tag()
        result.append(session.generateXingHeader())
        result.append(encoded)
        return result
    }

    static func export(text: String, title: String, voice: String, format: Format,
                       engine: Engine = .gemini,
                       progress: @escaping @MainActor (Int, Int) -> Void) async throws -> URL {
        if format == .daisy {
            return try await NativeGeminiDaisyExport.generate(
                text: text, title: title, voice: voice, engine: engine, progress: progress)
        }
        let segments = try chunks(text)
        var pcmData = Data()
        for (index, segment) in segments.enumerated() {
            try Task.checkCancellation()
            // Very short/whitespace-only fragments still retain their place in
            // the written document; do not ask the provider for silent audio.
            if !segment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let wav = try await synthesize(segment, voice: voice, engine: engine)
                pcmData.append(try pcm(wav))
            }
            await progress(index + 1, segments.count)
        }
        try Task.checkCancellation()
        guard !pcmData.isEmpty else { throw ExportError.empty }
        let safe = title.replacingOccurrences(
            of: #"[^A-Za-z0-9 _.-]"#, with: "_", options: .regularExpression)
            .prefix(65)
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("TifloLectorExport", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent(
            "\(safe.isEmpty ? "Documento" : String(safe))-\(UUID().uuidString).wav")
        try NativeGeminiSpeech.wav(pcm: pcmData).write(to: file, options: .atomic)
        if format == .wav { return file }
        if format == .mp3 {
            try Task.checkCancellation()
            let destination = file.deletingPathExtension().appendingPathExtension("mp3")
            try mp3(pcm: pcmData).write(to: destination, options: .atomic)
            try FileManager.default.removeItem(at: file)
            return destination
        }

        // Convert the actual audio, never just its filename extension.
        let destination = file.deletingPathExtension().appendingPathExtension("m4a")
        let asset = AVURLAsset(url: file)
        guard let session = AVAssetExportSession(asset: asset,
                         presetName: AVAssetExportPresetAppleM4A) else {
            throw ExportError.unsupportedFormat
        }
        session.outputURL = destination
        session.outputFileType = .m4a
        await session.export()
        try Task.checkCancellation()
        guard session.status == .completed else {
            try? FileManager.default.removeItem(at: destination)
            throw session.error ?? ExportError.unsupportedFormat
        }
        try? FileManager.default.removeItem(at: file)
        return destination
    }
}
