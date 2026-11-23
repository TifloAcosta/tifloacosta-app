import Foundation
import SwiftUI
import WebKit
import UIKit
import AVFoundation

/// Datos de YouTube: el buscador y toda la interfaz son SwiftUI nativos.
/// Solo el reproductor oficial necesita un WKWebView, según las condiciones de YouTube.
struct NativeYouTubeVideo: Identifiable {
    let id: String
    let title: String
    let channelTitle: String
    let description: String
    let publishedAt: String?
    let durationSeconds: Int

    var url: URL { URL(string: "https://www.youtube.com/watch?v=" + id)! }
    /// ID validado al crear el modelo; URL pública para la miniatura del vídeo.
    var thumbnailURL: URL { URL(string: "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg")! }

    static func validID(_ value: String) -> Bool {
        value.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil
    }

    init?(catalog item: NativeCatalogItem) {
        let candidate: String
        if Self.validID(item.id) {
            candidate = item.id
        } else if let url = item.videoURL {
            let host = (url.host ?? "").lowercased()
            if host == "youtu.be" || host == "www.youtu.be" {
                candidate = url.pathComponents.last ?? ""
            } else if host == "youtube.com" || host == "www.youtube.com" || host == "m.youtube.com" {
                let segments = url.pathComponents
                if segments.contains("shorts") || segments.contains("embed") {
                    candidate = segments.last ?? ""
                } else {
                    candidate = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                        .queryItems?.first(where: { $0.name == "v" })?.value ?? ""
                }
            } else {
                return nil
            }
        } else {
            return nil
        }
        guard Self.validID(candidate) else { return nil }
        id = candidate
        title = item.title
        channelTitle = "TifloAcosta"
        description = item.description ?? item.excerpt ?? ""
        publishedAt = item.publishedAt
        durationSeconds = 0
    }

    /// Media catalog entries keep YouTube's official URL; never extract a
    /// direct stream or bypass the embedded YouTube player.
    init?(media item: NativeMediaItem) {
        guard item.type == "video", let url = item.originalURL else { return nil }
        let host = (url.host ?? "").lowercased()
        let candidate: String
        if host == "youtu.be" || host == "www.youtu.be" {
            candidate = url.pathComponents.last ?? ""
        } else if ["youtube.com", "www.youtube.com", "m.youtube.com",
                   "music.youtube.com", "www.youtube-nocookie.com"].contains(host) {
            let segments = url.pathComponents.filter { $0 != "/" }
            if ["shorts", "embed", "live"].contains(segments.first ?? "") {
                candidate = segments.dropFirst().first ?? ""
            } else {
                candidate = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "v" })?.value ?? ""
            }
        } else {
            return nil
        }
        guard Self.validID(candidate) else { return nil }
        id = candidate
        title = item.title
        channelTitle = item.sourceName
        description = item.summary ?? ""
        publishedAt = item.publishedAt
        durationSeconds = 0
    }

    init?(saved item: NativeSavedYouTubeVideo) {
        guard Self.validID(item.id) else { return nil }
        id = item.id
        title = item.title
        channelTitle = item.channelTitle
        description = item.description
        publishedAt = item.publishedAt
        durationSeconds = item.durationSeconds
    }

    init?(result: NativeYouTubeSearchItem) {
        guard let id = result.id, Self.validID(id) else { return nil }
        self.id = id
        title = result.title
        channelTitle = result.channelTitle
        description = result.description
        publishedAt = result.publishedAt
        durationSeconds = result.durationSeconds ?? 0
    }
}

struct NativeYouTubeSearchItem: Decodable {
    let id: String?
    let kind: String?
    let channelId: String?
    let playlistId: String?
    let position: Int?
    let title: String
    let channelTitle: String
    let description: String
    let publishedAt: String?
    let durationSeconds: Int?
}

