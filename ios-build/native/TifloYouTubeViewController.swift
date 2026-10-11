import UIKit
import WebKit
import Capacitor
import AVFAudio

// This file replaces the generated Capacitor ViewController.swift only in the
// iOS build. No changes to the public website or Android implementation.
class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(TifloYouTubePlugin())
    }
}

@objc(TifloYouTubePlugin)
public final class TifloYouTubePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloYouTubePlugin"
    public let jsName = "TifloYouTube"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "publicFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accountState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accountAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise)
    ]

    @objc public func authStatus(_ call: CAPPluginCall) {
        call.resolve(["authenticated": TifloNativeYouTubeAccount.shared.hasLocalSession])
    }

    @objc public func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.bridge?.viewController else {
                call.reject("No se puede abrir Google")
                return
            }
            let presenter = controller.presentedViewController ?? controller
            TifloNativeYouTubeAccount.shared.signIn(from: presenter) { result in
                switch result {
                case .success:
                    call.resolve(["authenticated": true])
                case .failure:
                    call.reject("No se pudo completar la identificación en Google")
                }
            }
        }
    }

    @objc public func accountState(_ call: CAPPluginCall) {
        guard let videoId = call.getString("videoId") else {
            call.reject("Vídeo no válido")
            return
        }
        TifloNativeYouTubeAccount.shared.state(videoId: videoId) { result in
            switch result {
            case .success(let data): call.resolve(data)
            case .failure: call.reject("No se pudo consultar la cuenta de YouTube")
            }
        }
    }

    @objc public func accountAction(_ call: CAPPluginCall) {
        guard let action = call.getString("action"), let videoId = call.getString("videoId") else {
            call.reject("Acción incompleta")
            return
        }
        TifloNativeYouTubeAccount.shared.perform(
            action: action, videoId: videoId, text: call.getString("text") ?? ""
        ) { result in
            switch result {
            case .success(let data): call.resolve(data)
            case .failure: call.reject("YouTube no pudo completar la acción")
            }
        }
    }

    @objc public func signOut(_ call: CAPPluginCall) {
        TifloNativeYouTubeAccount.shared.signOut()
        call.resolve(["authenticated": false])
    }

    @objc public func info(_ call: CAPPluginCall) {
        call.resolve([
            "version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
            "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        ])
    }

    // A limited same-origin catalog fetch avoids WKWebView custom-scheme CORS restrictions.
    // No arbitrary URLs or private account data are accepted by this native bridge.
    @objc public func publicFile(_ call: CAPPluginCall) {
        let allowed: Set<String> = [
            "actualidad.json", "actualidad-apps.json", "actualidad-media.json",
            "videos.json", "data.js"
        ]
        guard let file = call.getString("file"),
              allowed.contains(file),
              let url = URL(string: "https://tifloacosta.com/" + file)
        else {
            call.reject("Archivo público no admitido")
            return
        }
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 12
        URLSession.shared.dataTask(with: request) { data, response, error in
            guard error == nil,
                  let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  let data = data,
                  data.count <= 2_000_000,
                  let body = String(data: data, encoding: .utf8)
            else {
                call.reject("No se pudo actualizar el catálogo público")
                return
            }
            call.resolve(["text": body, "status": http.statusCode])
        }.resume()
    }

    @objc public func open(_ call: CAPPluginCall) {
        guard let videoId = call.getString("videoId"),
              videoId.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil
        else {
            call.reject("Identificador de vídeo inválido")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let presenting = self?.bridge?.viewController else {
                call.reject("No se puede abrir el reproductor de vídeo")
                return
            }
            guard presenting.presentedViewController == nil else {
                call.reject("Ya hay otra pantalla abierta")
                return
            }
            let controller = TifloYouTubeViewController(
                videoId: videoId,
                title: String((call.getString("title") ?? "").prefix(250)),
                description: String((call.getString("description") ?? "").prefix(6000)),
                channel: String((call.getString("channel") ?? "").prefix(160)),
                publishedAt: String((call.getString("publishedAt") ?? "").prefix(40))
            )
            controller.modalPresentationStyle = .fullScreen
            // Resolve only after dismissal so JavaScript can restore the triggering button.
            controller.onClose = { call.resolve() }
            presenting.present(controller, animated: true)
        }
    }
}

/// Trial audio setting for VoiceOver speech coexistence. Verified only after
/// the user tests YouTube playback on an iPhone, never assumed from CI.
private final class TifloVoiceOverAudioMix {
    private var previousCategory: AVAudioSession.Category?
    private var previousOptions: AVAudioSession.CategoryOptions = []

    func activate() -> Bool {
        let session = AVAudioSession.sharedInstance()
        if previousCategory == nil {
            previousCategory = session.category
            previousOptions = session.categoryOptions
        }
        do {
            try session.setCategory(.playback, options: [.mixWithOthers])
            return true
        } catch {
            restore()
            return false
        }
    }

    func restore() {
        guard let category = previousCategory else { return }
        let options = previousOptions
        previousCategory = nil
        try? AVAudioSession.sharedInstance().setCategory(category, options: options)
    }
}

/// Uses Google's documented WKWebView loadRequest with an app-ID Referer.
/// It does not pretend to originate from youtube.com and does not proxy media.
private final class TifloYouTubeViewController: UIViewController, WKNavigationDelegate {
    private let videoId: String
    private let videoTitle: String
    private let videoDescription: String
    private let videoChannel: String
    private let videoPublishedAt: String
    private let spanish = Locale.preferredLanguages.first?.lowercased().hasPrefix("es") ?? true
    private let closeButton = UIButton(type: .system)
    private let playbackButton = UIButton(type: .system)
    private let detailsButton = UIButton(type: .system)
    private let audioCompatibilityButton = UIButton(type: .system)
    private let audioMix = TifloVoiceOverAudioMix()
    private static var audioMixPreference: Bool?
    private let detailsPanel = UITextView()
    private let statusLabel = UILabel()
    private var webView: WKWebView!
    private var pausedFromNative = false
    private var needsInitialVoiceOverFocus = true
    private var shouldMixAudio: Bool {
        Self.audioMixPreference ?? UIAccessibility.isVoiceOverRunning
    }
    var onClose: (() -> Void)?

    init(videoId: String, title: String, description: String, channel: String, publishedAt: String) {
        self.videoId = videoId
        self.videoTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        self.videoDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        self.videoChannel = channel.trimmingCharacters(in: .whitespacesAndNewlines)
        self.videoPublishedAt = publishedAt.trimmingCharacters(in: .whitespacesAndNewlines)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if shouldMixAudio && !audioMix.activate() {
            statusLabel.text = spanish
                ? "No se ha podido activar la compatibilidad de audio."
                : "Audio compatibility could not be enabled."
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if needsInitialVoiceOverFocus {
            needsInitialVoiceOverFocus = false
            UIAccessibility.post(notification: .screenChanged, argument: closeButton)
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        audioMix.restore()
        super.viewWillDisappear(animated)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        // Audio compatibility is a reversible experiment, not a confirmed
        // VoiceOver fix until playback is verified on the device.
        let header = UIStackView()
        header.axis = .horizontal
        header.alignment = .center
        header.distribution = .fillEqually
        header.spacing = 12

        closeButton.setTitle(spanish ? "Cerrar y volver" : "Close and return", for: .normal)
        closeButton.accessibilityHint = spanish
            ? "Regresa al contenido desde el que abriste el vídeo."
            : "Returns to the item from which you opened this video."
        closeButton.addTarget(self, action: #selector(closePlayer), for: .touchUpInside)
        closeButton.titleLabel?.numberOfLines = 2

        let openYouTube = UIButton(type: .system)
        openYouTube.setTitle(spanish ? "Abrir en YouTube" : "Open in YouTube", for: .normal)
        openYouTube.addTarget(self, action: #selector(openOriginal), for: .touchUpInside)
        openYouTube.titleLabel?.numberOfLines = 2
        header.addArrangedSubview(closeButton)
        header.addArrangedSubview(openYouTube)

        let titleLabel = UILabel()
        titleLabel.text = videoTitle.isEmpty ? (spanish ? "Reproductor TifloAcosta" : "TifloAcosta player") : videoTitle
        titleLabel.font = UIFont.preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.numberOfLines = 2
        titleLabel.accessibilityTraits.insert(.header)

        playbackButton.setTitle(spanish ? "Pausar vídeo" : "Pause video", for: .normal)
        playbackButton.isEnabled = false
        playbackButton.accessibilityHint = spanish
            ? "Para comenzar, activa primero Reproducir en el vídeo de YouTube."
            : "First activate Play within the YouTube video."
        playbackButton.addTarget(self, action: #selector(togglePlayback), for: .touchUpInside)

        detailsButton.setTitle(spanish ? "Ver detalles" : "Show details", for: .normal)
        detailsButton.accessibilityTraits.insert(.button)
        detailsButton.accessibilityValue = spanish ? "Contraído" : "Collapsed"
        detailsButton.addTarget(self, action: #selector(toggleDetails), for: .touchUpInside)

        audioCompatibilityButton.setTitle(audioCompatibilityTitle(), for: .normal)
        audioCompatibilityButton.titleLabel?.numberOfLines = 0
        audioCompatibilityButton.contentHorizontalAlignment = .leading
        audioCompatibilityButton.accessibilityHint = spanish
            ? "Prueba la mezcla de audio con VoiceOver. Se restaura al salir."
            : "Try audio mixing with VoiceOver. Restores the prior setting on exit."
        audioCompatibilityButton.addTarget(self, action: #selector(toggleAudioCompatibility), for: .touchUpInside)
        audioCompatibilityButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true

        let controls = UIStackView(arrangedSubviews: [playbackButton, detailsButton])
        controls.axis = .horizontal
        controls.distribution = .fillEqually
        controls.spacing = 12

        var detailLines: [String] = []
        if !videoChannel.isEmpty {
            detailLines.append((spanish ? "Canal: " : "Channel: ") + videoChannel)
        }
        if !videoPublishedAt.isEmpty {
            detailLines.append((spanish ? "Publicado: " : "Published: ") + videoPublishedAt)
        }
        if !videoDescription.isEmpty {
            detailLines.append(videoDescription)
        }
        detailsPanel.text = detailLines.isEmpty
            ? (spanish ? "No hay más detalles disponibles." : "No additional details available.")
            : detailLines.joined(separator: "\n\n")
        detailsPanel.font = UIFont.preferredFont(forTextStyle: .body)
        detailsPanel.adjustsFontForContentSizeCategory = true
        detailsPanel.isEditable = false
        detailsPanel.isSelectable = true
        detailsPanel.isHidden = true
        detailsPanel.backgroundColor = .secondarySystemBackground
        detailsPanel.layer.cornerRadius = 8
        // Keep the text view's spoken value: an accessibilityLabel here would
        // hide the actual video description from VoiceOver.
        let detailHeight = detailsPanel.heightAnchor.constraint(equalToConstant: 144)
        detailHeight.priority = .defaultHigh
        detailHeight.isActive = true

        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.accessibilityLabel = spanish ? "Reproductor de YouTube" : "YouTube player"
        webView.scrollView.isScrollEnabled = false

        statusLabel.text = spanish
            ? "Cargando vídeo. Los controles de YouTube inician la reproducción."
            : "Loading video. Start playback with the YouTube controls."
        statusLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.numberOfLines = 0
        statusLabel.accessibilityTraits = .staticText

        let accountControls = TifloYouTubeAccountControls(
            videoId: videoId, spanish: spanish, presenter: self
        )
        // Every native control remains reachable when large type expands the
        // interface or the comments editor opens the keyboard.
        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.keyboardDismissMode = .interactive
        scroll.accessibilityIdentifier = "tiflo-video-screen-scroll"

        let stack = UIStackView(arrangedSubviews: [
            header, titleLabel, audioCompatibilityButton, controls, statusLabel, detailsPanel, accountControls, webView
        ])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.distribution = .fill
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        view.addSubview(scroll)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            scroll.topAnchor.constraint(equalTo: safe.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -12),
            stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -32),
            header.heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
            controls.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            // YouTube requires its iframe viewport to be at least 200x200.
            webView.heightAnchor.constraint(greaterThanOrEqualToConstant: 225)
        ])

        let appId = Bundle.main.bundleIdentifier ?? "com.tifloacosta.app"
        let referer = "https://" + appId.lowercased()
        let urlString = "https://www.youtube.com/embed/" + videoId
            + "?playsinline=1&rel=0&origin=" + (referer.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? referer)
        guard let url = URL(string: urlString) else {
            statusLabel.text = spanish ? "No se pudo preparar el vídeo." : "Could not prepare video."
            return
        }
        var request = URLRequest(url: url)
        request.setValue(referer, forHTTPHeaderField: "Referer")
        webView.load(request)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        playbackButton.isEnabled = true
        statusLabel.text = spanish
            ? "Vídeo preparado. Puedes utilizar sus controles y volver a esta fila para pausarlo."
            : "Video ready. Use the player controls, then return here to pause."
    }

    private func audioCompatibilityTitle() -> String {
        if spanish {
            return shouldMixAudio ? "Audio compatible con VoiceOver: activado"
                                  : "Audio compatible con VoiceOver: desactivado"
        }
        return shouldMixAudio ? "VoiceOver audio mixing: on"
                              : "VoiceOver audio mixing: off"
    }

    @objc private func toggleAudioCompatibility() {
        let desired = !shouldMixAudio
        Self.audioMixPreference = desired
        if desired {
            if !audioMix.activate() {
                Self.audioMixPreference = false
                statusLabel.text = spanish
                    ? "No se pudo activar la mezcla de audio."
                    : "Could not enable audio mixing."
            }
        } else {
            audioMix.restore()
        }
        audioCompatibilityButton.setTitle(audioCompatibilityTitle(), for: .normal)
        UIAccessibility.post(notification: .announcement, argument: audioCompatibilityTitle())
    }

    @objc private func togglePlayback() {
        guard webView != nil, playbackButton.isEnabled else { return }
        // Paired suspension is available on iOS 15+; pauseAllMediaPlayback()
        // has no corresponding public Swift resumeAllMediaPlayback() method.
        let shouldSuspend = !pausedFromNative
        playbackButton.isEnabled = false
        webView.setAllMediaPlaybackSuspended(shouldSuspend) { [weak self] in
            guard let self = self else { return }
            self.pausedFromNative = shouldSuspend
            self.playbackButton.isEnabled = true
            self.playbackButton.setTitle(
                shouldSuspend ? (self.spanish ? "Reanudar vídeo" : "Resume video")
                              : (self.spanish ? "Pausar vídeo" : "Pause video"),
                for: .normal
            )
            self.statusLabel.text = shouldSuspend
                ? (self.spanish ? "Vídeo en pausa." : "Video paused.")
                : (self.spanish ? "Reanudando vídeo." : "Resuming video.")
        }
    }

    @objc private func toggleDetails() {
        let expanded = detailsPanel.isHidden
        detailsPanel.isHidden = !expanded
        detailsButton.setTitle(
            expanded ? (spanish ? "Ocultar detalles" : "Hide details")
                     : (spanish ? "Ver detalles" : "Show details"),
            for: .normal
        )
        detailsButton.accessibilityValue = expanded
            ? (spanish ? "Expandido" : "Expanded")
            : (spanish ? "Contraído" : "Collapsed")
    }

    override func accessibilityPerformMagicTap() -> Bool {
        guard playbackButton.isEnabled else { return false }
        togglePlayback()
        return true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        statusLabel.text = spanish ? "El vídeo no se pudo cargar. Puedes abrirlo en YouTube." :
          "Video could not load. You can open it on YouTube."
        UIAccessibility.post(notification: .announcement, argument: statusLabel.text)
    }

    @objc private func closePlayer() {
        webView.stopLoading()
        webView.loadHTMLString("", baseURL: nil)
        let completion = onClose
        dismiss(animated: true, completion: completion)
    }

    @objc private func openOriginal() {
        guard let url = URL(string: "https://www.youtube.com/watch?v=" + videoId) else { return }
        UIApplication.shared.open(url)
    }
}
