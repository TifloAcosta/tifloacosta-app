import Foundation
import SwiftUI
import UIKit

/// Reads the same private App Group inbox as the existing iOS share extension.
/// It never clears items on inspection; an item is removed only after a successful import
/// or an explicit user action.
struct NativeShareMessage: Decodable, Identifiable {
    let id: String
    let kind: String
    let destination: String?
    let name: String
    let value: String?
    let storedName: String?
    let createdAt: String?
    // Optional for compatibility with manifests created by previous releases.
    let batchID: String?
    let batchIndex: String?
    let batchCount: String?

    var batchPosition: Int? {
        guard let raw = batchIndex, let index = Int(raw) else { return nil }
        return index + 1
    }

    var isAudioFile: Bool {
        guard kind == "file" else { return false }
        let extensions: Set<String> = [
            "mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf", "flac"
        ]
        return extensions.contains(URL(fileURLWithPath: name).pathExtension.lowercased())
    }

    var needsAudioDestination: Bool {
        isAudioFile && (destination == nil || destination == "pending")
    }
}

@MainActor
final class NativeShareInbox: ObservableObject {
    @Published private(set) var items: [NativeShareMessage] = []
    @Published private(set) var error: String?
    @Published private(set) var importSummary: String?
    @Published private(set) var readerImportProgress: String?
    @Published private(set) var activeReaderImportID: String?
    @Published var readyToRead: NativeReadingDocument?
    private var lastReaderAnnouncement = Date.distantPast

    private func reportReaderProgress(_ message: String) {
        readerImportProgress = message
        if NativeReaderFeedback.spokenAnnouncementsEnabled,
           Date().timeIntervalSince(lastReaderAnnouncement) >= 3 {
            lastReaderAnnouncement = Date()
            UIAccessibility.post(notification: .announcement, argument: message)
        }
    }

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
            .sorted { left, right in
                // Newest first across shares. For items saved in the same second,
                // reverse the batch index so importPendingReaderContent.reversed()
                // replays attachments in their original order.
                if left.createdAt != right.createdAt {
                    return (left.createdAt ?? "") > (right.createdAt ?? "")
                }
                if left.batchID == right.batchID,
                   let a = Int(left.batchIndex ?? ""), let b = Int(right.batchIndex ?? ""),
                   a != b {
                    return a > b
                }
                return left.id > right.id
            }
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
    func importToReader(_ item: NativeShareMessage, library: NativeReaderLibrary,
                        position: Int = 1, total: Int = 1) async throws -> NativeReadingDocument {
        guard let sharingID = UUID(uuidString: item.id) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        guard activeReaderImportID == nil else { throw CocoaError(.fileWriteFileExists) }
        activeReaderImportID = item.id
        defer {
            readerImportProgress = nil
            activeReaderImportID = nil
        }
        if let existing = library.documents.first(where: { $0.id == sharingID }) {
            complete(item)
            return existing
        }
        let started = MusicLocalized.format("Importando %d de %d: %@", position, total, item.name)
        if position == 1 { lastReaderAnnouncement = .distantPast }
        reportReaderProgress(started)
        switch item.kind {
        case "file":
            guard let source = fileURL(for: item) else { throw CocoaError(.fileNoSuchFile) }
            let originalName = URL(fileURLWithPath: item.name).lastPathComponent
            guard !originalName.isEmpty && originalName != "." && originalName != ".." else {
                throw CocoaError(.fileReadInvalidFileName)
            }
            try await library.importFile(from: source, sharingID: sharingID,
                                         originalName: originalName) { message in
                self.reportReaderProgress(message)
            }
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

    /// A chosen music destination is consumed on the next app activation;
    /// the inbox payload remains untouched until the library commit succeeds.
    func importToMusic(_ item: NativeShareMessage) throws {
        guard item.isAudioFile, let source = fileURL(for: item),
              let sharingID = UUID(uuidString: item.id) else {
            throw CocoaError(.fileReadUnsupportedScheme)
        }
        let safeName = URL(fileURLWithPath: item.name).lastPathComponent
        guard !safeName.isEmpty && safeName != "." && safeName != ".." else {
            throw CocoaError(.fileReadInvalidFileName)
        }
        let temp = FileManager.default.temporaryDirectory
            .appendingPathComponent("SharedMusic-" + item.id, isDirectory: true)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temp) }
        let named = temp.appendingPathComponent(safeName)
        // Avoid a second large data copy on the same volume where possible.
        do { try FileManager.default.linkItem(at: source, to: named) }
        catch { try FileManager.default.copyItem(at: source, to: named) }
        try NativeMusicSharedAudio.importFile(named, sharingID: sharingID)
        complete(item)
    }

