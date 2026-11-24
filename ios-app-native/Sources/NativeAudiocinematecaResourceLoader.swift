import AVFoundation
import Foundation
import UniformTypeIdentifiers

/// Authenticated Audiocinemateca media, restricted to the publisher origin.
final class NativeAudiocinematecaResourceLoader: NSObject, AVAssetResourceLoaderDelegate {
    private final class NoRedirect: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    }
    private let remoteURL: URL
    private let account: NativeAudiocinematecaCredentials.Account
    private let fileExtension: String
    private let fileID = UUID().uuidString
    private let reportedLength: Int64? = nil
    private let session: URLSession
    private let loaderQueue = DispatchQueue(label: "com.tifloacosta.cinema.audiocinemateca-resource-loader")
    private var active: [ObjectIdentifier: Task<Void, Never>] = [:]
    private static let chunkLimit: Int64 = 256 * 1024

    init?(url: URL, account: NativeAudiocinematecaCredentials.Account, allowsCellular: Bool) {
        guard NativeAudiocinematecaCatalogueIndex.mediaURL(url.absoluteString) == url,
              !account.username.isEmpty, !account.username.contains(":"), !account.password.isEmpty else { return nil }
        self.remoteURL = url
        self.account = account
        self.fileExtension = "mp3"
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        configuration.allowsCellularAccess = allowsCellular
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: configuration, delegate: NoRedirect(), delegateQueue: nil)
        super.init()
    }

    func makeAsset() -> AVURLAsset {
        var parts = URLComponents()
        parts.scheme = "tiflocinema"
        parts.host = "audiocinemateca"
        parts.path = "/media/" + fileID + "." + fileExtension
        let asset = AVURLAsset(url: parts.url!)
        asset.resourceLoader.setDelegate(self, queue: loaderQueue)
        return asset
    }

    private func fetch(offset: Int64, length: Int64) async throws -> (Data, Int64?) {
        guard offset >= 0, length > 0, length <= Self.chunkLimit else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        var request = URLRequest(url: remoteURL)
        request.setValue("bytes=\(offset)-\(offset + length - 1)",
                         forHTTPHeaderField: "Range")
        guard let current = NativeAudiocinematecaCredentials.load(),
              current.username == account.username, current.password == account.password else {
            throw NativeAudiocinematecaCatalogueError.invalidAccount
        }
        request.setValue("Basic " + Data((account.username + ":" + account.password).utf8).base64EncodedString(), forHTTPHeaderField: "Authorization")
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        request.timeoutInterval = 30
        let (bytes, response) = try await session.bytes(for: request)
        guard let http = response as? HTTPURLResponse,
              http.url?.scheme == "https", http.url?.host == "audiocinemateca.com" else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw NativeAudiocinematecaCatalogueError.denied
        }
        if http.statusCode == 404 || http.statusCode == 410 {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        guard http.statusCode == 206,
              let range = http.value(forHTTPHeaderField: "Content-Range"),
              range.hasPrefix("bytes ") else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        let pieces = range.dropFirst(6).split(separator: "/")
        guard pieces.count == 2, let total = Int64(pieces[1]), total > offset else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        let bounds = pieces[0].split(separator: "-")
        guard bounds.count == 2, let first = Int64(bounds[0]), let last = Int64(bounds[1]),
              first == offset, last >= first, last < total, last - first < length else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        var data = Data()
        for try await byte in bytes {
            guard Int64(data.count) < length else { throw NativeAudiocinematecaCatalogueError.tooLarge }
            data.append(byte)
        }
        guard Int64(data.count) == last - first + 1 else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        return (data, total)
    }

    func resourceLoader(_ resourceLoader: AVAssetResourceLoader,
                        shouldWaitForLoadingOfRequestedResource loadingRequest:
                            AVAssetResourceLoadingRequest) -> Bool {
        guard let url = loadingRequest.request.url,
              url.scheme == "tiflocinema",
              url.host == "audiocinemateca",
              url.path == "/media/" + fileID + "." + fileExtension else {
            return false
        }
        let requestID = ObjectIdentifier(loadingRequest)
        active[requestID] = Task { [weak self] in
            guard let self else { return }
            do {
                let dataRequest = loadingRequest.dataRequest
                let initialOffset = max(0, max(dataRequest?.requestedOffset ?? 0,
                                               dataRequest?.currentOffset ?? 0))
                let wanted = Int64(max(0, dataRequest?.requestedLength ?? 0))
                // A content-information-only request still fetches one byte
                // to obtain the authoritative total via Content-Range.
                let count = dataRequest == nil ? 1 : wanted
                var offset = initialOffset
                let upper = initialOffset.addingReportingOverflow(count)
                guard !upper.overflow else {
                    throw NativeAudiocinematecaCatalogueError.invalidResponse
                }
                var totalLength = self.reportedLength
                while offset < upper.partialValue {
                    try Task.checkCancellation()
                    let remaining = upper.partialValue - offset
                    let chunkSize = min(remaining, Self.chunkLimit)
                    let (chunk, remoteLength) = try await self.fetch(
                        offset: offset, length: chunkSize
                    )
                    if let remoteLength, remoteLength > 0 {
                        totalLength = remoteLength
                    }
                    let accepted = self.loaderQueue.sync { () -> Bool in
                        guard !loadingRequest.isCancelled else { return false }
                        if let information = loadingRequest.contentInformationRequest {
                            information.contentType =
                                UTType(filenameExtension: self.fileExtension)?.identifier ??
                                UTType.audio.identifier
                            information.contentLength = totalLength ?? 0
                            information.isByteRangeAccessSupported = true
                        }
                        dataRequest?.respond(with: chunk)
                        return true
                    }
                    if !accepted { break }
                    offset += Int64(chunk.count)
                    // Fewer bytes than requested means end of media.
                    if Int64(chunk.count) < chunkSize { break }
                }
                self.loaderQueue.async {
                    self.active.removeValue(forKey: requestID)
                    if !loadingRequest.isCancelled { loadingRequest.finishLoading() }
                }
            } catch {
                self.loaderQueue.async {
                    self.active.removeValue(forKey: requestID)
                    if !loadingRequest.isCancelled {
                        loadingRequest.finishLoading(with: error)
                    }
                }
            }
        }
        return true
    }

    func resourceLoader(_ resourceLoader: AVAssetResourceLoader,
                        didCancel loadingRequest: AVAssetResourceLoadingRequest) {
        active.removeValue(forKey: ObjectIdentifier(loadingRequest))?.cancel()
    }

    func cancel() {
        loaderQueue.sync {
            for task in active.values { task.cancel() }
            active.removeAll()
        }
        session.invalidateAndCancel()
    }

    deinit {
        session.invalidateAndCancel()
    }
}
