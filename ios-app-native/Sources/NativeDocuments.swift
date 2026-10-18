import SwiftUI
import Foundation
import UIKit

/// Transforms source document HTML into plain text before SwiftUI presents it.
/// No HTML UI, WebView, DOM controls, or second screen hierarchy is instantiated.
enum NativeDocumentText {
    static func extract(_ data: Data, from url: URL) -> String {
        let format: NSAttributedString.DocumentType =
            url.pathExtension.lowercased() == "rtf" ? .rtf : .html
        let attributes: [NSAttributedString.DocumentReadingOptionKey: Any] = [
            .documentType: format,
            .characterEncoding: String.Encoding.utf8.rawValue
        ]
        if let rich = try? NSAttributedString(data: data, options: attributes,
                                            documentAttributes: nil) {
            return rich.string.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        // Safe fallback for a malformed document. Never expose tags as UI widgets.
        let raw = String(decoding: data, as: UTF8.self)
        return raw.replacingOccurrences(
            of: "<[^>]+>", with: " ", options: .regularExpression
        ).replacingOccurrences(
            of: "\\s+", with: " ", options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct NativeRemoteResourceScreen: View {
    let item: NativeCatalogItem
    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.openURL) private var openURL
    @State private var documentText = ""
    @State private var error: String?
    @State private var loading = true
    @State private var imported = false

    private func load() async {
        guard let url = item.resourceURL,
              ["https", "http"].contains(url.scheme?.lowercased() ?? "") else {
            error = "El recurso no tiene una dirección compatible."
            loading = false
            return
        }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  data.count <= 8 * 1024 * 1024 else {
                throw URLError(.badServerResponse)
            }
            documentText = NativeDocumentText.extract(data, from: url)
            if documentText.isEmpty { throw URLError(.cannotDecodeContentData) }
            error = nil
        } catch {
            self.error = "No se pudo obtener el texto de este recurso."
        }
        loading = false
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.title).font(.title2).bold()
                if loading { ProgressView("Abriendo recurso") }
                if let error {
                    Text(error)
                    if let url = item.resourceURL {
                        Button("Abrir fuente externa") { openURL(url) }
                    }
                }
                if !documentText.isEmpty {
                    Text(documentText)
                        .font(.body)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                    Button(imported ? "Guardado en TifloLector" : "Guardar en TifloLector") {
                        do {
                            try library.importSharedText(documentText, title: item.title)
                            imported = true
                        } catch {
                            self.error = error.localizedDescription
                        }
                    }
                    .disabled(imported)
                }
            }
            .padding()
        }
        .navigationTitle(item.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url = item.resourceURL {
                Button("Compartir", systemImage: "square.and.arrow.up") {
                    NativeShare.present(url: url)
                }
            }
        }
        .task(id: item.id) { await load() }
    }
}