    /// Automatically fulfill explicit "Mi música" choices from the extension.
    /// Unchosen audio never gets routed to the reader or music silently.
    @discardableResult
    func importPendingMusicContent() -> Bool {
        refresh()
        let selected = items.reversed().filter {
            $0.kind == "file" && $0.isAudioFile && $0.destination == "music"
        }
        guard !selected.isEmpty else { return false }
        var imported = 0
        var failed: [String] = []
        for item in selected {
            do {
                try importToMusic(item)
                imported += 1
            } catch {
                failed.append("«\(item.name)»: \(error.localizedDescription)")
            }
        }
        importSummary = MusicLocalized.format(
            "Audios recibidos en Mi música: %d. Fallidos: %d.",
            imported, failed.count)
        if !failed.isEmpty {
            error = MusicLocalized.message(
                "Los audios fallidos permanecen en Recibidos para reintentar.")
                + " " + failed.joined(separator: " ")
        }
        if NativeReaderFeedback.spokenAnnouncementsEnabled {
            UIAccessibility.post(notification: .announcement, argument: importSummary)
        }
        return imported > 0
    }

    private var readerBatchRunning = false

    /// One deliberate batch action applies the chosen destination to all
    /// otherwise pending audio files; errors retain their original manifests.
    func importPendingAudioBatch(to destination: String,
                                 library: NativeReaderLibrary) async {
        guard !readerBatchRunning, activeReaderImportID == nil else { return }
        readerBatchRunning = true
        defer { readerBatchRunning = false }
        guard destination == "music" || destination == "reader" else { return }
        refresh()
        let pending = items.reversed().filter { $0.needsAudioDestination }
        guard !pending.isEmpty else { return }
        var count = 0
        var failed: [String] = []
        var lastReader: NativeReadingDocument?
        for (index, item) in pending.enumerated() {
            if Task.isCancelled { break }
            do {
                if destination == "music" {
                    try importToMusic(item)
                } else {
                    lastReader = try await importToReader(item, library: library,
                                                         position: index + 1, total: pending.count)
                }
                count += 1
            } catch {
                failed.append("«\(item.name)»: \(error.localizedDescription)")
            }
        }
        if let lastReader { readyToRead = lastReader }
        let template = destination == "music"
            ? "Audios recibidos en Mi música: %d. Fallidos: %d."
            : "Documentos recibidos importados: %d. Fallidos: %d."
        importSummary = MusicLocalized.format(template, count, failed.count)
        if !failed.isEmpty {
            error = MusicLocalized.message(
                "Los audios fallidos permanecen en Recibidos para reintentar.")
                + " " + failed.joined(separator: " ")
        }
        if NativeReaderFeedback.spokenAnnouncementsEnabled {
            UIAccessibility.post(notification: .announcement, argument: importSummary)
        }
    }