struct NativeYouTubeChannel: Identifiable, Decodable {
    let id: String
    let title: String
    let description: String
    var url: URL { URL(string: "https://www.youtube.com/channel/" + id)! }

    init?(saved channel: NativeSavedYouTubeChannel) {
        guard channel.id.hasPrefix("UC"), channel.id.count == 24 else { return nil }
        id = channel.id
        title = channel.title
        description = channel.description
    }

    init?(search item: NativeYouTubeSearchItem) {
        guard let channelId = item.channelId, channelId.hasPrefix("UC"),
              channelId.count == 24 else { return nil }
        id = channelId
        title = item.title
        description = item.description
    }
}

struct NativeYouTubePlaylist: Identifiable {
    let id: String
    let title: String
    let channelTitle: String
    let description: String

    var url: URL {
        var parts = URLComponents(string: "https://www.youtube.com/playlist")!
        parts.queryItems = [URLQueryItem(name: "list", value: id)]
        return parts.url!
    }

    init?(search item: NativeYouTubeSearchItem) {
        guard let playlistID = item.playlistId,
              playlistID.range(of: "^[A-Za-z0-9_-]{10,150}$",
                               options: .regularExpression) != nil else { return nil }
        id = playlistID
        title = item.title
        channelTitle = item.channelTitle
        description = item.description
    }
}

struct NativeYouTubeSubscriptionPage: Decodable {
    let items: [NativeYouTubeChannel]
    let nextPageToken: String
}
private struct NativeYouTubeSearchPage: Decodable {
    let items: [NativeYouTubeSearchItem]
    let nextPageToken: String
}
private struct NativeYouTubeSearchFailure: Decodable {
    let error: String?
}

@MainActor
final class NativeYouTubeSearchStore: ObservableObject {
    @Published private(set) var videos: [NativeYouTubeVideo] = []
    @Published private(set) var channels: [NativeYouTubeChannel] = []
    @Published private(set) var playlists: [NativeYouTubePlaylist] = []
    @Published private(set) var nextPageToken = ""
    @Published private(set) var isLoading = false
    @Published private(set) var message: String?
    @Published private(set) var hasSearched = false
    @Published private(set) var searchFailed = false

    private var currentQuery = ""
    private var currentFilter = "video"
    private var currentChannelID: String?
    private let endpoint = URL(string: "https://youtube-auth.tifloacosta.com/search")!

    /// Retry once for transient transport/gateway failures, never for
    /// permission errors or exhausted search quota. This also avoids forcing
    /// a VoiceOver user to repeat the same search after a brief connection drop.
    private func fetchWithOneTransientRetry(
        _ request: URLRequest
    ) async throws -> (Data, URLResponse) {
        do {
            let first = try await URLSession.shared.data(for: request)
            if let response = first.1 as? HTTPURLResponse,
               [502, 503, 504].contains(response.statusCode) {
                try await Task.sleep(nanoseconds: 400_000_000)
                return try await URLSession.shared.data(for: request)
            }
            return first
        } catch let error as URLError
            where error.code == .timedOut ||
                  error.code == .networkConnectionLost ||
                  error.code == .cannotConnectToHost {
            try await Task.sleep(nanoseconds: 400_000_000)
            return try await URLSession.shared.data(for: request)
        }
    }

