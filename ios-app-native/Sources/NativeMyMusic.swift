import SwiftUI
import UniformTypeIdentifiers

private struct MusicLocalFile: Identifiable, Codable {
    let id: UUID
    let name: String
    let fileName: String
}

private struct MusicVirtualFolder: Identifiable, Codable {
    let id: UUID
    var name: String
    var trackIds: [UUID]
}

@MainActor
private final class NativeMusicLibrary: ObservableObject {
    @Published private(set) var files: [MusicLocalFile] = []
    @Published private(set) var folders: [MusicVirtualFolder] = []
    @Published var error: String?

    private var directory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MiMusica", isDirectory: true)
    }

    init() {
        let manifest = directory.appendingPathComponent("library.json")
        if let data = try? Data(contentsOf: manifest),
           let decoded = try? JSONDecoder().decode([MusicLocalFile].self, from: data) {
            files = decoded
        }
        let folderManifest = directory.appendingPathComponent("folders.json")
        if let data = try? Data(contentsOf: folderManifest),
           let decoded = try? JSONDecoder().decode([MusicVirtualFolder].self, from: data) {
            folders = decoded
        }
    }

    func importFiles(_ urls: [URL]) {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            for url in urls {
                let allowed = ["mp3", "m4a", "aac", "wav", "flac"]
                guard allowed.contains(url.pathExtension.lowercased()) else { continue }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                let fileName = UUID().uuidString + "." + url.pathExtension.lowercased()
                let target = directory.appendingPathComponent(fileName)
                try FileManager.default.copyItem(at: url, to: target)
                files.append(MusicLocalFile(id: UUID(), name: url.deletingPathExtension().lastPathComponent, fileName: fileName))
            }
            try save()
        } catch {
            self.error = "No se pudo importar la música: \(error.localizedDescription)"
        }
    }

    private func save() throws {
        let data = try JSONEncoder().encode(files)
        try data.write(to: directory.appendingPathComponent("library.json"), options: .atomic)
        try JSONEncoder().encode(folders).write(to: directory.appendingPathComponent("folders.json"), options: .atomic)
    }

    func addFolder(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        folders.append(MusicVirtualFolder(id: UUID(), name: trimmed, trackIds: []))
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func assign(_ trackId: UUID, to folderId: UUID) {
        guard let index = folders.firstIndex(where: { $0.id == folderId }) else { return }
        if !folders[index].trackIds.contains(trackId) { folders[index].trackIds.append(trackId) }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removeFolder(_ id: UUID) {
        folders.removeAll { $0.id == id }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removeFromLibrary(_ id: UUID) {
        files.removeAll { $0.id == id }
        for index in folders.indices { folders[index].trackIds.removeAll { $0 == id } }
        do { try save() } catch { self.error = error.localizedDescription }
    }
}

struct NativeMyMusicScreen: View {
    @StateObject private var library = NativeMusicLibrary()
    @State private var isImporting = false
    @State private var searchText = ""
    @State private var newFolderName = ""
    @State private var showingFolderEditor = false
    @State private var pendingRemoval: MusicLocalFile?

    private var visibleFiles: [MusicLocalFile] {
        let query = searchText.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return library.files.filter {
            query.isEmpty || $0.name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current).contains(query)
        }
    }

    var body: some View {
        List {
            Section {
                Button("Importar canciones") { isImporting = true }
                    .accessibilityHint("Selecciona archivos de audio. Los originales se conservarán en su ubicación.")
                Button("Crear carpeta") { showingFolderEditor = true }
            }
            Section("Mis carpetas") {
                ForEach(library.folders) { folder in
                    HStack {
                        Text("\(folder.name), \(folder.trackIds.count) canciones")
                        Spacer()
                        Button("Eliminar carpeta \(folder.name)") { library.removeFolder(folder.id) }
                            .accessibilityHint("Solo elimina esta carpeta virtual; las canciones se conservan.")
                    }
                }
            }
            Section("Mi biblioteca") {
                if library.files.isEmpty {
                    Text("Todavía no hay canciones. Usa Importar canciones para añadir música.")
                } else {
                    ForEach(visibleFiles) { file in
                        HStack {
                            Text(file.name).accessibilityLabel("Canción, \(file.name)")
                            Spacer()
                            Menu("Acciones de \(file.name)") {
                                ForEach(library.folders) { folder in
                                    Button("Añadir a \(folder.name)") { library.assign(file.id, to: folder.id) }
                                }
                                Button("Eliminar de la biblioteca", role: .destructive) { pendingRemoval = file }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Mi Música")
        .searchable(text: $searchText, prompt: "Buscar canciones")
        .alert("Crear carpeta", isPresented: $showingFolderEditor) {
            TextField("Nombre de la carpeta", text: $newFolderName)
            Button("Crear") { library.addFolder(newFolderName); newFolderName = "" }
            Button("Cancelar", role: .cancel) { newFolderName = "" }
        } message: {
            Text("La carpeta será virtual y no modificará tus archivos originales.")
        }
        .confirmationDialog("Eliminar de la biblioteca", isPresented: Binding(
            get: { pendingRemoval != nil },
            set: { if !$0 { pendingRemoval = nil } }
        )) {
            Button("Eliminar de la biblioteca", role: .destructive) {
                if let file = pendingRemoval { library.removeFromLibrary(file.id) }
                pendingRemoval = nil
            }
        } message: {
            Text("La canción dejará de aparecer en Mi Música, pero no se borrará el archivo original.")
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.audio], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls): library.importFiles(urls)
            case .failure(let error): library.error = error.localizedDescription
            }
        }
        .alert("Importación de música", isPresented: Binding(
            get: { library.error != nil },
            set: { if !$0 { library.error = nil } }
        )) {
            Button("Aceptar") { library.error = nil }
        } message: {
            Text(library.error ?? "")
        }
    }
}
