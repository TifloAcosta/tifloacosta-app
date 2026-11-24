import AVFoundation
import Foundation
import UniformTypeIdentifiers

/// AVFoundation public-media bridge using its documented resource-loading API.
/// Every chunk is fetched through a bounded Google Drive Range request with
/// the iOS bundle identifier and resource-key header when required.
/// Never forwards a user's OAuth token or uses undocumented AVURLAsset headers.
final class NativeCinemaDriveResourceLoader: NSObject, AVAssetResourceLoaderDelegate {
    private let fileID: String
    private let fileExtension: String
    private let key: String
    private let resourceHeader: String?
    private let reportedLength: Int64?
    private let session: URLSession
    private let loaderQueue = DispatchQueue(label: "com.tifloacosta.cinema.drive-resource-loader")
    private var active: [ObjectIdentifier: Task<Void, Never>] = [:]
    private static let chunkLimit: Int64 = 256 * 1024

    init?(item: NativeCinemaPublicDriveEntry,
          ancestors: [NativeCinemaPublicDriveEntry],
          allowsCellular: Bool) {
        guard !item.isFolder, item.isSupportedMedia,
              let key = NativeCinemaPublicDrive.configuredKey,
              item.id.range(of: #"^[A-Za-z0-9_-]{10,200}$"#,
                            options: .regularExpression) != nil else { return nil }
        self.fileID = item.id
        self.fileExtension = (item.name as NSString).pathExtension.lowercased()
        self.key = key
        self.reportedLength = item.size
        self.resourceHeader = (ancestors + [item]).compactMap { entry in
            guard let secret = entry.resourceKey else { return nil }
            return entry.id + "/" + secret
        }.joined(separator: ",")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.allowsCellularAccess = allowsCellular
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: configuration)
        super.init()
    }

    func makeAsset() -> AVURLAsset {
        var parts = URLComponents()
        parts.scheme = "tiflocinema"
        parts.host = "google-drive"
        parts.path = "/media/" + fileID + "." + fileExtension
        let asset = AVURLAsset(url: parts.url!)
        asset.resourceLoader.setDelegate(self, queue: loaderQueue)
        return asset
    }

    private var googleURL: URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "www.googleapis.com"
        components.path = "/drive/v3/files/" + fileID
        components.queryItems = [
            URLQueryItem(name: "alt", value: "media"),
            URLQueryItem(name: "key", value: key)
        ]
        return components.url!
    }

    private func fetch(offset: Int64, length: Int64) async throws -> (Data, Int64?) {
        guard offset >= 0, length > 0, length <= Self.chunkLimit else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        var request = URLRequest(url: googleURL)
        request.setValue("bytes=\(offset)-\(offset + length - 1)",
                         forHTTPHeaderField: "Range")
        request.setValue(Bundle.main.bundleIdentifier ?? "com.tifloacosta.app",
                         forHTTPHeaderField: "X-Ios-Bundle-Identifier")
        if let resourceHeader, !resourceHeader.isEmpty {
            request.setValue(resourceHeader,
                             forHTTPHeaderField: "X-Goog-Drive-Resource-Keys")
        }
        request.timeoutInterval = 30
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse,
              http.url?.scheme == "https", http.url?.host == "www.googleapis.com" else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw NativeCinemaPublicDriveError.denied
        }
        if http.statusCode == 404 || http.statusCode == 410 {
            throw NativeCinemaPublicDriveError.noLongerAvailable
        }
        // For large media, refusing a 200 response avoids treating a
        // full-file transfer as a chunk or silently downloading the movie.
        guard http.statusCode == 206,
              !data.isEmpty, Int64(data.count) <= length else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        let contentRange = http.value(forHTTPHeaderField: "Content-Range") ?? ""
        let total = contentRange.split(separator: "/").last.flatMap {
            Int64(String($0))
        }
        return (data, total)
    }

    func resourceLoader(_ resourceLoader: AVAssetResourceLoader,
                        shouldWaitForLoadingOfRequestedResource loadingRequest:
                            AVAssetResourceLoadingRequest) -> Bool {
        guard let url = loadingRequest.request.url,
              url.scheme == "tiflocinema",
              url.host == "google-drive",
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
                    throw NativeCinemaPublicDriveError.badResponse
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
