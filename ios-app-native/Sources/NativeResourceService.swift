import Foundation
import SwiftUI
import UIKit
import CryptoKit

enum NativeResourceError: LocalizedError {
    case invalidAddress
    case invalidResponse
    case oversized
    case emptyDocument
    case unavailablePresentation

    var errorDescription: String? {
        switch self {
        case .invalidAddress: return MusicLocalized.message("Este recurso no tiene un enlace de descarga válido.")
        case .invalidResponse: return MusicLocalized.message("No se ha podido obtener el documento. Comprueba la conexión e inténtalo de nuevo.")
        case .oversized: return MusicLocalized.message("El documento supera el límite de 12 MB para esta descarga.")
        case .emptyDocument: return MusicLocalized.message("El documento no contiene texto legible.")
        case .unavailablePresentation: return MusicLocalized.message("No se ha podido abrir el selector de Archivos.")
        }
    }
}

private struct NativeResourcePayload: Codable, Sendable {
    let source: URL
    let data: Data
    let text: String
}

/// A single native route for reading, saving to TifloLector and exporting
/// a document. The original HTML is data, never an embedded HTML interface.
@MainActor
final class NativeResourceService: ObservableObject {
    private var cache: [String: NativeResourcePayload] = [:]
    private var cacheOrder: [String] = []

    private func key(for item: NativeCatalogItem) -> String {
        let identity = item.id + "\n" + (item.resourceURL?.absoluteString ?? "")
        return SHA256.hash(data: Data(identity.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func offlineURL(for item: NativeCatalogItem) -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RecursosSinConexion", isDirectory: true)
            .appendingPathComponent(key(for: item) + ".json")
    }

    func isAvailableOffline(_ item: NativeCatalogItem) -> Bool {
        FileManager.default.fileExists(atPath: offlineURL(for: item).path)
    }

    func saveOffline(_ item: NativeCatalogItem, refresh: Bool = false) async throws {
        let content = try await payload(for: item, refresh: refresh)
        try Task.checkCancellation()
        let destination = offlineURL(for: item)
        try await Task.detached(priority: .utility) {
            var directory = destination.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true // Public editorial copies, not user documents.
            try? directory.setResourceValues(values)
            try Task.checkCancellation()
            try JSONEncoder().encode(content).write(to: destination, options: .atomic)
        }.value
    }

    func removeOffline(_ item: NativeCatalogItem) throws {
        let url = offlineURL(for: item)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        let id = key(for: item)
        cache.removeValue(forKey: id)
        cacheOrder.removeAll { $0 == id }
    }

    private func remember(_ content: NativeResourcePayload, for item: NativeCatalogItem) {
        let id = key(for: item)
        cache[id] = content
        cacheOrder.removeAll { $0 == id }
        cacheOrder.append(id)
        while cacheOrder.count > 4 { cache.removeValue(forKey: cacheOrder.removeFirst()) }
    }

    func text(for item: NativeCatalogItem) async throws -> String {
        try await payload(for: item).text
    }

    func readingContent(for item: NativeCatalogItem) async throws -> (String, [NativeResourceReadingBlock]) {
        let content = try await payload(for: item)
        let blocks = await Task.detached(priority: .userInitiated) {
            NativeResourceReadingBlock.make(data: content.data, source: content.source, fallback: content.text)
        }.value
        return (content.text, blocks)
    }

    func saveInReader(_ item: NativeCatalogItem, library: NativeReaderLibrary) async throws {
        let content = try await text(for: item)
        try library.importSharedText(content, title: item.title)
    }

    func exportToFiles(_ item: NativeCatalogItem) async throws {
        let resource = try await payload(for: item)
        let sourceExtension = resource.source.pathExtension.lowercased()
        let fileExtension = ["html", "htm", "txt", "pdf", "rtf"].contains(sourceExtension)
            ? sourceExtension : "html"
        let safeTitle = item.title
            .replacingOccurrences(of: "[/\\\\:*?\"<>|\\p{C}]", with: "-", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let fileName = String((safeTitle.isEmpty ? "Recurso" : safeTitle).prefix(100))
            + "." + fileExtension
        let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RecursosParaExportar", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let destination = directory.appendingPathComponent(fileName)
        try resource.data.write(to: destination, options: .atomic)

        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
            var presenter = scene.keyWindow?.rootViewController else {
            throw NativeResourceError.unavailablePresentation
        }
        while let presented = presenter.presentedViewController {
            presenter = presented
        }
        let picker = UIDocumentPickerViewController(forExporting: [destination], asCopy: true)
        presenter.present(picker, animated: true)
    }

    private func payload(for item: NativeCatalogItem, refresh: Bool = false) async throws -> NativeResourcePayload {
        if !refresh {
            if let cached = cache[key(for: item)] { return cached }
            let local = offlineURL(for: item)
            if let saved = await Task.detached(priority: .utility, operation: {
                guard let data = try? Data(contentsOf: local, options: .mappedIfSafe) else { return nil as NativeResourcePayload? }
                return try? JSONDecoder().decode(NativeResourcePayload.self, from: data)
            }).value {
                remember(saved, for: item)
                return saved
            }
        }
        guard let source = item.resourceURL,
              ["https", "http"].contains(source.scheme?.lowercased() ?? ""),
              source.host != nil else {
            throw NativeResourceError.invalidAddress
        }
        var request = URLRequest(url: source)
        request.timeoutInterval = 45
        if refresh { request.cachePolicy = .reloadIgnoringLocalCacheData }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            throw NativeResourceError.invalidResponse
        }
        guard data.count <= 12 * 1024 * 1024 else {
            throw NativeResourceError.oversized
        }
        let resolvedSource = response.url ?? source
        guard ["http", "https"].contains(resolvedSource.scheme?.lowercased() ?? ""),
              resolvedSource.host != nil else { throw NativeResourceError.invalidAddress }
        let content = await Task.detached(priority: .userInitiated) {
            NativeDocumentText.extract(data, from: resolvedSource)
        }.value
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeResourceError.emptyDocument
        }
        let result = NativeResourcePayload(source: resolvedSource, data: data, text: content)
        remember(result, for: item)
        return result
    }
}
