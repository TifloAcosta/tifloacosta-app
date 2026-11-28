import Foundation

enum NativeAcoustIDLookup {
    struct Match: Sendable, Equatable {
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
        struct APIError: Decodable { let code: Int }
        let error: APIError?
    }

    static func requiresUserKey(in data: Data) -> Bool {
        guard let payload = try? JSONDecoder().decode(Response.self, from: data),
              payload.status != "ok", let code = payload.error?.code else { return false }
        // 4: invalid user key; 21: personal key required from January 2027.
        return code == 4 || code == 21
    }

    static func match(in data: Data) throws -> Match? {
        let payload = try JSONDecoder().decode(Response.self, from: data)
        guard payload.status == "ok" else {
            if requiresUserKey(in: data) { throw URLError(.userAuthenticationRequired) }
            throw URLError(.badServerResponse)
        }

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

    enum KeyState: String, Decodable {
        case pending, approved, declined, expired, revoked, unknown
    }

    private struct KeyResponse: Decodable {
        struct Key: Decodable { let state: KeyState }
        let status: String
        let key: Key?
    }

    static func keyState(in data: Data) throws -> KeyState {
        let result = try JSONDecoder().decode(KeyResponse.self, from: data)
        guard result.status == "ok", let key = result.key else { throw URLError(.badServerResponse) }
        return key.state
    }

    static func send<T>(_ transport: () async throws -> T) async throws -> T {
        do {
            let result = try await transport()
            try Task.checkCancellation()
            return result
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        }
    }

    @MainActor
    static func identifyBatch<ID>(_ ids: [ID],
                                  onProgress: (Int, Int, Int) -> Void = { _, _, _ in },
                                  identify: (ID) async throws -> Bool) async throws -> (matched: Int, failed: Int) {
        var counts = (matched: 0, failed: 0)
        for (index, id) in ids.enumerated() {
            try Task.checkCancellation()
            do {
                if try await identify(id) { counts.matched += 1 }
            } catch is CancellationError {
                throw CancellationError()
            } catch let error as URLError where error.code == .userAuthenticationRequired {
                throw error
            } catch {
                counts.failed += 1
            }
            onProgress(index + 1, counts.matched, counts.failed)
        }
        try Task.checkCancellation()
        return counts
    }
}
