import Foundation
import Combine
import CryptoKit

struct NativeDownloadedPodcastEpisode: Codable, Identifiable {
    let id: String
    let title: String
    let sourceURL: String
    let filename: String
    let savedAt: Date
}

/// Private, device-local podcast downloads. No URL or episode metadata is sent
/// to any additional service. The original RSS URL is used only to fetch audio.
@MainActor
final class NativePodcastDownloads: ObservableObject {
    @Published private(set) var entries: [NativeDownloadedPodcastEpisode] = []
    @Published private(set) var downloadingID: String?
    @Published var notice = ""
    private let storageKey = "native-podcast-downloads-v1"

    private var folder: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PodcastDownloads", isDirectory: true)
    }

    init() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let values = try? JSONDecoder().decode([NativeDownloadedPodcastEpisode].self, from: data) {
            entries = values.filter {
                FileManager.default.fileExists(atPath: folder.appendingPathComponent($0.filename).path)
            }.sorted { $0.savedAt > $1.savedAt }
        }
    }

    func localURL(for id: String) -> URL? {
        guard let entry = entries.first(where: { $0.id == id }) else { return nil }
        let file = folder.appendingPathComponent(entry.filename)
        return FileManager.default.fileExists(atPath: file.path) ? file : nil
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }

    func download(_ episode: NativePodcastEpisode) async {
        guard downloadingID == nil else {
            notice = "Ya hay una descarga en curso."
            return
        }
        guard episode.audioURL.scheme?.lowercased() == "https" else {
            notice = "Por seguridad, el enlace de descarga debe utilizar HTTPS."
            return
        }
        if localURL(for: episode.id) != nil {
            notice = "Este episodio ya está descargado."
            return
        }
        downloadingID = episode.id
        notice = "Descargando \(episode.title)."
        defer { downloadingID = nil }
        do {
            let request = URLRequest(url: episode.audioURL, cachePolicy: .reloadIgnoringLocalCacheData,
                                     timeoutInterval: 60)
            let (temporary, response) = try await URLSession.shared.download(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            guard let size = (try FileManager.default.attributesOfItem(atPath: temporary.path)[.size]
                              as? NSNumber)?.int64Value, size > 0, size <= 500_000_000 else {
                throw URLError(.dataLengthExceedsMaximum)
            }
            let sourceExtension = episode.audioURL.pathExtension.lowercased()
            let mime = http.mimeType?.lowercased() ?? ""
            let ext: String
            if ["mp3", "m4a", "aac", "wav"].contains(sourceExtension) {
                ext = sourceExtension
            } else if mime == "audio/mpeg" || mime == "audio/mp3" {
                ext = "mp3"
            } else if mime == "audio/mp4" || mime == "audio/x-m4a" {
                ext = "m4a"
            } else if mime == "audio/aac" {
                ext = "aac"
            } else {
                throw URLError(.cannotDecodeContentData)
            }
            try FileManager.default.createDirectory(at: folder,
                withIntermediateDirectories: true)
            let digest = SHA256.hash(data: Data(episode.id.utf8))
                .map { String(format: "%02x", $0) }.joined()
            let filename = digest + "." + ext
            let destination = folder.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: temporary, to: destination)
            entries.removeAll { $0.id == episode.id }
            entries.insert(NativeDownloadedPodcastEpisode(id: episode.id,
                title: episode.title, sourceURL: episode.audioURL.absoluteString,
                filename: filename, savedAt: Date()), at: 0)
            persist()
            notice = "Descarga terminada: \(episode.title)."
        } catch {
            notice = "No se pudo descargar \(episode.title): \(error.localizedDescription)"
        }
    }

    func delete(_ item: NativeDownloadedPodcastEpisode) {
        let url = folder.appendingPathComponent(item.filename)
        do {
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
            entries.removeAll { $0.id == item.id }
            persist()
            notice = "Episodio descargado eliminado: \(item.title)."
        } catch {
            notice = "No se pudo eliminar la descarga: \(error.localizedDescription)"
        }
    }
}
