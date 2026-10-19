import Foundation
import SwiftUI
import UIKit

enum NativeResourceError: LocalizedError {
    case invalidAddress
    case invalidResponse
    case oversized
    case emptyDocument
    case unavailablePresentation

    var errorDescription: String? {
        switch self {
        case .invalidAddress: return "Este recurso no tiene un enlace de descarga válido."
        case .invalidResponse: return "No se ha podido obtener el documento. Comprueba la conexión e inténtalo de nuevo."
        case .oversized: return "El documento supera el límite de 12 MB para esta descarga."
        case .emptyDocument: return "El documento no contiene texto legible."
        case .unavailablePresentation: return "No se ha podido abrir el selector de Archivos."
        }
    }
}

private struct NativeResourcePayload {
    let source: URL
    let data: Data
    let text: String
}

/// A single native route for reading, saving to TifloLector and exporting
/// a document. The original HTML is data, never an embedded HTML interface.
@MainActor
final class NativeResourceService: ObservableObject {
    private var cache: [String: NativeResourcePayload] = [:]

    func text(for item: NativeCatalogItem) async throws -> String {
        try await payload(for: item).text
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

    private func payload(for item: NativeCatalogItem) async throws -> NativeResourcePayload {
        if let cached = cache[item.id] { return cached }
        guard let source = item.resourceURL,
              ["https", "http"].contains(source.scheme?.lowercased() ?? ""),
              source.host != nil else {
            throw NativeResourceError.invalidAddress
        }
        var request = URLRequest(url: source)
        request.timeoutInterval = 45
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            throw NativeResourceError.invalidResponse
        }
        guard data.count <= 12 * 1024 * 1024 else {
            throw NativeResourceError.oversized
        }
        let content = await Task.detached(priority: .userInitiated) {
            NativeDocumentText.extract(data, from: source)
        }.value
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeResourceError.emptyDocument
        }
        let result = NativeResourcePayload(source: source, data: data, text: content)
        cache[item.id] = result
        return result
    }
}
