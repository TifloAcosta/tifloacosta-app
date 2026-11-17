import SwiftUI
import UniformTypeIdentifiers

private struct MusicLocalFile: Identifiable, Codable {
    let id: UUID
    let name: String
    let fileName: String
}

@MainActor
private final class NativeMusicLibrary: ObservableObject {
    @Published private(set) var files: [MusicLocalFile] = []
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
    }
}

struct NativeMyMusicScreen: View {
    @StateObject private var library = NativeMusicLibrary()
    @State private var isImporting = false

    var body: some View {
        List {
            Section {
                Button("Importar canciones") { isImporting = true }
                    .accessibilityHint("Selecciona archivos de audio. Los originales se conservarán en su ubicación.")
            }
            Section("Mi biblioteca") {
                if library.files.isEmpty {
                    Text("Todavía no hay canciones. Usa Importar canciones para añadir música.")
                } else {
                    ForEach(library.files) { file in
                        Text(file.name).accessibilityLabel("Canción, \(file.name)")
                    }
                }
            }
        }
        .navigationTitle("Mi Música")
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
