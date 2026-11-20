import SwiftUI

private struct ArchiveSearchResponse: Decodable {
    struct Response: Decodable {
        let docs: [ArchiveRecording]
    }
    let response: Response
}

private struct ArchiveRecording: Decodable, Identifiable {
    let identifier: String
    let title: String?
    var id: String { identifier }
    var displayTitle: String { title.flatMap { $0.isEmpty ? nil : $0 } ?? identifier }
}

private struct ArchiveItemMetadata: Decodable {
    struct AudioFile: Decodable, Identifiable {
        let name: String
        let format: String?
        let privateFile: String?
        enum CodingKeys: String, CodingKey {
            case name, format
            case privateFile = "private"
        }
        var id: String { name }
        var playable: Bool {
            guard privateFile != "true" else { return false }
            let lower = name.lowercased()
            return lower.hasSuffix(".mp3") || lower.hasSuffix(".m4a")
        }
    }
    let files: [AudioFile]?
}

@MainActor
private final class NativeArchiveDirectory: ObservableObject {
    @Published private(set) var items: [ArchiveRecording] = []
    @Published private(set) var loading = false
    @Published var error: String?

    func search(_ text: String) async {
        loading = true
        defer { loading = false }
        let term = text.filter { $0.isLetter || $0.isNumber || $0.isWhitespace || $0 == "-" }
            .trimmingCharacters(in: .whitespacesAndNewlines)
        var url = URLComponents(string: "https://archive.org/advancedsearch.php")!
        let query = term.isEmpty ? "collection:etree" :
            "collection:etree AND (title:(\(term)) OR creator:(\(term)))"
        url.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "fl[]", value: "identifier"),
            URLQueryItem(name: "fl[]", value: "title"),
            URLQueryItem(name: "rows", value: "30"),
            URLQueryItem(name: "sort[]", value: "downloads desc"),
            URLQueryItem(name: "output", value: "json")
        ]
        guard let target = url.url else { error = "No se pudo preparar la consulta."; return }
        do {
            var request = URLRequest(url: target)
            request.timeoutInterval = 20
            let (bytes, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let parsed = try JSONDecoder().decode(ArchiveSearchResponse.self, from: bytes)
            items = parsed.response.docs.filter { !$0.identifier.isEmpty }
            error = items.isEmpty ? "No se encontraron grabaciones." : nil
        } catch {
            items = []
            self.error = "No se pudieron consultar las grabaciones. Comprueba la conexión."
        }
    }
}

@MainActor
private final class NativeArchiveTracks: ObservableObject {
    @Published private(set) var files: [ArchiveItemMetadata.AudioFile] = []
    @Published private(set) var loading = false
    @Published var error: String?

    func load(_ identifier: String) async {
        guard let escaped = identifier.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let url = URL(string: "https://archive.org/metadata/\(escaped)") else { return }
        loading = true
        defer { loading = false }
        do {
            let (bytes, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let metadata = try JSONDecoder().decode(ArchiveItemMetadata.self, from: bytes)
            files = (metadata.files ?? []).filter(\.playable)
            error = files.isEmpty ? "Esta grabación no ofrece pistas de audio compatibles." : nil
        } catch {
            files = []
            self.error = "No se pudieron recuperar las pistas de esta grabación."
        }
    }

    func streamURL(identifier: String, filename: String) -> URL? {
        let safeIdentifier = identifier.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)
        let safeFile = filename.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)
        guard let safeIdentifier, let safeFile else { return nil }
        return URL(string: "https://archive.org/download/\(safeIdentifier)/\(safeFile)")
    }
}

private struct NativeArchiveRecordingScreen: View {
    let recording: ArchiveRecording
    @StateObject private var tracks = NativeArchiveTracks()
    @ObservedObject private var player = NativeRadioPlayer.shared

    var body: some View {
        List {
            if tracks.loading { ProgressView("Cargando pistas") }
            ForEach(tracks.files) { file in
                Button(file.name) {
                    guard let url = tracks.streamURL(identifier: recording.identifier, filename: file.name) else { return }
                    player.play(name: file.name, url: url)
                }
                .accessibilityAction(named: Text("Reproducir")) {
                    guard let url = tracks.streamURL(identifier: recording.identifier, filename: file.name) else { return }
                    player.play(name: file.name, url: url)
                }
            }
            if let error = tracks.error { Text(error) }
            if let source = URL(string: "https://archive.org/details/\(recording.identifier)") {
                Link("Información y derechos en Internet Archive", destination: source)
            }
        }
        .navigationTitle(recording.displayTitle)
        .task { await tracks.load(recording.identifier) }
    }
}

struct NativeInternetArchiveScreen: View {
    @StateObject private var directory = NativeArchiveDirectory()
    @State private var query = ""

    var body: some View {
        List {
            if directory.loading { ProgressView("Buscando grabaciones") }
            ForEach(directory.items) { item in
                NavigationLink(item.displayTitle) {
                    NativeArchiveRecordingScreen(recording: item)
                }
            }
            if let error = directory.error { Text(error) }
        }
        .navigationTitle("Conciertos y grabaciones")
        .searchable(text: $query, prompt: "Buscar artista o concierto")
        .onSubmit(of: .search) { Task { await directory.search(query) } }
        .task { await directory.search("") }
    }
}
