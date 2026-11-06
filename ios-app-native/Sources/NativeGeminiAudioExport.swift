import Foundation

/// Export text to a single PCM WAV audiobook using a personal Gemini key.
/// Each segment is generated explicitly by user action; no silent truncation.
enum NativeGeminiAudioExport {
    static let maximumCharacters = 60_000
    static let chunkSize = 1_200

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

    static func export(text: String, title: String, voice: String,
                       progress: @escaping @MainActor (Int, Int) -> Void) async throws -> URL {
        let segments = try chunks(text)
        var pcmData = Data()
        for (index, segment) in segments.enumerated() {
            try Task.checkCancellation()
            // Very short/whitespace-only fragments still retain their place in
            // the written document; do not ask the provider for silent audio.
            if !segment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let wav = try await NativeGeminiSpeech.generate(segment, voice: voice)
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
        return file
    }
}
