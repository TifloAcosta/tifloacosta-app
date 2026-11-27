import Foundation
import SwiftUI
import AVFoundation
import MediaPlayer
import Combine
import UniformTypeIdentifiers

struct NativePodcastEpisode: Identifiable {
    let id: String
    let title: String
    let audioURL: URL
    let publicationDate: String
}

final class NativeRSSParser: NSObject, XMLParserDelegate {
    var episodes: [NativePodcastEpisode] = []
    private var insideItem = false
    private var readingTitle = false
    private var readingDate = false
    private var title = ""
    private var date = ""
    private var audio: URL?
    private var identifier = ""

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        switch elementName {
        case "item":
            insideItem = true; title = ""; date = ""; audio = nil; identifier = ""
        case "title":
            readingTitle = insideItem
        case "pubDate":
            readingDate = insideItem
        case "enclosure":
            if insideItem, let raw = attributeDict["url"], let url = URL(string: raw),
               url.scheme == "https" {
                audio = url
                identifier = raw
            }
        default: break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if readingTitle { title += string }
        if readingDate { date += string }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        if elementName == "title" { readingTitle = false }
        if elementName == "pubDate" { readingDate = false }
        if elementName == "item" {
            if let url = audio {
                episodes.append(NativePodcastEpisode(
                    id: identifier.isEmpty ? UUID().uuidString : identifier,
                    title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                    audioURL: url, publicationDate: date
                ))
            }
            insideItem = false
        }
    }
}

@MainActor
final class NativePodcastStore: ObservableObject {
    @Published private(set) var episodes: [NativePodcastEpisode] = []
    @Published private(set) var loading = false
    @Published private(set) var error: String?

    private let rss = URL(string: "https://anchor.fm/s/5b48ca28/podcast/rss")!

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            let (data, response) = try await URLSession.shared.data(from: rss)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let delegate = NativeRSSParser()
            let parser = XMLParser(data: data)
            parser.delegate = delegate
            guard parser.parse() else { throw URLError(.cannotParseResponse) }
            episodes = Array(delegate.episodes.prefix(100))
            error = nil
        } catch {
            self.error = MusicLocalized.message("No se pudieron actualizar los episodios.")
        }
    }
}

@MainActor
final class NativePodcastPlayer: ObservableObject {
    @Published var episode: NativePodcastEpisode?
    @Published var isPlaying = false
    @Published var seconds = 0.0
    @Published var duration = 0.0

    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var nextEpisodes: [NativePodcastEpisode] = []
    private var remoteCommandTokens: [Any] = []
    var onEpisodeFinished: ((NativePodcastEpisode) -> Void)?
    var resolveAudioURL: ((NativePodcastEpisode) -> URL?)?