    /// Share files are queued by the iOS share extension without launching our app.
    /// On the next foreground activation, they join the reader automatically.
    /// Only true files/text are consumed. URLs remain in Recibidos for URL actions.
    func importPendingReaderContent(into library: NativeReaderLibrary) async {
        guard !readerBatchRunning, activeReaderImportID == nil else { return }
        readerBatchRunning = true
        defer { readerBatchRunning = false }
        refresh()
        let pending = items.reversed().filter { item in
            (item.kind == "file" || item.kind == "text")
                && item.destination != "pending" && item.destination != "music"
                && !item.needsAudioDestination
        }
        var lastImported: NativeReadingDocument?
        var importedCount = 0
        var failures: [String] = []
        for (index, item) in pending.enumerated() {
            if Task.isCancelled { break }
            do {
                lastImported = try await importToReader(item, library: library,
                                                       position: index + 1, total: pending.count)
                importedCount += 1
            } catch {
                failures.append("«\(item.name)»: \(error.localizedDescription)")
            }
        }
        if let lastImported { readyToRead = lastImported }
        if importedCount > 0 || !failures.isEmpty {
            importSummary = MusicLocalized.format(
                "Documentos recibidos importados: %d. Fallidos: %d.",
                importedCount, failures.count)
            // One optional end-of-batch cue; no sounds on individual files.
            NativeReaderFeedback.confirm(failures.isEmpty ? .imported : .error)
            if NativeReaderFeedback.spokenAnnouncementsEnabled {
                UIAccessibility.post(notification: .announcement, argument: importSummary)
            }
        }
        if !failures.isEmpty {
            error = MusicLocalized.message("Algunos elementos no se pudieron importar y permanecen en Recibidos.")
                + " " + failures.joined(separator: " ")
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
    @State private var pendingAudioChoice: NativeShareMessage?
    @State private var pendingDeletion: NativeShareMessage?

    private func perform(_ item: NativeShareMessage, destination: String? = nil) async {
        if destination == nil && item.needsAudioDestination {
            pendingAudioChoice = item
            return
        }
        do {
            if item.kind == "url" {
                guard let value = item.value, let url = URL(string: value),
                      ["https", "http"].contains(url.scheme?.lowercased() ?? "") else {
                    throw URLError(.badURL)
                }
                openURL(url)
                inbox.complete(item)
            } else if destination == "music" || (destination == nil && item.destination == "music") {
                try inbox.importToMusic(item)
            } else {
                inbox.readyToRead = try await inbox.importToReader(item, library: library)
            }
        } catch {
            importError = MusicLocalized.format("No se pudo abrir «%@»: %@. El elemento permanece en Recibidos.",
                                                item.name, error.localizedDescription)
            if NativeReaderFeedback.spokenAnnouncementsEnabled {
                UIAccessibility.post(notification: .announcement, argument: importError)
            }
        }
    }

    var body: some View {
        List {
            let unassignedAudioCount = inbox.items.filter { $0.needsAudioDestination }.count
            if unassignedAudioCount > 1 {
                Section("Audios pendientes") {
                    Button("Importar todos los audios pendientes en Mi música") {
                        Task { await inbox.importPendingAudioBatch(to: "music", library: library) }
                    }
                    Button("Importar todos los audios pendientes en TifloLector") {
                        Task { await inbox.importPendingAudioBatch(to: "reader", library: library) }
                    }
                }
            }
            if let progress = inbox.readerImportProgress {
                ProgressView {
                    Text(progress)
                }
            }
            if let summary = inbox.importSummary {
                Text(summary)
                    .font(.footnote)
                    .accessibilityLabel(summary)
            }
            if let error = inbox.error {
                Text(error).foregroundStyle(.secondary)
            }
            if inbox.items.isEmpty {
                Text("No hay elementos pendientes.")
            }
            ForEach(inbox.items) { item in
                Button {
                    Task { await perform(item) }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name).font(.body)
                        if let position = item.batchPosition,
                           let count = item.batchCount, !count.isEmpty {
                            Text("Archivo \(position) de \(count)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Text(item.kind == "url" ? "Abrir enlace" :
                            item.needsAudioDestination ? "Elegir destino del audio" :
                            item.destination == "music" ? "Importar en Mi música" :
                            "Importar en TifloLector")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .disabled(inbox.activeReaderImportID == item.id)
                .accessibilityLabel(item.batchPosition.map { position in
                    "\(item.name). Archivo \(position) de \(item.batchCount ?? "?")"
                } ?? item.name)
                .accessibilityHint(item.kind == "url" ? "Abre el enlace recibido." :
                    item.needsAudioDestination ? "Elige TifloLector o Mi música." :
                    item.destination == "music" ? "Importa el audio en Mi música." :
                    "Importa y abre el archivo o texto en TifloLector.")
                .accessibilityAction(named: Text("Compartir archivo")) {
                    if let exported = inbox.exportURL(for: item) {
                        NativeShare.present(url: exported)
                    }
                }
                .accessibilityAction(named: Text("Eliminar de Recibidos")) {
                    if inbox.activeReaderImportID != item.id { pendingDeletion = item }
                }
            }
        }
        .tifloScreenSurface()
        .confirmationDialog("¿Dónde guardar el audio?", isPresented: Binding(
            get: { pendingAudioChoice != nil },
            set: { if !$0 { pendingAudioChoice = nil } }
        )) {
            Button("TifloLector") {
                if let item = pendingAudioChoice { Task { await perform(item, destination: "reader") } }
                pendingAudioChoice = nil
            }
            Button("Mi música") {
                if let item = pendingAudioChoice { Task { await perform(item, destination: "music") } }
                pendingAudioChoice = nil
            }
            Button("Cancelar", role: .cancel) { pendingAudioChoice = nil }
        } message: {
            Text("Selecciona dónde importar el archivo de audio.")
        }
        .confirmationDialog(MusicLocalized.format("¿Eliminar «%@»?", pendingDeletion?.name ?? ""), isPresented: Binding(
            get: { pendingDeletion != nil },
            set: { if !$0 { pendingDeletion = nil } }
        ), titleVisibility: .visible) {
            Button("Eliminar de Recibidos", role: .destructive) {
                if let item = pendingDeletion, inbox.activeReaderImportID != item.id { inbox.complete(item) }
                pendingDeletion = nil
            }
            Button("Cancelar", role: .cancel) { pendingDeletion = nil }
        }
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
