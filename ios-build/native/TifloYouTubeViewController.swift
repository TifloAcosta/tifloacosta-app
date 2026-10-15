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
        bridge?.registerPluginInstance(TifloReadingTtsPlugin())
        bridge?.registerPluginInstance(TifloReadingLanguagePlugin())
        bridge?.registerPluginInstance(TifloReadingAccessibilityPlugin())
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
    private var previousMode: AVAudioSession.Mode?

    func activate() -> Bool {
        let session = AVAudioSession.sharedInstance()
        if previousCategory == nil {
            previousCategory = session.category
            previousOptions = session.categoryOptions
            previousMode = session.mode
        }
        do {
            // WebKit may claim a nonmixing playback session after opening.
            // Mix video audio with spoken accessibility audio without interrupting it.
            try session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
            return true
        } catch {
            restore()
            return false
        }
    }

    func restore() {
        guard let category = previousCategory else { return }
        let options = previousOptions
        let mode = previousMode ?? .default
        previousCategory = nil
        previousMode = nil
        try? AVAudioSession.sharedInstance().setCategory(category, mode: mode, options: options)
    }
}

/// Uses Google's documented WKWebView loadRequest with an app-ID Referer.
/// It does not pretend to originate from youtube.com and does not proxy media.
// VoiceOver's adjustable swipes seek exactly ten percent of the complete video.
// Unlike an arbitrary slider step, this remains stable for videos of any length.
private final class TifloTenPercentSeekSlider: UISlider {
    override func accessibilityIncrement() {
        moveByTenPercent(direction: 1)
    }

    override func accessibilityDecrement() {
        moveByTenPercent(direction: -1)
    }

    private func moveByTenPercent(direction: Float) {
        guard isEnabled, maximumValue > minimumValue else { return }
        let step = (maximumValue - minimumValue) * 0.1
        let next = min(maximumValue, max(minimumValue, value + direction * step))
        value = next
        let percentage = Int(round((next - minimumValue) / (maximumValue - minimumValue) * 100))
        accessibilityValue = "\(percentage) %"
        sendActions(for: .valueChanged)
    }
}