    func search(_ text: String, filter: String = "video", channelID: String? = nil,
                loadMore: Bool = false) async {
        guard !isLoading else { return }
        let cleanQuery = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !loadMore && channelID == nil && cleanQuery.count < 2 {
            // Invalid new queries cannot leave an unrelated old result list.
            hasSearched = false
            searchFailed = false
            nextPageToken = ""
            videos = []
            channels = []
            playlists = []
            message = MusicLocalized.message(
                "Escribe al menos dos caracteres para buscar en YouTube.")
            return
        }
        if loadMore && nextPageToken.isEmpty { return }
        let requestedPageToken = loadMore ? nextPageToken : ""
        if !loadMore {
            searchFailed = false
            currentQuery = cleanQuery
            currentFilter = filter
            currentChannelID = channelID
            nextPageToken = ""
            videos = []
            channels = []
            playlists = []
            hasSearched = true
        }
        isLoading = true
        message = "Buscando en YouTube."
        defer { isLoading = false }
        do {
            let target = currentChannelID == nil
                ? endpoint : endpoint.deletingLastPathComponent().appendingPathComponent("channel-videos")
            var components = URLComponents(url: target, resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "q", value: currentQuery)]
            if let channelID = currentChannelID {
                components.queryItems?.append(URLQueryItem(name: "channelId", value: channelID))
            } else {
                components.queryItems?.append(URLQueryItem(name: "filter", value: currentFilter))
            }
            if loadMore {
                components.queryItems?.append(URLQueryItem(name: "pageToken", value: nextPageToken))
            }
            var request = URLRequest(url: components.url!)
            request.timeoutInterval = 20
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            // El Worker solo acepta búsquedas del origen TifloAcosta.
            // URLSession no añade Origin automáticamente como un navegador.
            request.setValue("https://tifloacosta.com", forHTTPHeaderField: "Origin")
            let (data, response) = try await fetchWithOneTransientRetry(request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200...299).contains(status) else {
                let code = (try? JSONDecoder().decode(NativeYouTubeSearchFailure.self, from: data).error) ?? ""
                if code == "QUOTA_EXCEEDED" {
                    throw SearchError.message(MusicLocalized.message(
                        "YouTube ha alcanzado temporalmente su límite de búsqueda."))
                }
                if code == "SEARCH_UNAVAILABLE" || status == 503 {
                    throw SearchError.message(MusicLocalized.message(
                        "El servicio de búsqueda de YouTube no está disponible."))
                }
                if code == "RATE_LIMITED" || status == 429 {
                    throw SearchError.message(MusicLocalized.message(
                        "Demasiadas búsquedas consecutivas. Inténtalo nuevamente más tarde."))
                }
                if code == "ORIGIN_NOT_ALLOWED" || status == 403 {
                    throw SearchError.message(MusicLocalized.message(
                        "El servidor rechazó la solicitud de búsqueda de esta aplicación."))
                }
                throw SearchError.message(MusicLocalized.message(
                    "El servicio de YouTube devolvió un error al buscar."))
            }
            let page = try JSONDecoder().decode(NativeYouTubeSearchPage.self, from: data)
            // Deduplicate within the current page as well as across earlier
            // pages; one result must remain one VoiceOver focus stop.
            var videoIDs = Set(videos.map(\.id))
            for video in page.items.compactMap(NativeYouTubeVideo.init(result:)) {
                if videoIDs.insert(video.id).inserted { videos.append(video) }
            }
            var channelIDs = Set(channels.map(\.id))
            for channel in page.items.compactMap(NativeYouTubeChannel.init(search:)) {
                if channelIDs.insert(channel.id).inserted { channels.append(channel) }
            }
            var playlistIDs = Set(playlists.map(\.id))
            for playlist in page.items.compactMap(NativeYouTubePlaylist.init(search:)) {
                if playlistIDs.insert(playlist.id).inserted { playlists.append(playlist) }
            }
            // Avoid exposing a permanent "show more" action if the upstream
            // mistakenly sends the same pagination token twice.
            nextPageToken = page.nextPageToken == requestedPageToken
                ? "" : page.nextPageToken
            searchFailed = false
            let count = videos.count + channels.count + playlists.count
            message = count == 0 ? "No se encontraron resultados."
                : "\(count) resultados encontrados hasta el momento."
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            searchFailed = true
            message = searchFailureMessage(error)
        }
    }

    /// Real network, TLS, service and decoding errors must not all be
    /// announced as "cannot connect". Do not record queries or API tokens.
    private func searchFailureMessage(_ error: Error) -> String {
        if let explicit = error as? SearchError { return explicit.localizedDescription }
        if error is DecodingError {
            return MusicLocalized.message(
                "El servicio de YouTube respondió, pero sus datos no pudieron interpretarse.")
        }
        if let network = error as? URLError {
            switch network.code {
            case .notConnectedToInternet, .dataNotAllowed, .networkConnectionLost:
                return MusicLocalized.message(
                    "El iPhone no tiene una conexión disponible para buscar en YouTube.")
            case .cannotFindHost, .dnsLookupFailed:
                return MusicLocalized.message(
                    "El iPhone no encuentra el servidor de búsqueda de YouTube.")
            case .timedOut, .cannotConnectToHost:
                return MusicLocalized.message(
                    "El servidor de búsqueda de YouTube no responde desde este dispositivo.")
            case .secureConnectionFailed, .serverCertificateUntrusted,
                 .serverCertificateHasBadDate, .serverCertificateHasUnknownRoot:
                return MusicLocalized.message(
                    "No se pudo establecer una conexión segura con el buscador de YouTube.")
            default:
                return MusicLocalized.message(
                    "Se produjo un error de comunicación con el buscador de YouTube.")
            }
        }
        return MusicLocalized.message(
            "No fue posible procesar la búsqueda de YouTube en este momento.")
    }

    private enum SearchError: LocalizedError {
        case message(String)
        var errorDescription: String? {
            if case .message(let value) = self { return value }
            return nil
        }
    }
}

