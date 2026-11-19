import SwiftUI
import AVFoundation
import MediaPlayer
import UIKit

private struct NativeRadioStation: Codable, Identifiable {
    let stationuuid: String
    let name: String
    let url_resolved: String
    let lastcheckok: Int
    let country: String?
    let tags: String?

    var id: String { stationuuid }
    var urlResolved: URL? { URL(string: url_resolved) }
}

@MainActor
private final class NativeRadioDirectory: ObservableObject {
    @Published private(set) var stations: [NativeRadioStation] = []
    @Published private(set) var isSearching = false
    @Published var error: String?

    func search(_ query: String) async {
        isSearching = true
        defer { isSearching = false }
        var parts = URLComponents()
        parts.scheme = "https"
        parts.host = "de1.api.radio-browser.info"
        parts.path = "/json/stations/search"
        let name = query.trimmingCharacters(in: .whitespacesAndNewlines)
        parts.queryItems = [
            URLQueryItem(name: name.isEmpty ? "tag" : "name", value: name.isEmpty ? "music" : name),
            URLQueryItem(name: "hidebroken", value: "true"),
            URLQueryItem(name: "limit", value: "50"),
            URLQueryItem(name: "order", value: "votes"),
            URLQueryItem(name: "reverse", value: "true")
        ]
        guard let url = parts.url else { error = "No se pudo preparar la búsqueda."; return }
        do {
            var request = URLRequest(url: url)
            request.setValue("TifloAcosta/1.5", forHTTPHeaderField: "User-Agent")
            request.timeoutInterval = 15
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let received = try JSONDecoder().decode([NativeRadioStation].self, from: data)
            stations = received.filter { station in
                station.lastcheckok == 1 && station.urlResolved?.scheme == "https"
            }
            error = nil
        } catch {
            stations = []
            self.error = "No se pudieron consultar las emisoras. Comprueba la conexión e inténtalo de nuevo."
        }
    }
}

/// Radio is streamed, never copied to the local music library.
@MainActor
final class NativeRadioPlayer: ObservableObject {
    static let shared = NativeRadioPlayer()
    @Published private(set) var stationName = ""
    @Published private(set) var isPlaying = false
    @Published var error: String?

    private var player: AVPlayer?
    private var remoteTokens: [Any] = []

    func play(name: String, url: URL) {
        guard url.scheme == "https" else {
            error = "Esta emisora no dispone de una transmisión segura compatible."
            return
        }
        NativeAppleMusicPlayer.shared.pauseForOtherAudio()
        NativeAudiusPlayer.shared.pauseForOtherAudio()
        NativeMusicPlayer.shared.pauseForReader()
        NativeReaderPlaybackBridge.pauseActiveReader?()
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            player?.pause()
            player = AVPlayer(url: url)
            stationName = name
            NativeRemotePlaybackOwner.claim(.radio)
            registerRemoteCommands()
            player?.play()
            isPlaying = true
            updateNowPlaying()
            error = nil
        } catch {
            self.error = "No se pudo iniciar la radio: \(error.localizedDescription)"
        }
    }

    func toggle() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeAppleMusicPlayer.shared.pauseForOtherAudio()
            NativeAudiusPlayer.shared.pauseForOtherAudio()
            NativeMusicPlayer.shared.pauseForReader()
            NativeReaderPlaybackBridge.pauseActiveReader?()
            NativeRemotePlaybackOwner.claim(.radio)
            player.play()
            isPlaying = true
        }
        updateNowPlaying()
    }

    func pauseForOtherAudio() {
        guard isPlaying else { return }
        player?.pause()
        isPlaying = false
        updateNowPlaying()
    }

    func stop() {
        player?.pause()
        player = nil
        isPlaying = false
        stationName = ""
        unregisterRemoteCommands()
        NativeRemotePlaybackOwner.release(.radio)
    }

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .radio else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: stationName,
            MPNowPlayingInfoPropertyIsLiveStream: true,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteTokens.isEmpty else { return }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        remoteTokens = [
            center.playCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .radio, let self, !self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            center.pauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .radio, let self, self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            center.togglePlayPauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .radio else { return }
                    self?.toggle()
                }
                return .success
            }
        ]
    }

    private func unregisterRemoteCommands() {
        guard remoteTokens.count == 3 else { return }
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.removeTarget(remoteTokens[0])
        center.pauseCommand.removeTarget(remoteTokens[1])
        center.togglePlayPauseCommand.removeTarget(remoteTokens[2])
        remoteTokens = []
    }
}

struct NativeMusicPlatformsScreen: View {
    var body: some View {
        List {
            NavigationLink("Radio musical gratuita") { NativeRadioScreen() }
            NavigationLink("Audius: música gratuita") { NativeAudiusScreen() }
            if Bundle.main.object(forInfoDictionaryKey: "TifloAppleMusicEnabled") as? Bool == true {
                NavigationLink("Apple Music") { NativeAppleMusicScreen() }
            }
        }
        .navigationTitle("Plataformas musicales")
    }
}

private struct NativeRadioScreen: View {
    @StateObject private var directory = NativeRadioDirectory()
    @ObservedObject private var radio = NativeRadioPlayer.shared
    @State private var query = ""
    @AppStorage("mi-musica-radio-favorites-v2") private var savedFavorites = ""

    private var savedStations: [NativeRadioStation] {
        guard let data = savedFavorites.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([NativeRadioStation].self, from: data)) ?? []
    }

    private func toggleFavorite(_ station: NativeRadioStation) {
        var updated = savedStations
        if let index = updated.firstIndex(where: { $0.id == station.id }) {
            updated.remove(at: index)
        } else {
            updated.append(station)
        }
        guard let data = try? JSONEncoder().encode(updated),
              let value = String(data: data, encoding: .utf8) else { return }
        savedFavorites = value
    }

    var body: some View {
        List {
            Section("Emisora actual") {
                Text(radio.stationName.isEmpty ? "Ninguna emisora" : radio.stationName)
                Button(radio.isPlaying ? "Pausar radio" : "Reanudar radio") { radio.toggle() }
                    .disabled(radio.stationName.isEmpty)
                Button("Detener radio") { radio.stop() }
                    .disabled(radio.stationName.isEmpty)
            }
            if !savedStations.isEmpty {
                Section("Emisoras favoritas") {
                    ForEach(savedStations) { station in
                        Button("Escuchar \(station.name)") {
                            guard let url = station.urlResolved else { return }
                            radio.play(name: station.name, url: url)
                        }
                        .accessibilityAction(named: Text("Quitar de favoritas")) { toggleFavorite(station) }
                    }
                }
            }
            Section("Emisoras") {
                if directory.isSearching { ProgressView("Buscando emisoras") }
                ForEach(directory.stations) { station in
                    Button("Escuchar \(station.name)") {
                        guard let url = station.urlResolved else { return }
                        radio.play(name: station.name, url: url)
                    }
                    .accessibilityAction(named: Text(savedStations.contains(where: { $0.id == station.id })
                        ? "Quitar de favoritas" : "Guardar favorita")) { toggleFavorite(station) }
                }
            }
            if let error = directory.error ?? radio.error { Text(error) }
        }
        .navigationTitle("Radio musical gratuita")
        .searchable(text: $query, prompt: "Buscar emisoras")
        .onSubmit(of: .search) { Task { await directory.search(query) } }
        .task { await directory.search("") }
    }
}
