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

    init?(search item: NativeYouTubeSearchItem) {
        guard let channelId = item.channelId, channelId.hasPrefix("UC"),
              channelId.count == 24 else { return nil }
        id = channelId
        title = item.title
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
    @Published private(set) var nextPageToken = ""
    @Published private(set) var isLoading = false
    @Published private(set) var message: String?
    @Published private(set) var hasSearched = false

    private var currentQuery = ""
    private var currentFilter = "video"
    private var currentChannelID: String?
    private let endpoint = URL(string: "https://youtube-auth.tifloacosta.com/search")!

    func search(_ text: String, filter: String = "video", channelID: String? = nil,
                loadMore: Bool = false) async {
        guard !isLoading else { return }
        let cleanQuery = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !loadMore && channelID == nil && cleanQuery.count < 2 {
            message = "Escribe al menos dos caracteres para buscar en YouTube."
            return
        }
        if loadMore && nextPageToken.isEmpty { return }
        if !loadMore {
            currentQuery = cleanQuery
            currentFilter = filter
            currentChannelID = channelID
            nextPageToken = ""
            videos = []
            channels = []
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
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200...299).contains(status) else {
                let code = (try? JSONDecoder().decode(NativeYouTubeSearchFailure.self, from: data).error) ?? ""
                if code == "QUOTA_EXCEEDED" {
                    throw SearchError.message("YouTube ha alcanzado temporalmente su límite de búsqueda.")
                }
                if code == "SEARCH_UNAVAILABLE" {
                    throw SearchError.message("El servicio de búsqueda de YouTube no está disponible.")
                }
                throw SearchError.message("No se pudo completar la búsqueda. Inténtalo nuevamente.")
            }
            let page = try JSONDecoder().decode(NativeYouTubeSearchPage.self, from: data)
            let newVideos = page.items.compactMap(NativeYouTubeVideo.init(result:))
            let previousIDs = Set(videos.map(\.id))
            videos += newVideos.filter { !previousIDs.contains($0.id) }
            let newChannels = page.items.compactMap(NativeYouTubeChannel.init(search:))
            let previousChannelIDs = Set(channels.map(\.id))
            channels += newChannels.filter { !previousChannelIDs.contains($0.id) }
            nextPageToken = page.nextPageToken
            let count = videos.count + channels.count
            message = count == 0 ? "No se encontraron resultados."
                : "\(count) resultados encontrados hasta el momento."
        } catch {
            message = (error as? SearchError)?.localizedDescription
                ?? "No se pudo conectar con la búsqueda de YouTube."
        }
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

    weak var webView: WKWebView?

    var percent: Int {
        guard duration > 0 else { return 0 }
        return min(100, max(0, Int((currentTime / duration * 100).rounded())))
    }

    func report(_ data: [String: Any]) {
        if let isReady = data["ready"] as? Bool { ready = isReady }
        if let state = data["state"] as? Int { playing = state == 1 }
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
        run("if(window.tifloPlayer){if(tifloPlayer.getPlayerState()===1){tifloPlayer.pauseVideo()}else{tifloPlayer.playVideo()}}")
    }
    func seek(seconds: Int) {
        run("if(window.tifloPlayer){tifloPlayer.seekTo(Math.max(0,tifloPlayer.getCurrentTime()+(\(seconds))),true)}")
    }
    func seek(percent: Int) {
        let clamped = min(100, max(0, percent))
        run("if(window.tifloPlayer){tifloPlayer.seekTo(tifloPlayer.getDuration()*\(clamped)/100,true)}")
    }
    func stop() {
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
        // No reproducir automáticamente. Mantener el iframe completo, controles,
        // marca y enlaces oficiales de YouTube, sin superposiciones visuales.
        let html = """
        <!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="referrer" content="strict-origin-when-cross-origin">
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
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @StateObject private var engine = NativeYouTubePlayerEngine()

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
                Text(video.title)
                    .font(.title3.bold())
                    .foregroundStyle(TifloVisual.primaryText)
                    .accessibilityAddTraits(.isHeader)

                NativeYouTubeOfficialPlayer(videoID: video.id, engine: engine)
                    .frame(height: 225)
                    // Evitar que el iframe capture el foco de VoiceOver durante la reproducción.
                    .accessibilityHidden(true)

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
                    .accessibilityValue("\(engine.percent) por ciento")
                    .accessibilityHint("Desliza arriba para avanzar diez por ciento; abajo para retroceder.")
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

                if !video.channelTitle.isEmpty {
                    Text("Canal: \(video.channelTitle)")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                if let date = NativeNewsMetadata.publication(video.publishedAt) {
                    Text("Publicado: \(date)").foregroundStyle(TifloVisual.secondaryText)
                }
                if video.durationSeconds > 0 {
                    Text("Duración: \(video.durationSeconds) segundos")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                if !video.description.isEmpty {
                    Text(video.description)
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
                        Task { await account.loadState(videoID: video.id) }
                    }
                    .disabled(account.busy)
                    .buttonStyle(TifloSecondaryActionStyle())
                }
                if !account.authenticated {
                    Text("Para indicar Me gusta, suscribirte o comentar, debes iniciar sesión en Google. Buscar y reproducir vídeos no requiere una cuenta.")
                        .foregroundStyle(TifloVisual.secondaryText)
                    Button(account.busy ? "Conectando con Google" : "Iniciar sesión con Google") {
                        account.signIn(videoID: video.id)
                    }
                    .disabled(account.busy)
                    .buttonStyle(TifloSecondaryActionStyle())
                } else {
                    if let subscribed = account.subscribed {
                        Button(subscribed ? "Cancelar suscripción al canal" : "Suscribirse al canal") {
                            Task { await account.setSubscribed(!subscribed, videoID: video.id) }
                        }
                        .disabled(account.busy)
                        .buttonStyle(TifloSecondaryActionStyle())
                    }
                    if let rating = account.rating {
                        Button(rating == "like" ? "Quitar Me gusta" : "Me gusta") {
                            Task { await account.setLiked(rating != "like", videoID: video.id) }
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
                        Text("Comentario público en el vídeo: \(video.title)")
                            .foregroundStyle(TifloVisual.secondaryText)
                        TextEditor(text: $commentText)
                            .frame(minHeight: 120)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(TifloVisual.border))
                            .accessibilityLabel("Escribir comentario en YouTube")
                        Button("Publicar comentario") {
                            Task {
                                if await account.publishComment(commentText, videoID: video.id) {
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
                Button("Compartir vídeo") { NativeShare.present(url: video.url) }
                    .buttonStyle(TifloSecondaryActionStyle())
                Button("Abrir en YouTube") { openURL(video.url) }
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
        .task(id: video.id) {
            await account.verifySession()
            await account.loadState(videoID: video.id)
        }
        .onDisappear { engine.stop() }
    }
}