/// Puente mínimo con la API IFrame oficial. Nunca representa pantallas HTML de la app.
@MainActor
final class NativeYouTubePlayerEngine: ObservableObject {
    @Published private(set) var ready = false
    @Published private(set) var playing = false
    @Published private(set) var currentTime = 0.0
    @Published private(set) var duration = 0.0
    @Published private(set) var error: String?
    @Published private(set) var completedSequence = 0
    private var previousState = -1
    private var hasPlayed = false
    private var externallyPaused = false

    weak var webView: WKWebView?

    var percent: Int {
        guard duration > 0 else { return 0 }
        return min(100, max(0, Int((currentTime / duration * 100).rounded())))
    }

    func report(_ data: [String: Any]) {
        if let isReady = data["ready"] as? Bool { ready = isReady }
        if let state = data["state"] as? Int {
            if state == 1 {
                hasPlayed = true
                if externallyPaused {
                    // A delayed iframe status must not reclaim audio from a new player.
                    run("if(window.tifloPlayer){tifloPlayer.pauseVideo()}")
                } else {
                    NativeRemotePlaybackOwner.onInterrupted(.youtube) { [weak self] in
                        self?.pauseForOtherAudio()
                    }
                    NativeRemotePlaybackOwner.claim(.youtube)
                }
            }
            if state == 0 && previousState != 0 && hasPlayed && error == nil {
                completedSequence += 1
                hasPlayed = false
            }
            previousState = state
            playing = state == 1
        }
        if let current = data["current"] as? Double, current.isFinite { currentTime = max(0, current) }
        if let total = data["duration"] as? Double, total.isFinite { duration = max(0, total) }
        if let errorCode = data["error"] as? Int {
            error = "Este vídeo no puede reproducirse aquí (código \(errorCode)). Puedes abrirlo en YouTube."
        }
    }

    private func run(_ script: String) {
        guard ready else { return }
        webView?.evaluateJavaScript(script, completionHandler: nil)
    }

    func toggle() {
        if externallyPaused {
            externallyPaused = false
            run("if(window.tifloPlayer){tifloPlayer.playVideo()}")
        } else {
            run("if(window.tifloPlayer){if(tifloPlayer.getPlayerState()===1){tifloPlayer.pauseVideo()}else{tifloPlayer.playVideo()}}")
        }
    }