    func select(_ episode: NativePodcastEpisode,
                at seconds: Double = 0,
                followedBy episodes: [NativePodcastEpisode] = []) {
        stop()
        self.episode = episode
        nextEpisodes = episodes
        let item = AVPlayerItem(url: resolveAudioURL?(episode) ?? episode.audioURL)
        player = AVPlayer(playerItem: item)
        if seconds.isFinite && seconds > 0 {
            player?.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.episode?.id == episode.id else { return }
                self.onEpisodeFinished?(episode)
                if let next = self.nextEpisodes.first {
                    self.select(next, followedBy: Array(self.nextEpisodes.dropFirst()))
                } else {
                    self.stop()
                }
            }
        }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        NativeRemotePlaybackOwner.onInterrupted(.podcast) { [weak self] in
            self?.pauseForOtherAudio()
        }
        NativeRemotePlaybackOwner.claim(.podcast)
        registerRemoteCommands()
        player?.play()
        isPlaying = true
        updateNowPlaying()
    }

    func toggle() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeRemotePlaybackOwner.claim(.podcast)
            registerRemoteCommands()
            player.play()
            isPlaying = true
        }
        updateNowPlaying()
    }

    func pauseForOtherAudio() {
        guard isPlaying else { return }
        player?.pause()
        isPlaying = false
        updatePosition()
        updateNowPlaying()
    }

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .podcast, let episode else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: episode.title,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: seconds,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteCommandTokens.isEmpty else { return }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        let commands = MPRemoteCommandCenter.shared()
        let play = commands.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .podcast, self?.isPlaying == false else { return }
                self?.toggle()
            }
            return .success
        }
        let pause = commands.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .podcast, self?.isPlaying == true else { return }
                self?.toggle()
            }
            return .success
        }
        let toggle = commands.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in
                guard NativeRemotePlaybackOwner.current == .podcast else { return }
                self?.toggle()
            }
            return .success
        }
        remoteCommandTokens = [play, pause, toggle]
    }

    private func unregisterRemoteCommands() {
        guard remoteCommandTokens.count == 3 else { return }
        let commands = MPRemoteCommandCenter.shared()
        commands.playCommand.removeTarget(remoteCommandTokens[0])
        commands.pauseCommand.removeTarget(remoteCommandTokens[1])
        commands.togglePlayPauseCommand.removeTarget(remoteCommandTokens[2])
        remoteCommandTokens = []
    }

    func skip(_ delta: Double) {
        let target = max(0, duration > 0 ? min(duration, seconds + delta) : seconds + delta)
        seek(target)
    }

    func seek(_ time: Double) {
        guard time.isFinite else { return }
        player?.seek(to: CMTime(seconds: max(0, time), preferredTimescale: 600))
        seconds = max(0, time)
    }

    func updatePosition() {
        guard let player else { return }
        let time = player.currentTime().seconds
        let total = player.currentItem?.duration.seconds ?? 0
        seconds = time.isFinite ? max(0, time) : 0
        duration = total.isFinite ? max(0, total) : 0
        if player.rate == 0 && isPlaying { isPlaying = false }
        updateNowPlaying()
    }

    func stop() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        nextEpisodes = []
        player?.pause()
        player = nil
        episode = nil
        isPlaying = false
        seconds = 0
        duration = 0
        unregisterRemoteCommands()
        NativeRemotePlaybackOwner.release(.podcast)
    }
}

private struct NativePodcastPlatform: Identifiable {
    let name: String
    let address: String

    var id: String { name }
    var url: URL? { URL(string: address) }
}

struct NativePodcastScreen: View {
    private let podcastPlatforms = [
        NativePodcastPlatform(name: "Spotify", address: "https://open.spotify.com/show/6z5BbrUhRuMANB5BFJfdfB"),
        NativePodcastPlatform(name: "Apple Podcasts", address: "https://podcasts.apple.com/es/podcast/canal-tifloacosta/id1567846456"),
        NativePodcastPlatform(name: "iVoox", address: "https://www.ivoox.com/podcast-canal-tifloacosta_sq_f11282163_1.html"),
        NativePodcastPlatform(name: "Podimo", address: "https://podimo.com/es/shows/canal-tifloacosta"),
        NativePodcastPlatform(name: "radio.es", address: "https://www.radio.es/podcast/canal-tifloacosta")
    ]

    @EnvironmentObject private var store: NativePodcastStore
    @EnvironmentObject private var player: NativePodcastPlayer
    @State private var visible = 10
    @AppStorage("native-podcast-continuous-playback") private var continuousPlayback = false
    @EnvironmentObject private var library: NativePodcastLibrary
    @EnvironmentObject private var downloads: NativePodcastDownloads
    @State private var pendingDownloadedRemoval: NativeDownloadedPodcastEpisode?
    @State private var choosingOPML = false
    @State private var importingOPML = false
    @State private var followedEpisodes: [NativePodcastEpisode] = []
    @State private var followedFeedTitle = ""
    @State private var followedFeedStatus = ""
    @State private var followedFeedBusy = false

