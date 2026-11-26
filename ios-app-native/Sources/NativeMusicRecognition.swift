import AVFoundation
import Foundation

actor NativeMusicRecognition {
    static let shared = NativeMusicRecognition()

    private final class RejectRedirects: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask,
                        willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest,
                        completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }

    private let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpShouldSetCookies = false
        return URLSession(configuration: configuration, delegate: RejectRedirects(), delegateQueue: nil)
    }()


    typealias Match = NativeAcoustIDLookup.Match

    private let clock = ContinuousClock()
    private var lastRequest: ContinuousClock.Instant?
    private var blockedUntil: ContinuousClock.Instant?

    struct LinkResponse: Decodable {
        struct User: Decodable {
            struct Link: Decodable {
                let code: String
                let url: URL
                let expires: String
            }
            let apikey: String
            let link: Link
        }
        let status: String
        let user: User?
    }

    typealias KeyState = NativeAcoustIDLookup.KeyState

    func requestLink(client: String) async throws -> LinkResponse.User {
        let data = try await request("user/request_link", client: client, fields: [
            URLQueryItem(name: "device", value: "TifloAcosta iOS")
        ])
        let result = try JSONDecoder().decode(LinkResponse.self, from: data)
        guard result.status == "ok", let user = result.user,
              user.link.url.scheme == "https", user.link.url.host == "acoustid.org",
              user.link.url.path == "/link" else { throw URLError(.badServerResponse) }
        return user
    }

    func linkStatus(client: String, user: String) async throws -> KeyState {
        let data = try await request("user/link_status", client: client, user: user)
        return try NativeAcoustIDLookup.keyState(in: data)
    }

    static var clientKey: String? {
        guard let key = Bundle.main.object(forInfoDictionaryKey: "TifloAcoustIDClient") as? String,
              !key.isEmpty, !key.hasPrefix("$(") else { return nil }
        return key
    }

    static var hasActiveAccount: Bool {
        (try? NativeAcoustIDKeychain.read(.active)) != nil
    }

    func identify(_ audioURL: URL, client: String) async throws -> Match? {
        let user = try NativeAcoustIDKeychain.read(.active)
        guard let user else { throw URLError(.userAuthenticationRequired) }
        let sample = try Self.fingerprint(audioURL)
        let data = try await request("lookup", client: client, user: user, fields: [
            URLQueryItem(name: "duration", value: String(sample.duration)),
            URLQueryItem(name: "fingerprint", value: sample.value),
            URLQueryItem(name: "meta", value: "recordings")
        ])
        try Task.checkCancellation()
        // A request may finish after the user unlinks or replaces the account.
        guard try NativeAcoustIDKeychain.read(.active) == user else {
            throw URLError(.userAuthenticationRequired)
        }
        return try NativeAcoustIDLookup.match(in: data)
    }

    private func request(_ path: String, client: String, user: String? = nil,
                         fields: [URLQueryItem] = []) async throws -> Data {
        while true {
            try Task.checkCancellation()
            let now = clock.now
            let next = max(lastRequest?.advanced(by: .seconds(1)) ?? now, blockedUntil ?? now)
            if next <= now { lastRequest = now; break }
            try await clock.sleep(until: next)
        }
        var form = URLComponents()
        form.queryItems = fields + [URLQueryItem(name: "format", value: "json")]
        var request = URLRequest(url: URL(string: "https://api.acoustid.org/v2/" + path)!)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue(client, forHTTPHeaderField: "Acoustid-App-Key")
        if let user { request.setValue(user, forHTTPHeaderField: "Acoustid-User-Key") }
        request.httpBody = form.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
        let (data, response) = try await NativeAcoustIDLookup.send { try await session.data(for: request) }
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if http.statusCode == 429 {
            let seconds = http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init) ?? 30
            let deadline = clock.now.advanced(by: .seconds(max(1, seconds)))
            blockedUntil = max(blockedUntil ?? deadline, deadline)
        }
        if http.statusCode == 401 || http.statusCode == 403 { throw URLError(.userAuthenticationRequired) }
        guard http.statusCode == 200 else { throw URLError(.badServerResponse) }
        return data
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