    func pauseForOtherAudio() {
        guard playing else { return }
        externallyPaused = true
        run("if(window.tifloPlayer){tifloPlayer.pauseVideo()}")
        playing = false
    }
    func loadVideo(id: String) {
        guard NativeYouTubeVideo.validID(id) else { return }
        previousState = -1
        hasPlayed = false
        externallyPaused = false
        playing = false
        currentTime = 0
        duration = 0
        error = nil
        run("if(window.tifloPlayer){tifloPlayer.loadVideoById('\(id)')}")
    }
    func seek(seconds: Int) {
        run("if(window.tifloPlayer){tifloPlayer.seekTo(Math.max(0,tifloPlayer.getCurrentTime()+(\(seconds))),true)}")
    }
    func seek(toSeconds seconds: Double) {
        guard seconds.isFinite else { return }
        let clamped = max(0, seconds)
        run("if(window.tifloPlayer){tifloPlayer.seekTo(\(clamped),true)}")
    }
    func seek(percent: Int) {
        let clamped = min(100, max(0, percent))
        run("if(window.tifloPlayer){tifloPlayer.seekTo(tifloPlayer.getDuration()*\(clamped)/100,true)}")
    }
    func stop() {
        externallyPaused = false
        NativeRemotePlaybackOwner.release(.youtube)
        hasPlayed = false // Closing a player must never advance the playlist.
        webView?.evaluateJavaScript("if(window.tifloPlayer){tifloPlayer.stopVideo()}", completionHandler: nil)
        webView = nil
        ready = false
    }
}

private struct NativeYouTubeOfficialPlayer: UIViewRepresentable {
    let videoID: String
    @ObservedObject var engine: NativeYouTubePlayerEngine

    func makeCoordinator() -> Coordinator { Coordinator(engine: engine) }

    func makeUIView(context: Context) -> WKWebView {
        let content = WKUserContentController()
        content.add(context.coordinator, name: "tifloPlayerEvents")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        configuration.allowsInlineMediaPlayback = true
        // El toque se realiza en el botón nativo; evaluateJavaScript no es
        // un gesto de usuario dentro del iframe y no debe quedar bloqueado.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        context.coordinator.configureMixableAudio()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.scrollView.isScrollEnabled = false
        view.isOpaque = false
        view.backgroundColor = .black
        // El reproductor visual permanece visible; VoiceOver utiliza exclusivamente
        // los controles SwiftUI nativos para no quedarse atrapado en WebKit.
        view.isAccessibilityElement = false
        view.accessibilityElementsHidden = true
        engine.webView = view
        // En WKWebView el vídeo usa su propia sesión de audio, distinta de la
        // sesión nativa. Al activar VoiceOver, solicitar a WebKit audio mezclable
        // también dentro de la página que aloja el iframe oficial.
        // El modo ambiente respeta el interruptor de silencio de iOS.
        let voiceOverAudioPolicy = UIAccessibility.isVoiceOverRunning
            ? "try { if (navigator.audioSession) { navigator.audioSession.type = 'ambient'; } } catch(e) {}"
            : ""
        // No reproducir automáticamente. Mantener el iframe completo, controles,
        // marca y enlaces oficiales de YouTube, sin superposiciones visuales.
        let html = """
        <!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="referrer" content="strict-origin-when-cross-origin">
        <script>\(voiceOverAudioPolicy)</script>
        <style>html,body,#player{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head>
        <body><div id="player"></div><script src="https://www.youtube.com/iframe_api"></script>
        <script>
        window.tifloPlayer=null;
        function sendState(){
          if(!window.tifloPlayer || !tifloPlayer.getPlayerState)return;
          try{window.webkit.messageHandlers.tifloPlayerEvents.postMessage({
            ready:true,state:tifloPlayer.getPlayerState(),
            current:tifloPlayer.getCurrentTime(),duration:tifloPlayer.getDuration()
          });}catch(e){}
        }
        function onYouTubeIframeAPIReady(){
          window.tifloPlayer=new YT.Player('player',{
            videoId:'\(videoID)',
            width:'100%',height:'100%',
            playerVars:{playsinline:1,controls:1,enablejsapi:1,autoplay:0,origin:'https://tifloacosta.com'},
            events:{onReady:sendState,onStateChange:sendState,
              onError:function(event){
                window.webkit.messageHandlers.tifloPlayerEvents.postMessage({error:event.data});
              }}
          });
        }
        setInterval(sendState,1000);
        </script></body></html>
        """
        view.loadHTMLString(html, baseURL: URL(string: "https://tifloacosta.com/")!)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.evaluateJavaScript("if(window.tifloPlayer){tifloPlayer.stopVideo()}", completionHandler: nil)
        uiView.stopLoading()
        uiView.loadHTMLString("", baseURL: nil)
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "tifloPlayerEvents")
        coordinator.restoreAudioConfiguration()
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let engine: NativeYouTubePlayerEngine
        private var previousAudio: (category: AVAudioSession.Category,
                                    mode: AVAudioSession.Mode,
                                    options: AVAudioSession.CategoryOptions)?