    @MainActor
    private func loadFollowed(_ feed: NativeFollowedPodcast) async {
        guard !followedFeedBusy, let url = URL(string: feed.url),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return }
        followedFeedBusy = true
        followedFeedTitle = feed.title
        followedFeedStatus = MusicLocalized.message("Consultando episodios.")
        defer { followedFeedBusy = false }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 20
            let (data, response) = try await URLSession.shared.data(for: request)
            guard data.count <= 2_000_000, (response as? HTTPURLResponse)?.statusCode == 200
            else { throw URLError(.badServerResponse) }
            let parser = XMLParser(data: data)
            let delegate = NativeRSSParser()
            parser.shouldResolveExternalEntities = false
            parser.delegate = delegate
            guard parser.parse() else { throw URLError(.cannotParseResponse) }
            followedEpisodes = Array(delegate.episodes.prefix(100))
            let newCount = library.recordFeedCheck(feed, episodes: followedEpisodes)
            followedFeedStatus = followedEpisodes.isEmpty
                ? MusicLocalized.message("Este canal no tiene episodios de audio compatibles.")
                : newCount == 0 ? MusicLocalized.message("Sin episodios nuevos desde la consulta anterior.")
                : MusicLocalized.format("Episodios nuevos desde la consulta anterior: %d.", newCount)
        } catch {
            followedEpisodes = []
            followedFeedStatus = MusicLocalized.message("No se pudieron consultar los episodios de este canal.")
        }
    }

    private func saveCurrentPosition() {
        guard let episode = player.episode else { return }
        library.remember(episode, seconds: player.seconds, duration: player.duration)
    }

    private func playEpisode(_ episode: NativePodcastEpisode,
                             collection: [NativePodcastEpisode] = []) {
        saveCurrentPosition()
        let upcoming: [NativePodcastEpisode]
        if continuousPlayback, let index = collection.firstIndex(where: { $0.id == episode.id }) {
            upcoming = Array(collection.dropFirst(index + 1))
        } else {
            upcoming = []
        }
        // Every item in the queue independently prefers its local download
        // while the original podcast URL remains the stable progress identifier.
        player.select(episode, at: library.progress(for: episode), followedBy: upcoming)
    }

    private func clock(_ value: Double) -> String {
        NativeYouTubeTime.clock(value)
    }

    var body: some View {
        List {
            if let episode = player.episode {
                Section("Reproductor de Podcast") {
                    Text(episode.title).font(.headline)
                    Button(player.isPlaying ? "Pausar" : "Reproducir") {
                        player.toggle()
                    }
                    HStack {
                        Button("Retroceder 30 segundos") { player.skip(-30) }
                        Spacer()
                        Button("Avanzar 30 segundos") { player.skip(30) }
                    }
                    Slider(value: Binding(
                        get: { min(player.seconds, max(player.duration, 1)) },
                        set: { player.seek($0) }
                    ), in: 0...max(player.duration, 1), step: 1) {
                        Text("Posición del episodio")
                    }
                    .accessibilityValue(MusicLocalized.format("%@ de %@", NativeYouTubeTime.spoken(player.seconds), NativeYouTubeTime.spoken(player.duration)))
                    Text(MusicLocalized.format("%@ de %@", clock(player.seconds), clock(player.duration)))
                        .font(.footnote).foregroundStyle(.secondary)
                        .accessibilityLabel(Text(MusicLocalized.format("%@ de %@", NativeYouTubeTime.spoken(player.seconds), NativeYouTubeTime.spoken(player.duration))))
                    Button("Cerrar reproductor") {
                        saveCurrentPosition()
                        player.stop()
                    }
                }
            }

            Section("Continuar escuchando") {
                if library.playbackProgress.isEmpty {
                    Text("No hay episodios pendientes de terminar.")
                }
                ForEach(library.playbackProgress) { saved in
                    if let url = URL(string: saved.audioURL) {
                        let episode = NativePodcastEpisode(
                            id: saved.id, title: saved.title,
                            audioURL: url, publicationDate: ""
                        )
                        Button(MusicLocalized.format("Continuar: %@, desde %@", saved.title, clock(saved.seconds))) {
                            playEpisode(episode)
                        }
                        .accessibilityLabel(Text(MusicLocalized.format("Continuar: %@, desde %@", saved.title, NativeYouTubeTime.spoken(saved.seconds))))
                        Button(MusicLocalized.format("Olvidar posición: %@", saved.title)) {
                            library.clearProgress(for: episode)
                        }
                    }
                }
            }
            Section("Episodios descargados") {
                if downloads.entries.isEmpty {
                    Text("No hay episodios descargados para escuchar sin conexión.")
                }
                if downloads.downloadingID != nil {
                    ProgressView("Descargando episodio")
                }
                if !downloads.notice.isEmpty {
                    Text(downloads.notice).accessibilityAddTraits(.updatesFrequently)
                }
                ForEach(downloads.entries) { item in
                    if let file = downloads.localURL(for: item.id) {
                        Button(MusicLocalized.format("Escuchar sin conexión: %@", item.title)) {
                            if let original = URL(string: item.sourceURL) {
                                playEpisode(NativePodcastEpisode(id: item.id, title: item.title,
                                    audioURL: original, publicationDate: ""))
                            }
                        }
                        Button(MusicLocalized.format("Eliminar descarga: %@", item.title)) {
                            pendingDownloadedRemoval = item
                        }
                    }
                }
            }
            Section("Reproducción continua") {
                Toggle("Reproducir el siguiente episodio automáticamente",
                       isOn: $continuousPlayback)
                    .accessibilityHint("Cuando termine un episodio, reproduce el siguiente de la misma lista.")
            }
            Section("Episodios recientes") {
                if store.loading && store.episodes.isEmpty { ProgressView("Cargando podcasts") }
                if let error = store.error { Text(error) }
                ForEach(Array(store.episodes.prefix(visible))) { episode in
                    Button {
                        playEpisode(episode, collection: store.episodes)
                    } label: {
                        Text(episode.title)
                    }
                    .accessibilityAction(named: Text("Reproducir")) {
                        playEpisode(episode, collection: store.episodes)
                    }
                    .accessibilityAction(named: Text(library.isFavorite(episode) ? "Quitar de favoritos" : "Añadir a favoritos")) {
                        library.toggleFavorite(episode)
                    }
                    .accessibilityAction(named: Text("Compartir")) {
                        NativeShare.present(url: episode.audioURL)
                    }
                    .accessibilityAction(named: Text("Descargar episodio")) {
                        Task { await downloads.download(episode) }
                    }
                    Button(library.isFavorite(episode) ? MusicLocalized.format("Quitar de favoritos: %@", episode.title) : MusicLocalized.format("Añadir a favoritos: %@", episode.title)) {
                        library.toggleFavorite(episode)
                    }
                    if downloads.localURL(for: episode.id) == nil {
                        Button(MusicLocalized.format("Descargar: %@", episode.title)) {
                            Task { await downloads.download(episode) }
                        }
                        .disabled(downloads.downloadingID != nil)
                    }
                }
                if visible < store.episodes.count {
                    Button("Mostrar diez más") { visible += 10 }
                }
                Button("Actualizar episodios") {
                    Task { await store.refresh() }
                }
            }
            Section("Seguir pódcast y favoritos") {
                Text(MusicLocalized.format("Favoritos guardados: %d", library.favorites.count))
                ForEach(library.savedEpisodes) { saved in
                    if let url = URL(string: saved.audioURL) {
                        Button(MusicLocalized.format("Reproducir favorito: %@", saved.title)) {
                            playEpisode(NativePodcastEpisode(id: saved.id, title: saved.title,
                                                              audioURL: url, publicationDate: ""))
                        }
                        Button(MusicLocalized.format("Quitar favorito: %@", saved.title)) {
                            library.toggleFavorite(NativePodcastEpisode(id: saved.id, title: saved.title,
                                                                       audioURL: url, publicationDate: ""))
                        }
                    }
                }
                Text(library.notice).accessibilityAddTraits(.updatesFrequently)
                Button("Seguir el pódcast TifloAcosta") {
                    library.follow(title: "Canal TifloAcosta", url: "https://anchor.fm/s/5b48ca28/podcast/rss")
                }
                Button("Importar suscripciones OPML") { choosingOPML = true }
                    .disabled(importingOPML)
                if importingOPML { ProgressView("Importando suscripciones") }
                ForEach(library.followed) { feed in
                    Text(feed.title)
                    Button(MusicLocalized.format("Consultar episodios: %@", feed.title)) {
                        Task { await loadFollowed(feed) }
                    }
                    Button(MusicLocalized.format("Dejar de seguir: %@", feed.title)) { library.unfollow(feed) }
                }
                if followedFeedBusy { ProgressView("Cargando episodios seguidos") }
                if !followedFeedStatus.isEmpty { Text(followedFeedStatus) }
                if !followedEpisodes.isEmpty {
                    Text(MusicLocalized.format("Episodios de %@", followedFeedTitle)).font(.headline)
                    ForEach(followedEpisodes) { episode in
                        Button(MusicLocalized.format("Reproducir: %@", episode.title)) {
                            playEpisode(episode, collection: followedEpisodes)
                        }
                        if downloads.localURL(for: episode.id) == nil {
                            Button(MusicLocalized.format("Descargar: %@", episode.title)) {
                                Task { await downloads.download(episode) }
                            }
                            .disabled(downloads.downloadingID != nil)
                        }
                        Button(library.isFavorite(episode) ? MusicLocalized.format("Quitar de favoritos: %@", episode.title) :
                               MusicLocalized.format("Añadir a favoritos: %@", episode.title)) {
                            library.toggleFavorite(episode)
                        }
                    }
                }
            }
            Section("Escuchar en otras plataformas") {
                ForEach(podcastPlatforms) { platform in
                    if let url = platform.url {
                        Link(platform.name, destination: url)
                            .accessibilityHint("Abre el podcast de TifloAcosta en la plataforma seleccionada.")
                            .accessibilityAction(named: Text("Compartir enlace")) {
                                NativeShare.present(url: url)
                            }
                    }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Podcasts")
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            // Only update the visible clock. App-level playback persists globally.
            if player.episode != nil { player.updatePosition() }
        }
        .onDisappear {
            // Audio continues while the user browses another TifloAcosta section.
            saveCurrentPosition()
        }
        .confirmationDialog(
            MusicLocalized.format("¿Eliminar «%@»?", pendingDownloadedRemoval?.title ?? ""),
            isPresented: Binding(
                get: { pendingDownloadedRemoval != nil },
                set: { if !$0 { pendingDownloadedRemoval = nil } }),
            titleVisibility: .visible
        ) {
            Button("Eliminar descarga", role: .destructive) {
                if let item = pendingDownloadedRemoval { downloads.delete(item) }
                pendingDownloadedRemoval = nil
            }
            Button("Cancelar", role: .cancel) { pendingDownloadedRemoval = nil }
        } message: {
            Text("Se eliminará la descarga local. El episodio seguirá disponible en su fuente.")
        }
        .fileImporter(isPresented: $choosingOPML,
                      allowedContentTypes: [.xml, UTType(filenameExtension: "opml") ?? .xml],
                      allowsMultipleSelection: false) { result in
            Task { @MainActor in
                importingOPML = true
                defer { importingOPML = false }
                do {
                    guard let url = try result.get().first else { return }
                    _ = try await library.importOPML(url)
                } catch {
                    library.notice = MusicLocalized.format("No se pudo importar el OPML: %@", error.localizedDescription)
                }
            }
        }
    }
}