private final class TifloYouTubeViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let videoId: String
    private let videoTitle: String
    private let videoDescription: String
    private let videoChannel: String
    private let videoPublishedAt: String
    private let spanish = Locale.preferredLanguages.first?.lowercased().hasPrefix("es") ?? true
    private let closeButton = UIButton(type: .system)
    private let playbackButton = UIButton(type: .system)
    private let rewindButton = UIButton(type: .system)
    private let forwardButton = UIButton(type: .system)
    private let positionSlider = TifloTenPercentSeekSlider()
    private let progressLabel = UILabel()
    private let detailsButton = UIButton(type: .system)
    private let audioCompatibilityButton = UIButton(type: .system)
    private let audioMix = TifloVoiceOverAudioMix()
    private static var audioMixPreference: Bool?
    private let detailsPanel = UITextView()
    private let statusLabel = UILabel()
    private var webView: WKWebView!
    private var playerReady = false
    private var playerState = -1
    private var durationSeconds: Double = 0
    private var positionSeconds: Double = 0
    private var playerError = false
    private var needsInitialVoiceOverFocus = true
    private var pendingMixRefresh: DispatchWorkItem?
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
        pendingMixRefresh?.cancel()
        pendingMixRefresh = nil
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

        playbackButton.setTitle(spanish ? "Reproducir vídeo" : "Play video", for: .normal)
        playbackButton.isEnabled = false
        playbackButton.accessibilityHint = spanish
            ? "También puedes iniciar el vídeo desde el reproductor de YouTube."
            : "You can also start the video using the YouTube player."
        playbackButton.addTarget(self, action: #selector(togglePlayback), for: .touchUpInside)

        rewindButton.setTitle(spanish ? "Retroceder 30 segundos" : "Back 30 seconds", for: .normal)
        rewindButton.addTarget(self, action: #selector(rewindThirtySeconds), for: .touchUpInside)
        rewindButton.isEnabled = false
        rewindButton.titleLabel?.numberOfLines = 0

        forwardButton.setTitle(spanish ? "Avanzar 30 segundos" : "Forward 30 seconds", for: .normal)
        forwardButton.addTarget(self, action: #selector(forwardThirtySeconds), for: .touchUpInside)
        forwardButton.isEnabled = false
        forwardButton.titleLabel?.numberOfLines = 0

        positionSlider.minimumValue = 0
        positionSlider.maximumValue = 1
        positionSlider.isContinuous = false
        positionSlider.isEnabled = false
        positionSlider.accessibilityLabel = spanish ? "Posición del vídeo" : "Video position"
        positionSlider.accessibilityHint = spanish
            ? "Ajusta la posición del vídeo hacia adelante o atrás."
            : "Adjust video position forward or backward."
        positionSlider.addTarget(self, action: #selector(changePosition), for: .valueChanged)

        progressLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
        progressLabel.adjustsFontForContentSizeCategory = true
        progressLabel.text = spanish ? "Tiempo: sin determinar." : "Time: unknown."
        progressLabel.numberOfLines = 0

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

        let controls = UIStackView(arrangedSubviews: [rewindButton, playbackButton, forwardButton])
        controls.axis = .horizontal
        controls.distribution = .fillEqually
        controls.spacing = 8
        let detailsRow = UIStackView(arrangedSubviews: [detailsButton, progressLabel])
        detailsRow.axis = .vertical
        detailsRow.spacing = 6

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
        // Playback is always initiated explicitly from the native Play button
        // or YouTube's own controls. Permit the native-to-JavaScript command
        // even though WKWebView does not count a UIKit tap as a web gesture.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(self, name: "tifloPlayer")
        // WebKit plays the cross-origin YouTube iframe in its own process.
        // The app's AVAudioSession.mixWithOthers alone does not control that process.
        // Set the document audio session to a mixing category in every iframe when
        // VoiceOver compatibility is active. Normal YouTube audio remains unchanged
        // when compatibility is disabled. This is intentionally iOS-only.
        let audioSessionPolicy = """
        (() => {
          'use strict';
          const marker = 'tiflo-voiceover-audio-policy-v1';
          let enabled = \(shouldMixAudio ? "true" : "false");
          const apply = () => {
            try {
              if ('audioSession' in navigator && navigator.audioSession) {
                navigator.audioSession.type = enabled ? 'ambient' : 'auto';
              }
            } catch {}
          };
          const relay = message => {
            for (const frame of document.querySelectorAll('iframe')) {
              try { frame.contentWindow?.postMessage(message, '*'); } catch {}
            }
          };
          window.addEventListener('message', event => {
            if (event.source !== window && event.source !== window.parent) return;
            if (event.data?.type !== marker || typeof event.data.enabled !== 'boolean') return;
            enabled = event.data.enabled;
            apply();
            relay(event.data);
          });
          apply();
          document.addEventListener('DOMContentLoaded', apply, { once: true });
          document.addEventListener('play', () => {
            apply();
            // HTMLMediaElement can switch WebKit back to exclusive playback.
            // Reapply only around a new play event, never in a polling loop.
            setTimeout(apply, 0);
            setTimeout(apply, 350);
          }, true);
        })();
        """
        configuration.userContentController.addUserScript(
            WKUserScript(source: audioSessionPolicy, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        )
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        // The embedded YouTube iframe may capture the VoiceOver cursor as
        // playback starts. Keep the picture usable for sighted users, but
        // expose the complete transport and account actions as native controls.
        webView.isAccessibilityElement = false
        webView.accessibilityElementsHidden = true
        webView.scrollView.accessibilityElementsHidden = true
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
            header, titleLabel, audioCompatibilityButton, controls, positionSlider, detailsRow, statusLabel, detailsPanel, accountControls, webView
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

        // YouTube's documented embedded-player integration uses loadHTMLString
        // with an app-identified HTTPS baseURL so requests carry a Referer.
        guard let file = Bundle.main.url(
            forResource: "tiflo-youtube-player", withExtension: "html", subdirectory: "public"
        ),
        let template = try? String(contentsOf: file, encoding: .utf8) else {
            presentPlayerError(0)
            return
        }
        let appId = Bundle.main.bundleIdentifier ?? "com.tifloacosta.app"
        guard let baseURL = URL(string: "https://" + appId.lowercased() + "/") else {
            presentPlayerError(0)
            return
        }
        // videoId was strictly checked before this controller was created.
        let html = template.replacingOccurrences(of: "__TIFLO_YOUTUBE_VIDEO_ID__", with: videoId)
        webView.loadHTMLString(html, baseURL: baseURL)
    }

    // A single main-frame HTML wrapper invokes the official YouTube IFrame API.
    // Never evaluate arbitrary video metadata or other untrusted strings as JS.
    private func sendPlayerCommand(_ command: String, at seconds: Double = 0) {
        guard playerReady && !playerError,
              ["play", "pause", "seek", "report"].contains(command) else { return }
        let safeSeconds = seconds.isFinite ? Int(max(0, min(seconds, durationSeconds))) : 0
        let script = "window.tifloControl('" + command + "', " + String(safeSeconds) + ");"
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func formattedTime(_ value: Double) -> String {
        let seconds = max(0, Int(value.isFinite ? value : 0))
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let remaining = seconds % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, remaining)
            : String(format: "%02d:%02d", minutes, remaining)
    }

    private func updateProgress(position: Double, duration: Double) {
        guard position.isFinite, duration.isFinite else { return }
        durationSeconds = max(0, duration)
        positionSeconds = max(0, min(position, durationSeconds))
        if durationSeconds > 0 {
            positionSlider.maximumValue = Float(min(durationSeconds, Double(Float.greatestFiniteMagnitude)))
            positionSlider.value = Float(positionSeconds)
            positionSlider.isEnabled = playerReady && !playerError
            rewindButton.isEnabled = positionSeconds > 0 && !playerError
            forwardButton.isEnabled = positionSeconds < durationSeconds && !playerError
            let positionText = formattedTime(positionSeconds)
            let durationText = formattedTime(durationSeconds)
            positionSlider.accessibilityValue = positionText + (spanish ? " de " : " of ") + durationText
            progressLabel.text = (spanish ? "Tiempo: " : "Time: ")
                + positionText + " / " + durationText
        }
    }

    // YouTube can replace the app audio category after viewWillAppear.
    // Reapply the mixing policy at the actual PLAYING transition, not at
    // every 1-second progress update.
    private func refreshAudioMixAfterPlaybackBegins() {
        pendingMixRefresh?.cancel()
        guard shouldMixAudio else { return }
        let refresh = DispatchWorkItem { [weak self] in
            guard let self = self,
                  self.isViewLoaded, self.view.window != nil,
                  self.shouldMixAudio, self.playerState == 1 else { return }
            if !self.audioMix.activate() {
                self.statusLabel.text = self.spanish
                    ? "No se pudo mantener la mezcla de audio con VoiceOver."
                    : "Could not maintain VoiceOver audio mixing."
            }
        }
        pendingMixRefresh = refresh
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(450), execute: refresh)
    }

    private func updatePlaybackState(_ state: Int) {
        guard !playerError else { return }
        let playbackJustStarted = state == 1 && playerState != 1
        playerState = state
        if playbackJustStarted { refreshAudioMixAfterPlaybackBegins() }
        // YouTube state 1 = playing; 2 = paused; 0 = ended; 3 = buffering.
        let playing = state == 1 || state == 3
        playbackButton.setTitle(
            playing ? (spanish ? "Pausar vídeo" : "Pause video")
                    : (spanish ? "Reproducir vídeo" : "Play video"), for: .normal
        )
        playbackButton.isEnabled = playerReady
    }

    private func presentPlayerError(_ code: Int) {
        playerError = true
        playerReady = false
        playbackButton.isEnabled = false
        rewindButton.isEnabled = false
        forwardButton.isEnabled = false
        positionSlider.isEnabled = false
        let number = code > 0 ? " (YouTube " + String(code) + ")" : ""
        statusLabel.text = (spanish
            ? "No se pudo reproducir el vídeo" : "Video playback failed") + number
            + (spanish ? ". Utiliza Abrir en YouTube." : ". Use Open in YouTube.")
        UIAccessibility.post(notification: .announcement, argument: statusLabel.text)
    }

    // Only main-frame messages from our bundled HTML are accepted; arbitrary
    // third-party frame messages cannot control the native UI.
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "tifloPlayer", message.frameInfo.isMainFrame,
              let data = message.body as? [String: Any],
              let event = data["type"] as? String else { return }
        switch event {
        case "ready":
            playerReady = true
            playerError = false
            playbackButton.isEnabled = true
            statusLabel.text = spanish
                ? "Vídeo preparado. Usa los controles de reproducción."
                : "Video ready. Use playback controls."
        case "state":
            if let state = data["state"] as? Int { updatePlaybackState(state) }
        case "progress":
            guard let position = data["position"] as? Double,
                  let duration = data["duration"] as? Double else { return }
            updateProgress(position: position, duration: duration)
            if let state = data["state"] as? Int { updatePlaybackState(state) }
        case "error":
            presentPlayerError(data["code"] as? Int ?? 0)
        case "blocked":
            statusLabel.text = spanish
                ? "La reproducción automática está bloqueada. Activa Reproducir dentro del vídeo de YouTube."
                : "Automatic playback is blocked. Activate Play inside the YouTube video."
        default: break
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Loading the HTML wrapper does not mean the YouTube player is ready.
        // Wait for onReady via WKScriptMessageHandler.
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
            } else if playerState == 1 {
                refreshAudioMixAfterPlaybackBegins()
            }
        } else {
            pendingMixRefresh?.cancel()
            pendingMixRefresh = nil
            audioMix.restore()
        }
        // Update the audio policy in the top document and its cross-origin
        // children without reloading the video or losing the playback position.
        let enabled = shouldMixAudio ? "true" : "false"
        let script = "window.postMessage({type:'tiflo-voiceover-audio-policy-v1',enabled:" + enabled + "},'*');"
        webView?.evaluateJavaScript(script, completionHandler: nil)
        audioCompatibilityButton.setTitle(audioCompatibilityTitle(), for: .normal)
        UIAccessibility.post(notification: .announcement, argument: audioCompatibilityTitle())
    }

    @objc private func togglePlayback() {
        guard playerReady && !playerError else { return }
        sendPlayerCommand(playerState == 1 || playerState == 3 ? "pause" : "play")
    }

    @objc private func rewindThirtySeconds() {
        seek(by: -30)
    }

    @objc private func forwardThirtySeconds() {
        seek(by: 30)
    }

    private func seek(by seconds: Double) {
        guard durationSeconds > 0 else { return }
        let target = max(0, min(durationSeconds, positionSeconds + seconds))
        sendPlayerCommand("seek", at: target)
        // Announce only user-triggered seeks, not automatic progress updates.
        let message = (spanish ? "Posición: " : "Position: ") + formattedTime(target)
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    @objc private func changePosition() {
        guard playerReady && durationSeconds > 0 else { return }
        sendPlayerCommand("seek", at: Double(positionSlider.value))
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
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "tifloPlayer")
        webView.loadHTMLString("", baseURL: nil)
        let completion = onClose
        dismiss(animated: true, completion: completion)
    }

    @objc private func openOriginal() {
        guard let url = URL(string: "https://www.youtube.com/watch?v=" + videoId) else { return }
        UIApplication.shared.open(url)
    }
}