        init(engine: NativeYouTubePlayerEngine) { self.engine = engine }

        func configureMixableAudio() {
            let session = AVAudioSession.sharedInstance()
            let prior = (category: session.category, mode: session.mode,
                         options: session.categoryOptions)
            do {
                // Evitar una sesión exclusiva que silencie la voz del lector de pantalla.
                try session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
                try session.setActive(true)
                previousAudio = prior
            } catch {
                try? session.setCategory(prior.category, mode: prior.mode, options: prior.options)
            }
        }

        func restoreAudioConfiguration() {
            guard let prior = previousAudio else { return }
            try? AVAudioSession.sharedInstance().setCategory(
                prior.category, mode: prior.mode, options: prior.options
            )
            previousAudio = nil
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let data = message.body as? [String: Any] else { return }
            Task { @MainActor in engine.report(data) }
        }
    }
}

struct NativeYouTubePlayerScreen: View {
    @EnvironmentObject private var account: NativeYouTubeAccountStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var editingComment = false
    @State private var commentText = ""
    let video: NativeYouTubeVideo
    let playlist: [NativeYouTubeVideo]
    @State private var currentVideo: NativeYouTubeVideo
    @State private var currentPlaylistIndex: Int
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @StateObject private var engine = NativeYouTubePlayerEngine()
    @ObservedObject private var personalLibrary = NativeYouTubePersonalLibrary.shared
    @State private var resumeApplied = false

    init(video: NativeYouTubeVideo, playlist: [NativeYouTubeVideo] = [],
         playlistStartIndex: Int? = nil) {
        self.video = video
        self.playlist = playlist
        _currentVideo = State(initialValue: video)
        let index = playlistStartIndex.flatMap { playlist.indices.contains($0) ? $0 : nil }
            ?? playlist.firstIndex(where: { $0.id == video.id })
            ?? -1
        _currentPlaylistIndex = State(initialValue: index)
    }

    private func advancePlaylist() {
        guard playlist.indices.contains(currentPlaylistIndex) else { return }
        let next = currentPlaylistIndex + 1
        guard playlist.indices.contains(next) else { return }
        personalLibrary.rememberPlayback(currentVideo, seconds: engine.currentTime,
                                         duration: engine.duration)
        currentPlaylistIndex = next
        currentVideo = playlist[next]
        resumeApplied = true // A playlist always starts the next video at its beginning.
        engine.loadVideo(id: currentVideo.id)
        speak("Siguiente vídeo de la lista: \(currentVideo.title).")
    }

    private func speak(_ text: String) {
        UIAccessibility.post(notification: .announcement, argument: text)
    }

