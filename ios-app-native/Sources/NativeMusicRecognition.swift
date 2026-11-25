import AVFoundation
import Foundation

actor NativeMusicRecognition {
    static let shared = NativeMusicRecognition()

    struct Match: Sendable {
        let title: String
        let artist: String
    }

    private struct Response: Decodable {
        struct Result: Decodable {
            struct Recording: Decodable {
                struct Artist: Decodable { let name: String }
                let title: String?
                let artists: [Artist]?
            }
            let score: Double
            let recordings: [Recording]?
        }
        let status: String
        let results: [Result]?
    }

    private var nextRequest = Date.distantPast

    static var clientKey: String? {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "TifloAcoustIDClient") as? String,
              !key.isEmpty, !key.hasPrefix("$(") else { return nil }
        return key
    }

    func identify(_ audioURL: URL, client: String) async throws -> Match? {
        let sample = try Self.fingerprint(audioURL)
        try Task.checkCancellation()
        let now = Date()
        let slot = max(now, nextRequest)
        nextRequest = slot.addingTimeInterval(1)
        try await Task.sleep(for: .seconds(max(0, slot.timeIntervalSince(now))))

        var fields = URLComponents()
        fields.queryItems = [
            URLQueryItem(name: "client", value: client),
            URLQueryItem(name: "duration", value: String(sample.duration)),
            URLQueryItem(name: "fingerprint", value: sample.value),
            URLQueryItem(name: "meta", value: "recordings"),
            URLQueryItem(name: "format", value: "json")
        ]
        var request = URLRequest(url: URL(string: "https://api.acoustid.org/v2/lookup")!)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = fields.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let payload = try JSONDecoder().decode(Response.self, from: data)
        guard payload.status == "ok" else { throw URLError(.badServerResponse) }

        var candidates: [String: Match] = [:]
        for result in payload.results ?? [] where result.score >= 0.90 {
            for recording in result.recordings ?? [] {
                guard let title = recording.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty,
                      let artists = recording.artists, !artists.isEmpty else { continue }
                let artist = artists.map(\.name).joined(separator: ", ").trimmingCharacters(in: .whitespacesAndNewlines)
                guard !artist.isEmpty else { continue }
                candidates[(title + "\u{001F}" + artist).lowercased()] = Match(title: title, artist: artist)
            }
        }
        // Keep the user's existing metadata when multiple credits disagree.
        return candidates.count == 1 ? candidates.values.first : nil
    }

    private static func fingerprint(_ url: URL) throws -> (value: String, duration: Int) {
        let input = try AVAudioFile(forReading: url)
        let rate = input.processingFormat.sampleRate
        guard rate > 0, input.length > 0,
              let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 11025,
                  channels: 1, interleaved: false),
              let converter = AVAudioConverter(from: input.processingFormat, to: target),
              let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: 8192),
              let chunk = AVAudioPCMBuffer(pcmFormat: input.processingFormat, frameCapacity: 8192),
              let context = tiflo_chromaprint_new() else {
            throw CocoaError(.fileReadCorruptFile)
        }
        defer { chromaprint_free(context) }
        guard chromaprint_start(context, 11025, 1) == 1 else { throw CocoaError(.fileReadCorruptFile) }
        let limit = min(input.length, AVAudioFramePosition(rate * 120))
        var readError: Error?
        while true {
            try Task.checkCancellation()
            var conversionError: NSError?
            let status = converter.convert(to: output, error: &conversionError) { requested, state in
                let remaining = limit - input.framePosition
                guard remaining > 0, readError == nil else {
                    state.pointee = .endOfStream
                    return nil
                }
                do {
                    let frames = min(remaining, min(AVAudioFramePosition(requested), AVAudioFramePosition(chunk.frameCapacity)))
                    try input.read(into: chunk, frameCount: AVAudioFrameCount(frames))
                    state.pointee = chunk.frameLength == 0 ? .endOfStream : .haveData
                    return chunk.frameLength == 0 ? nil : chunk
                } catch {
                    readError = error
                    state.pointee = .endOfStream
                    return nil
                }
            }
            if let readError { throw readError }
            if let conversionError { throw conversionError }
            if output.frameLength > 0, let samples = output.int16ChannelData?.pointee,
               chromaprint_feed(context, samples, Int32(output.frameLength)) != 1 {
                throw CocoaError(.fileReadCorruptFile)
            }
            if status == .endOfStream { break }
            if status == .error || (status == .inputRanDry && output.frameLength == 0) {
                throw CocoaError(.fileReadCorruptFile)
            }
        }
        var result: UnsafeMutablePointer<CChar>?
        guard chromaprint_finish(context) == 1,
              chromaprint_get_fingerprint(context, &result) == 1,
              let result else { throw CocoaError(.fileReadCorruptFile) }
        defer { chromaprint_dealloc(result) }
        return (String(cString: result), max(1, Int((Double(input.length) / rate).rounded())))
    }
}
