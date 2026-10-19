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
    @Published var readyToRead: NativeReadingDocument?

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

    /// A copy is only for the optional explicit 'Compartir archivo' action.
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

    /// Import a file into the REAL reader, keeping its original extension.
    /// The manifest id doubles as the library id to prevent duplicate imports
    /// after an interruption between library saving and inbox cleanup.
    @discardableResult
    func importToReader(_ item: NativeShareMessage, library: NativeReaderLibrary) throws -> NativeReadingDocument {
        guard let sharingID = UUID(uuidString: item.id) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        if let existing = library.documents.first(where: { $0.id == sharingID }) {
            complete(item)
            return existing
        }
        switch item.kind {
        case "file":
            guard let source = fileURL(for: item) else { throw CocoaError(.fileNoSuchFile) }
            let originalName = URL(fileURLWithPath: item.name).lastPathComponent
            guard !originalName.isEmpty && originalName != "." && originalName != ".." else {
                throw CocoaError(.fileReadInvalidFileName)
            }
            let temp = FileManager.default.temporaryDirectory
                .appendingPathComponent("SharedReader-" + item.id, isDirectory: true)
            try FileManager.default.createDirectory(
                at: temp, withIntermediateDirectories: true
            )
            defer { try? FileManager.default.removeItem(at: temp) }
            let named = temp.appendingPathComponent(originalName)
            try FileManager.default.copyItem(at: source, to: named)
            try library.importDocuments(from: [named], sharingID: sharingID)
        case "text":
            try library.importSharedText(item.value ?? "", title: item.name,
                                         sharingID: sharingID)
        default:
            throw CocoaError(.fileReadUnsupportedScheme)
        }
        guard let document = library.documents.first(where: { $0.id == sharingID }) else {
            throw CocoaError(.fileReadUnknown)
        }
        complete(item)
        return document
    }

    /// Share files are queued by the iOS share extension without launching our app.
    /// On the next foreground activation, they join the reader automatically.
    /// Only true files/text are consumed. URLs remain in Recibidos for URL actions.
    func importPendingReaderContent(into library: NativeReaderLibrary) {
        refresh()
        let oldToNew = items.reversed()
        var lastImported: NativeReadingDocument?
        var failures: [String] = []
        for item in oldToNew where item.kind == "file" || item.kind == "text" {
            do {
                lastImported = try importToReader(item, library: library)
            } catch {
                failures.append("«\(item.name)»: \(error.localizedDescription)")
            }
        }
        if let lastImported { readyToRead = lastImported }
        if !failures.isEmpty {
            error = "Algunos elementos no se pudieron importar y permanecen en Recibidos. " +
                failures.joined(separator: " ")
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
            if item.kind == "url" {
                guard let value = item.value, let url = URL(string: value),
                      ["https", "http"].contains(url.scheme?.lowercased() ?? "") else {
                    throw URLError(.badURL)
                }
                openURL(url)
                inbox.complete(item)
            } else {
                // EPUB, Office, audio and text all use the same real import path.
                // The hosting NavigationStack opens the imported document directly.
                inbox.readyToRead = try inbox.importToReader(item, library: library)
            }
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
                    "Importa y abre el archivo o texto en TifloLector.")
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