    private func changePosition(_ delta: Int) {
        let next = min(100, max(0, engine.percent + delta))
        engine.seek(percent: next)
        speak("Posición \(next) por ciento.")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TifloVisual.sectionSpacing) {
                Text(currentVideo.title)
                    .font(.title3.bold())
                    .foregroundStyle(TifloVisual.primaryText)
                    .accessibilityAddTraits(.isHeader)

                NativeYouTubeOfficialPlayer(videoID: currentVideo.id, engine: engine)
                    .frame(height: 225)
                    // El reproductor oficial queda fuera del foco de VoiceOver.
                    .accessibilityHidden(true)
                    .onChange(of: engine.ready) { _, ready in
                        guard ready, !resumeApplied else { return }
                        resumeApplied = true
                        let seconds = personalLibrary.resumeSeconds(currentVideo.id)
                        if seconds >= 5 {
                            engine.seek(toSeconds: seconds)
                            speak("Continuar viendo desde el segundo \(Int(seconds)).")
                        }
                    }
                    .onChange(of: engine.completedSequence) { _, _ in
                        advancePlaylist()
                    }

                if let error = engine.error {
                    Text(error).foregroundStyle(TifloVisual.secondaryText)
                }

                // Los tres controles en una fila reducían la palabra «Reproducir»
                // a varias líneas en el iPhone. Los ajustes de accesibilidad
                // apilan los saltos de 30 segundos sin perder acciones de VoiceOver.
                VStack(spacing: 8) {
                    Button {
                        engine.toggle()
                    } label: {
                        Text(engine.playing ? "Pausar" : "Reproducir")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .disabled(!engine.ready)

                    AnyLayout(
                        dynamicTypeSize.isAccessibilitySize
                            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
                            : AnyLayout(HStackLayout(spacing: 8))
                    ) {
                        Button {
                            engine.seek(seconds: -30)
                        } label: {
                            Text("Retroceder 30 s")
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityLabel("Retroceder 30 segundos")
                        .disabled(!engine.ready)

                        Button {
                            engine.seek(seconds: 30)
                        } label: {
                            Text("Avanzar 30 s")
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityLabel("Avanzar 30 segundos")
                        .disabled(!engine.ready)
                    }
                }
                .buttonStyle(TifloSecondaryActionStyle())

                Text("Posición: \(engine.percent) por ciento")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(TifloVisual.primaryText)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityLabel("Posición del vídeo")
                    .accessibilityValue(MusicLocalized.format("%d por ciento", engine.percent))
                    .accessibilityAdjustableAction { direction in
                        guard engine.ready && engine.duration > 0 else { return }
                        switch direction {
                        case .increment: changePosition(10)
                        case .decrement: changePosition(-10)
                        @unknown default: break
                        }
                    }

                if engine.duration > 0 {
                    Text("Tiempo: \(Int(engine.currentTime)) de \(Int(engine.duration)) segundos")
                        .foregroundStyle(TifloVisual.secondaryText)
                }

                Button(personalLibrary.isWatchLater(currentVideo.id)
                    ? "Quitar de Ver después" : "Guardar para ver después") {
                    personalLibrary.toggleWatchLater(currentVideo)
                }
                .buttonStyle(TifloSecondaryActionStyle())

                if personalLibrary.resumeSeconds(currentVideo.id) > 0 {
                    Button("Empezar vídeo desde el principio") {
                        engine.seek(toSeconds: 0)
                        personalLibrary.clearProgress(currentVideo.id)
                    }
                    .buttonStyle(TifloSecondaryActionStyle())
                }

                if !currentVideo.channelTitle.isEmpty {
                    Text("Canal: \(currentVideo.channelTitle)")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                if let date = NativeNewsMetadata.publication(currentVideo.publishedAt) {
                    Text("Publicado: \(date)").foregroundStyle(TifloVisual.secondaryText)
                }
                if currentVideo.durationSeconds > 0 {
                    Text("Duración: \(currentVideo.durationSeconds) segundos")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                if !currentVideo.description.isEmpty {
                    Text(currentVideo.description)
                        .textSelection(.enabled)
                        .foregroundStyle(TifloVisual.primaryText)
                }
                Divider()
                Text("Interacción con YouTube")
                    .font(.headline)
                    .foregroundStyle(TifloVisual.primaryText)
                    .accessibilityAddTraits(.isHeader)
                if let message = account.message {
                    Text(message)
                        .foregroundStyle(TifloVisual.secondaryText)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if account.authenticated && (account.subscribed == nil || account.rating == nil) {
                    Button("Reintentar consulta de Me gusta y suscripciones") {
                        Task { await account.loadState(videoID: currentVideo.id) }
                    }
                    .disabled(account.busy)
                    .buttonStyle(TifloSecondaryActionStyle())
                }
                if !account.authenticated {
                    Text("Para indicar Me gusta, suscribirte o comentar, debes iniciar sesión en Google. Buscar y reproducir vídeos no requiere una cuenta.")
                        .foregroundStyle(TifloVisual.secondaryText)
                    Button(account.busy ? "Conectando con Google" : "Iniciar sesión con Google") {
                        account.signIn(videoID: currentVideo.id)
                    }
                    .disabled(account.busy)
                    .buttonStyle(TifloSecondaryActionStyle())
                } else {
                    if let subscribed = account.subscribed {
                        Button(subscribed ? "Cancelar suscripción al canal" : "Suscribirse al canal") {
                            Task { await account.setSubscribed(!subscribed, videoID: currentVideo.id) }
                        }
                        .disabled(account.busy)
                        .buttonStyle(TifloSecondaryActionStyle())
                    }
                    if let rating = account.rating {
                        Button(rating == "like" ? "Quitar Me gusta" : "Me gusta") {
                            Task { await account.setLiked(rating != "like", videoID: currentVideo.id) }
                        }
                        .disabled(account.busy)
                        .buttonStyle(TifloSecondaryActionStyle())
                    }
                    Button("Comentar") {
                        editingComment.toggle()
                    }
                    .disabled(account.busy)
                    .buttonStyle(TifloSecondaryActionStyle())
                    if editingComment {
                        Text("Comentario público en el vídeo: \(currentVideo.title)")
                            .foregroundStyle(TifloVisual.secondaryText)
                        TextEditor(text: $commentText)
                            .frame(minHeight: 120)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(TifloVisual.border))
                            .accessibilityLabel("Escribir comentario en YouTube")
                        Button("Publicar comentario") {
                            Task {
                                if await account.publishComment(commentText, videoID: currentVideo.id) {
                                    commentText = ""
                                    editingComment = false
                                }
                            }
                        }
                        .disabled(commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || account.busy)
                        .buttonStyle(TifloSecondaryActionStyle())
                        Button("Cancelar comentario") {
                            editingComment = false
                        }
                        .buttonStyle(TifloSecondaryActionStyle())
                    }
                    Button("Cerrar sesión de YouTube") {
                        account.signOut()
                        editingComment = false
                        commentText = ""
                    }
                    .buttonStyle(TifloSecondaryActionStyle())
                }
                Button("Compartir vídeo") { NativeShare.present(url: currentVideo.url) }
                    .buttonStyle(TifloSecondaryActionStyle())
                Button("Abrir en YouTube") { openURL(currentVideo.url) }
                    .buttonStyle(TifloSecondaryActionStyle())
            }
            .padding(16)
        }
        .tifloScreenSurface()
        .navigationTitle("Reproductor accesible")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Cerrar") { engine.stop(); dismiss() }
            }
        }
        .task(id: currentVideo.id) {
            await account.verifySession()
            await account.loadState(videoID: currentVideo.id)
        }
        .onDisappear {
            personalLibrary.rememberPlayback(currentVideo, seconds: engine.currentTime,
                                             duration: engine.duration)
            engine.stop()
        }
    }
}
