import Foundation
import AVFoundation
import SwiftMP3

/// Export audio without truncating documents. Remote providers have quota limits;
/// offline synthesis streams large output to temporary files instead of memory.
enum NativeGeminiAudioExport {
    static let maximumCharacters = 60_000 // Applies only to Gemini API exports
    static let chunkSize = 1_200

    enum Engine: String, CaseIterable, Identifiable {
        case system = "Sistema iOS"
        case gemini = "Gemini"
        case phonon = "Phonon"
        var id: String { rawValue }
    }

    static func synthesize(_ text: String, voice: String, engine: Engine,
                           speed: Double = 1.0, pitch: Float = 1.0) async throws -> Data {
        try Task.checkCancellation()
        switch engine {
        case .system:
            return try await NativeSystemSpeechExport.generate(text, voice: voice, speed: speed, pitch: pitch)
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

    /// Human-readable export names, with a small numeric suffix only when a file exists.
    /// UUIDs stay inside the work directory, never in the shared file name.
    static func destination(title: String, fileExtension: String) throws -> URL {
        let cleaned = title.replacingOccurrences(of: #"[^\p{L}\p{N}\p{M} ._()-]"#,
            with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let base = String((cleaned.isEmpty ? "Documento" : cleaned).prefix(120))
            .trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        let name = base.isEmpty ? "Documento" : base
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("TifloLectorExport", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var candidate = folder.appendingPathComponent(name).appendingPathExtension(fileExtension)
        var suffix = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            candidate = folder.appendingPathComponent("\(name) (\(suffix))")
                .appendingPathExtension(fileExtension)
            suffix += 1
        }
        return candidate
    }

    enum ExportError: LocalizedError {
        case tooLong, empty, unsupportedFormat, insufficientStorage
        var errorDescription: String? {
            switch self {
            case .tooLong: return "Con Gemini, esta exportación admite hasta 60.000 caracteres. Usa una voz local para libros más largos."
            case .empty: return "El documento no contiene texto."
            case .insufficientStorage: return "No hay espacio suficiente para crear el audio. Libera almacenamiento en el iPhone y vuelve a intentarlo."
            case .unsupportedFormat: return "El motor de voz ha devuelto audio con un formato incompatible."
            }
        }
    }

    /// Split at sentence/pause boundaries, retaining all text and whitespace.
    static func chunks(_ text: String, engine: Engine = .gemini) throws -> [String] {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ExportError.empty
        }
        if engine == .gemini && text.count > maximumCharacters { throw ExportError.tooLong }
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
            sampleRate: 48_000, bitrateKbps: 128, mode: .mono
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


    /// Convert 24 kHz 16-bit mono PCM without buffering the whole audiobook.
    /// The header is updated after the last audio chunk has been written.
    private static func writeWAVHeader(_ output: FileHandle, pcmBytes: UInt64) throws {
        guard pcmBytes <= UInt64(UInt32.max - 36) else { throw ExportError.unsupportedFormat }
        let header = NativeGeminiSpeech.wav(pcm: Data())
        var data = header
        func overwrite(_ value: UInt32, at offset: Int) {
            var littleEndian = value.littleEndian
            withUnsafeBytes(of: &littleEndian) { bytes in
                data.replaceSubrange(offset..<(offset + 4), with: bytes)
            }
        }
        overwrite(UInt32(pcmBytes) + 36, at: 4)
        overwrite(UInt32(pcmBytes), at: 40)
        try output.seek(toOffset: 0)
        try output.write(contentsOf: data)
    }

    /// Stream an MP3 encoding from a PCM WAV file, keeping bounded buffers.
    private static func encodeMP3(wavFile: URL, destination: URL) throws {
        let input = try FileHandle(forReadingFrom: wavFile)
        defer { try? input.close() }
        try input.seek(toOffset: 44) // PCM WAV, fixed header written above.
        let temp = destination.deletingLastPathComponent()
            .appendingPathComponent(UUID().uuidString + ".mp3chunks")
        FileManager.default.createFile(atPath: temp.path, contents: nil)
        let stream = try FileHandle(forWritingTo: temp)
        defer {
            try? stream.close()
            try? FileManager.default.removeItem(at: temp)
        }
        let encoder = try MP3Encoder(options: MP3EncoderOptions(
            sampleRate: 48_000, bitrateKbps: 64, mode: .mono
        ))
        var session = encoder.newSession()
        var carry: UInt8?
        while true {
            let block = try input.read(upToCount: 65_536) ?? Data()
            if block.isEmpty { break }
            var samples: [Float] = []
            samples.reserveCapacity(block.count)
            var position = 0
            if let previous = carry {
                if !block.isEmpty {
                    let raw = Int16(bitPattern: UInt16(previous) | (UInt16(block[0]) << 8))
                    let current = Float(raw) / 32768
                    let next = block.count >= 3
                        ? Float(Int16(bitPattern: UInt16(block[1]) | (UInt16(block[2]) << 8))) / 32768
                        : current
                    samples.append(current)
                    samples.append((current + next) * 0.5)
                    position = 1
                }
                carry = nil
            }
            while position + 1 < block.count {
                let raw = Int16(bitPattern: UInt16(block[position]) | (UInt16(block[position + 1]) << 8))
                let current = Float(raw) / 32768
                let next: Float
                if position + 3 < block.count {
                    let nextRaw = Int16(bitPattern: UInt16(block[position + 2]) | (UInt16(block[position + 3]) << 8))
                    next = Float(nextRaw) / 32768
                } else { next = current }
                samples.append(current)
                samples.append((current + next) * 0.5)
                position += 2
            }
            if position < block.count { carry = block[position] }
            try stream.write(contentsOf: session.encode(samples: samples))
        }
        guard carry == nil else { throw ExportError.unsupportedFormat }
        try stream.write(contentsOf: session.flush())
        try stream.close()
        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }
        try output.write(contentsOf: session.generateID3Tag())
        try output.write(contentsOf: session.generateXingHeader())
        let encoded = try FileHandle(forReadingFrom: temp)
        defer { try? encoded.close() }
        while true {
            let block = try encoded.read(upToCount: 65_536) ?? Data()
            if block.isEmpty { break }
            try output.write(contentsOf: block)
        }
    }

    static func export(text: String, title: String, voice: String, format: Format,
                       engine: Engine = .system, speed: Double = 1.0, pitch: Float = 1.0,
                       progress: @escaping @MainActor (Int, Int) -> Void) async throws -> URL {
        if format == .daisy {
            return try await NativeGeminiDaisyExport.generate(
                text: text, title: title, voice: voice, engine: engine,
                speed: speed, pitch: pitch, progress: progress)
        }
        let segments = try chunks(text, engine: engine)
        let file = try destination(title: title, fileExtension: "wav")
        FileManager.default.createFile(atPath: file.path, contents: nil)
        let output = try FileHandle(forWritingTo: file)
        var completed = false
        defer {
            try? output.close()
            if !completed { try? FileManager.default.removeItem(at: file) }
        }
        try output.write(contentsOf: NativeGeminiSpeech.wav(pcm: Data()))
        var totalBytes: UInt64 = 0
        for (index, segment) in segments.enumerated() {
            try Task.checkCancellation()
            if !segment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let wav = try await synthesize(segment, voice: voice, engine: engine,
                                               speed: speed, pitch: pitch)
                let bytes = try pcm(wav)
                totalBytes += UInt64(bytes.count)
                try output.write(contentsOf: bytes)
            }
            await progress(index + 1, segments.count)
        }
        try Task.checkCancellation()
        guard totalBytes > 0 else { throw ExportError.empty }
        try writeWAVHeader(output, pcmBytes: totalBytes)
        try output.close()
        completed = true
        if format == .wav { return file }
        let destination = try destination(title: title,
            fileExtension: format == .mp3 ? "mp3" : "m4a")
        defer { try? FileManager.default.removeItem(at: file) }
        if format == .mp3 {
            try encodeMP3(wavFile: file, destination: destination)
            return destination
        }
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
        return destination
    }

}
