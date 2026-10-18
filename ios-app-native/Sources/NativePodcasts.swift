import Foundation
import SwiftUI
import AVFoundation
import Combine

struct NativePodcastEpisode: Identifiable {
    let id: String
    let title: String
    let audioURL: URL
    let publicationDate: String
}

private final class NativeRSSParser: NSObject, XMLParserDelegate {
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
            self.error = "No se pudieron actualizar los episodios."
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

    func select(_ episode: NativePodcastEpisode) {
        stop()
        self.episode = episode
        player = AVPlayer(url: episode.audioURL)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        player?.play()
        isPlaying = true
    }

    func toggle() {
        guard let player else { return }
        if isPlaying { player.pause() } else { player.play() }
        isPlaying.toggle()
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
    }

    func stop() {
        player?.pause()
        player = nil
        episode = nil
        isPlaying = false
        seconds = 0
        duration = 0
    }
}

struct NativePodcastScreen: View {
    @EnvironmentObject private var store: NativePodcastStore
    @StateObject private var player = NativePodcastPlayer()
    @State private var visible = 10

    private func clock(_ value: Double) -> String {
        let seconds = Int(max(0, value))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
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
                    .accessibilityValue("\(clock(player.seconds)) de \(clock(player.duration))")
                    Text("\(clock(player.seconds)) de \(clock(player.duration))")
                        .font(.footnote).foregroundStyle(.secondary)
                    Button("Cerrar reproductor") { player.stop() }
                }
            }

            Section("Episodios recientes") {
                if store.loading && store.episodes.isEmpty { ProgressView("Cargando podcasts") }
                if let error = store.error { Text(error) }
                ForEach(Array(store.episodes.prefix(visible))) { episode in
                    Button {
                        player.select(episode)
                    } label: {
                        Text(episode.title)
                    }
                    .accessibilityHint("Doble toque para reproducir dentro de TifloAcosta.")
                    .accessibilityAction(named: Text("Reproducir")) { player.select(episode) }
                    .accessibilityAction(named: Text("Compartir")) {
                        NativeShare.present(url: episode.audioURL)
                    }
                }
                if visible < store.episodes.count {
                    Button("Mostrar diez más") { visible += 10 }
                }
                Button("Actualizar episodios") {
                    Task { await store.refresh() }
                }
            }
        }
        .navigationTitle("Podcasts")
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            if player.episode != nil { player.updatePosition() }
        }
        .onDisappear { player.stop() }
    }
}
