import Foundation
import SwiftUI

/// The server returns only publicly accessible playlist metadata. Playback is
/// always delegated to YouTube's official embedded player.
struct NativeYouTubePlaylistEntry: Identifiable {
    let id: String
    let position: Int
    let video: NativeYouTubeVideo
}

private struct NativeYouTubePlaylistPage: Decodable {
    let items: [NativeYouTubeSearchItem]
    let nextPageToken: String
}

private struct NativeYouTubePlaylistError: Decodable {
    let error: String
}

@MainActor
final class NativeYouTubePlaylistStore: ObservableObject {
    @Published private(set) var entries: [NativeYouTubePlaylistEntry] = []
    @Published private(set) var nextPageToken = ""
    @Published private(set) var isLoading = false
    @Published private(set) var hasLoaded = false
    @Published private(set) var message: String?

    private var currentPlaylistID = ""
    private var seenSourceItems = 0
    private let endpoint = URL(string: "https://youtube-auth.tifloacosta.com/playlist-items")!

    func load(_ playlist: NativeYouTubePlaylist, loadMore: Bool = false) async {
        guard !isLoading else { return }
        if loadMore && (nextPageToken.isEmpty || currentPlaylistID != playlist.id) { return }
        if !loadMore {
            currentPlaylistID = playlist.id
            entries = []
            nextPageToken = ""
            seenSourceItems = 0
            hasLoaded = false
        }
        isLoading = true
        message = nil
        defer { isLoading = false }
        do {
            var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "playlistId", value: playlist.id)]
            if loadMore {
                components.queryItems?.append(
                    URLQueryItem(name: "pageToken", value: nextPageToken))
            }
            var request = URLRequest(url: components.url!)
            request.timeoutInterval = 20
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("https://tifloacosta.com", forHTTPHeaderField: "Origin")
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200...299).contains(status) else {
                let code = (try? JSONDecoder().decode(
                    NativeYouTubePlaylistError.self, from: data).error) ?? ""
                if status == 403 || status == 404 || code == "INVALID_PLAYLIST" {
                    throw PlaylistLoadError.unavailable
                }
                throw PlaylistLoadError.service
            }
            let page = try JSONDecoder().decode(NativeYouTubePlaylistPage.self, from: data)
            for (index, item) in page.items.enumerated() {
                guard let video = NativeYouTubeVideo(result: item) else { continue }
                let position = item.position ?? (seenSourceItems + index)
                entries.append(NativeYouTubePlaylistEntry(
                    id: "\(position):\(video.id):\(index)",
                    position: position, video: video
                ))
            }
            seenSourceItems += page.items.count
            nextPageToken = page.nextPageToken
            hasLoaded = true
            if entries.isEmpty {
                message = MusicLocalized.message("No hay vídeos públicos disponibles en esta lista.")
            }
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            if let known = error as? PlaylistLoadError {
                message = known.localizedDescription
            } else if error is DecodingError {
                message = MusicLocalized.message(
                    "La respuesta de la lista de YouTube no pudo interpretarse.")
            } else {
                message = MusicLocalized.message(
                    "No se pudo cargar la lista de YouTube. Comprueba la conexión y vuelve a intentarlo.")
            }
        }
    }

    private enum PlaylistLoadError: LocalizedError {
        case unavailable, service
        var errorDescription: String? {
            switch self {
            case .unavailable:
                MusicLocalized.message("La lista no está disponible públicamente.")
            case .service:
                MusicLocalized.message("El servidor no pudo consultar esta lista de YouTube.")
            }
        }
    }
}

/// Navigate the publisher-defined order, and only show the next page when
/// requested. No inaccessible video is synthesized to fill a gap.
struct NativeYouTubePlaylistScreen: View {
    let playlist: NativeYouTubePlaylist
    @StateObject private var store = NativeYouTubePlaylistStore()
    @State private var selectedEntry: NativeYouTubePlaylistEntry?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    var body: some View {
        List {
            Section("Lista de reproducción") {
                Text(playlist.title)
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Text(playlist.channelTitle)
                    .font(.subheadline)
                if !playlist.description.isEmpty {
                    Text(playlist.description)
                        .font(.footnote)
                }
                Link("Abrir lista original en YouTube", destination: playlist.url)
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Vídeos en orden de la lista") {
                if store.isLoading {
                    ProgressView("Cargando lista de reproducción")
                }
                if let message = store.message {
                    Text(message)
                        .foregroundStyle(TifloVisual.secondaryText)
                        .accessibilityAddTraits(.updatesFrequently)
                    Button("Reintentar carga de la lista") {
                        Task { await store.load(playlist) }
                    }
                    .disabled(store.isLoading)
                }
                ForEach(store.entries) { entry in
                    NativeYouTubeVideoRow(
                        video: entry.video,
                        onPlay: { _ in selectedEntry = entry },
                        onComment: { commentingOnVideo = $0 }
                    )
                    .accessibilityHint(
                        MusicLocalized.format("Posición %d de la lista.", entry.position + 1))
                }
                if !store.nextPageToken.isEmpty {
                    Button("Mostrar veinte vídeos más") {
                        Task { await store.load(playlist, loadMore: true) }
                    }
                    .disabled(store.isLoading)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle(playlist.title)
        .sheet(item: $selectedEntry) { entry in
            NavigationStack {
                NativeYouTubePlayerScreen(
                    video: entry.video,
                    playlist: store.entries.map(\.video),
                    playlistStartIndex: store.entries.firstIndex(where: { $0.id == entry.id })
                )
            }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
        .task(id: playlist.id) { await store.load(playlist) }
    }
}
