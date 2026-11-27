import Foundation
import SwiftUI
import UIKit

/// The display uses conventional clock notation, while VoiceOver receives
/// fully spelled out, localized time units instead of a raw seconds count.
enum NativeYouTubeTime {
    static func components(_ seconds: Double) -> (hours: Int, minutes: Int, seconds: Int) {
        let total = seconds.isFinite ? Int(min(max(seconds, 0), Double(Int32.max))) : 0
        return (total / 3600, (total % 3600) / 60, total % 60)
    }

    static func clock(_ seconds: Double) -> String {
        let value = components(seconds)
        if value.hours > 0 {
            return String(format: "%d:%02d:%02d", value.hours, value.minutes, value.seconds)
        }
        return String(format: "%d:%02d", value.minutes, value.seconds)
    }

    static func spoken(_ seconds: Double) -> String {
        let value = components(seconds)
        let formatter = DateComponentsFormatter()
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: NativeAppLanguage.code(for:
            UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))
        formatter.calendar = calendar
        formatter.unitsStyle = .full
        formatter.allowedUnits = value.hours > 0 ? [.hour, .minute, .second]
            : value.minutes > 0 ? [.minute, .second] : [.second]
        let duration = Double(value.hours * 3600 + value.minutes * 60 + value.seconds)
        return formatter.string(from: duration) ?? clock(seconds)
    }
}

struct NativeYouTubeTimeProgress: View {
    let elapsed: Double
    let duration: Double

    var body: some View {
        let position = min(max(0, elapsed), duration)
        Text(MusicLocalized.format("Tiempo: %@ de %@", NativeYouTubeTime.clock(position),
                                   NativeYouTubeTime.clock(duration)))
            .foregroundStyle(TifloVisual.secondaryText)
            .accessibilityLabel(Text(MusicLocalized.format("Tiempo: %@ de %@",
                NativeYouTubeTime.spoken(position), NativeYouTubeTime.spoken(duration))))
    }
}

/// Public metadata is requested only when the user opens the details.
/// No OAuth session, playback, private information or video stream is needed.
struct NativeYouTubeVideoDetailsScreen: View {
    let video: NativeYouTubeVideo
    @Environment(\.dismiss) private var dismiss
    @State private var remote: NativeYouTubeSearchItem?
    @State private var loading = false
    @State private var failed = false

    private var descriptionText: String { remote?.description ?? video.description }
    private var title: String { remote?.title ?? video.title }
    private var channelTitle: String { remote?.channelTitle ?? video.channelTitle }
    private var publication: String? { remote?.publishedAt ?? video.publishedAt }
    private var duration: Int { remote?.durationSeconds ?? video.durationSeconds }

    private var descriptionLinks: [URL] {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        else { return [] }
        var seen = Set<URL>()
        return detector.matches(in: descriptionText, range: NSRange(descriptionText.startIndex..., in: descriptionText))
            .compactMap(\.url)
            .filter { url in
                ["https", "http"].contains(url.scheme?.lowercased() ?? "") &&
                    url.host != nil && seen.insert(url).inserted
            }
    }

    private var channelURL: URL? {
        guard let id = remote?.channelId,
              id.range(of: "^UC[A-Za-z0-9_-]{22}$", options: .regularExpression) != nil else { return nil }
        return URL(string: "https://www.youtube.com/channel/" + id)
    }

    var body: some View {
        List {
            Section {
                Text(title).font(.headline).accessibilityAddTraits(.isHeader)
                if !channelTitle.isEmpty {
                    Text(MusicLocalized.format("Canal: %@", channelTitle))
                }
                if let date = NativeNewsMetadata.publication(publication) {
                    Text(MusicLocalized.format("Publicado: %@", date))
                }
                if duration > 0 {
                    Text(MusicLocalized.format("Duración: %@", NativeYouTubeTime.clock(Double(duration))))
                        .accessibilityLabel(Text(MusicLocalized.format("Duración: %@",
                            NativeYouTubeTime.spoken(Double(duration)))))
                }
                if let channelURL { Link("Abrir canal en YouTube", destination: channelURL) }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if loading || remote == nil {
                Section {
                    if loading {
                        ProgressView("Cargando información del vídeo")
                    } else {
                        Text("Información del catálogo; puede estar incompleta.")
                        if failed { Button("Reintentar") { Task { await load() } } }
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }

            Section("Descripción del vídeo") {
                if descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(remote == nil ? "Descripción no disponible" : "El creador no ha incluido una descripción.")
                } else {
                    Text(verbatim: descriptionText).textSelection(.enabled)
                    Button("Copiar descripción") { UIPasteboard.general.string = descriptionText }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if !descriptionLinks.isEmpty {
                Section("Enlaces de la descripción") {
                    ForEach(descriptionLinks, id: \.self) { url in
                        Link(destination: url) { Text(verbatim: url.absoluteString) }
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }
            Section("Acciones") {
                Link("Abrir en YouTube", destination: video.url)
                Button("Compartir vídeo") { NativeShare.present(url: video.url) }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Detalles del vídeo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button("Cerrar") { dismiss() } }
        }
        .task(id: video.id) { await load() }
    }

    @MainActor private func load() async {
        guard !loading, remote == nil else { return }
        loading = true
        failed = false
        defer { loading = false }
        do {
            var components = URLComponents(string: "https://youtube-auth.tifloacosta.com/video-details")!
            components.queryItems = [URLQueryItem(name: "videoId", value: video.id)]
            guard let url = components.url else { throw URLError(.badURL) }
            var request = URLRequest(url: url)
            request.timeoutInterval = 20
            request.setValue("https://tifloacosta.com", forHTTPHeaderField: "Origin")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            try Task.checkCancellation()
            let result = try JSONDecoder().decode(NativeYouTubeSearchItem.self, from: data)
            guard result.id == video.id else { throw URLError(.cannotParseResponse) }
            remote = result
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }
}
