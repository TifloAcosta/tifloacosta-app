import Foundation
import SwiftUI

/// Reads the same private App Group inbox as the existing iOS share extension.
/// It never clears items on inspection; an item is removed only after a successful import
/// or an explicit user action.
struct NativeShareMessage: Decodable, Identifiable {
    let id: String
    let kind: String
    let name: String
    let value: String?
    let storedName: String?
    let createdAt: String?
}

@MainActor
final class NativeShareInbox: ObservableObject {
    @Published private(set) var items: [NativeShareMessage] = []
    @Published private(set) var error: String?

    private var inboxURL: URL? {
        FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.tifloacosta.app"
        )?.appendingPathComponent("ShareInbox", isDirectory: true)
    }

    func refresh() {
        guard let root = inboxURL else {
            error = "La extensión Compartir necesita el App Group de Apple."
            return
        }
        let manifests = (try? FileManager.default.contentsOfDirectory(
            at: root, includingPropertiesForKeys: nil
        )) ?? []
        items = manifests
            .filter { $0.pathExtension.lowercased() == "json" }
            .compactMap { url -> NativeShareMessage? in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return try? JSONDecoder().decode(NativeShareMessage.self, from: data)
            }
            .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
        error = nil
    }

    func fileURL(for item: NativeShareMessage) -> URL? {
        guard let root = inboxURL, let storedName = item.storedName,
              !storedName.contains("/") && !storedName.contains("..") else { return nil }
        return root.appendingPathComponent(storedName)
    }

    // Los EPUB se reciben y se conservan sin fingir que el lector nativo
    // ya puede interpretar su contenido. El usuario puede exportar el archivo.
    func exportURL(for item: NativeShareMessage) -> URL? {
        guard item.kind == "file", let source = fileURL(for: item) else { return nil }
        let safeName = URL(fileURLWithPath: item.name).lastPathComponent
        let directory = FileManager.default.urls(for: .cachesDirectory,
            in: .userDomainMask)[0].appendingPathComponent("SharedExports", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let destination = directory.appendingPathComponent(item.id + "-" + safeName)
            if !FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.copyItem(at: source, to: destination)
            }
            return destination
        } catch {
            return nil
        }
    }

    func complete(_ item: NativeShareMessage) {
        guard let root = inboxURL else { return }
        try? FileManager.default.removeItem(at: root.appendingPathComponent(item.id + ".json"))
        if let file = fileURL(for: item) {
            try? FileManager.default.removeItem(at: file)
        }
        refresh()
    }
}

struct NativeInboxScreen: View {
    @EnvironmentObject private var inbox: NativeShareInbox
    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.openURL) private var openURL
    @State private var importError: String?

    private func perform(_ item: NativeShareMessage) {
        do {
            switch item.kind {
            case "file":
                guard let url = inbox.fileURL(for: item) else {
                    throw CocoaError(.fileNoSuchFile)
                }
                let fileName = URL(fileURLWithPath: item.name).lastPathComponent
                if URL(fileURLWithPath: fileName).pathExtension.lowercased() == "epub" {
                    guard let exported = inbox.exportURL(for: item) else {
                        throw CocoaError(.fileNoSuchFile)
                    }
                    // La compatibilidad de lectura EPUB se abordará en TifloLector.
                    // Compartir/exportar el original no lo elimina de Recibidos.
                    NativeShare.present(url: exported)
                    return
                }
                // Use a temporary copy with the original extension so the reader
                // can detect PDF/text correctly; never reinterpret a binary as text.
                let temporary = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
                let named = temporary.appendingPathComponent(fileName)
                try FileManager.default.copyItem(at: url, to: named)
                defer { try? FileManager.default.removeItem(at: temporary) }
                try library.importDocuments(from: [named])
            case "text":
                try library.importSharedText(item.value ?? "", title: item.name)
            case "url":
                guard let value = item.value, let url = URL(string: value),
                      ["https", "http"].contains(url.scheme?.lowercased() ?? "") else {
                    throw URLError(.badURL)
                }
                // This opens in a supported browser/app rather than loading an
                // HTML interface or hiding a web view underneath native screens.
                openURL(url)
            default:
                throw CocoaError(.fileReadUnsupportedScheme)
            }
            inbox.complete(item)
        } catch {
            importError = "No se pudo abrir «\(item.name)»: \(error.localizedDescription). El elemento permanece en Recibidos."
        }
    }

    var body: some View {
        List {
            if let error = inbox.error {
                Text(error).foregroundStyle(.secondary)
            }
            if inbox.items.isEmpty {
                Text("No hay elementos pendientes.")
            }
            ForEach(inbox.items) { item in
                Button {
                    perform(item)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name).font(.body)
                        Text(item.kind == "url" ? "Abrir enlace" : "Importar en TifloLector")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .accessibilityLabel(item.name)
                .accessibilityHint(item.kind == "url" ? "Abre el enlace recibido." :
                    item.name.lowercased().hasSuffix(".epub")
                        ? "Doble toque para compartir o guardar el EPUB original. Se conserva en Recibidos hasta que lo elimines."
                        : "Importa el archivo o texto a TifloLector.")
                .accessibilityAction(named: Text("Compartir archivo")) {
                    if let exported = inbox.exportURL(for: item) {
                        NativeShare.present(url: exported)
                    }
                }
                .accessibilityAction(named: Text("Eliminar de Recibidos")) {
                    inbox.complete(item)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Recibidos")
        .toolbar { Button("Actualizar") { inbox.refresh() } }
        .onAppear { inbox.refresh() }
        .alert("No se pudo completar", isPresented: Binding(
            get: { importError != nil },
            set: { if !$0 { importError = nil } }
        )) {
            Button("Aceptar", role: .cancel) { importError = nil }
        } message: {
            Text(importError ?? "")
        }
    }
}
