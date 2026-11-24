import Foundation
import CryptoKit

enum NativeCinemaDecompression {
    static func decode(_ input: Data, gzip: Bool) throws -> Data {
        let limit = gzip ? 1024 * 1024 : 128 * 1024 * 1024
        var output = Data(count: limit)
        var size = limit
        let result = input.withUnsafeBytes { src in
            output.withUnsafeMutableBytes { dst in
                let a = src.bindMemory(to: UInt8.self).baseAddress
                let b = dst.bindMemory(to: UInt8.self).baseAddress
                return gzip ? tiflo_cinema_gzip(a, input.count, b, &size)
                            : tiflo_cinema_bz2(a, input.count, b, &size)
            }
        }
        guard result == 0, size > 0, size <= limit else {
            if result == 1 { throw NativeAudiocinematecaCatalogueError.tooLarge }
            throw NativeAudiocinematecaCatalogueError.invalidCatalogue
        }
        output.count = size
        return output
    }
}

/// Cache only after successful authenticated version check and complete parse.
/// No credentials, media or catalogue are sent to a TifloAcosta server.
actor NativeAudiocinematecaCache {
    static let shared = NativeAudiocinematecaCache()
    private struct Snapshot: Codable {
        let accountID: String
        let version: String
        let compressed: Data
    }
    private static func location() throws -> URL {
        let base = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        return base.appendingPathComponent("audiocinemateca-catalogue-v1.plist")
    }
    static func clear() throws {
        let url = try location()
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }
    private func digest(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
    func refresh(account: NativeAudiocinematecaCredentials.Account) async throws -> [NativeAudiocinematecaCatalogueIndex.Entry] {
        let accountID = digest(Data(account.username.utf8))
        let rawVersion = try await NativeAudiocinematecaCatalogueClient.fetch(.version, account: account)
        let versionData = try NativeCinemaDecompression.decode(rawVersion, gzip: true)
        _ = try JSONSerialization.jsonObject(with: versionData)
        let version = digest(versionData)
        let url = try Self.location()
        if let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
           let length = attributes[.size] as? NSNumber, length.int64Value <= 40 * 1024 * 1024,
           let data = try? Data(contentsOf: url),
           let cache = try? PropertyListDecoder().decode(Snapshot.self, from: data),
           cache.accountID == accountID, cache.version == version,
           let decoded = try? NativeCinemaDecompression.decode(cache.compressed, gzip: false),
           let entries = try? NativeAudiocinematecaCatalogueIndex.parse(decoded), !entries.isEmpty {
            return entries
        }
        let compressed = try await NativeAudiocinematecaCatalogueClient.fetch(.catalogue, account: account)
        let decoded = try NativeCinemaDecompression.decode(compressed, gzip: false)
        let entries = try NativeAudiocinematecaCatalogueIndex.parse(decoded)
        guard !entries.isEmpty else { throw NativeAudiocinematecaCatalogueError.invalidCatalogue }
        // Check current account after suspension before publishing a cache.
        guard let current = NativeAudiocinematecaCredentials.load(),
              current.username == account.username, current.password == account.password else {
            throw NativeAudiocinematecaCatalogueError.invalidAccount
        }
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        let data = try encoder.encode(Snapshot(accountID: accountID, version: version, compressed: compressed))
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        return entries
    }
}
