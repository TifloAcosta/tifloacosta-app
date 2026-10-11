import UIKit
import WebKit
import Capacitor

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
        CAPPluginMethod(name: "publicFile", returnType: CAPPluginReturnPromise)
    ]

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
    private let detailsPanel = UITextView()
    private let statusLabel = UILabel()
    private var webView: WKWebView!
    private var pausedFromNative = false
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

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        // Do not take over AVAudioSession. VoiceOver speech must be checked
        // on the device before changing audio-session policy.
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

        let stack = UIStackView(arrangedSubviews: [
            header, titleLabel, controls, statusLabel, detailsPanel, webView
        ])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.distribution = .fill
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: safe.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -12),
            header.heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
            controls.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            webView.heightAnchor.constraint(greaterThanOrEqualToConstant: 140)
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
        UIAccessibility.post(notification: .screenChanged, argument: closeButton)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        playbackButton.isEnabled = true
        statusLabel.text = spanish
            ? "Vídeo preparado. Puedes utilizar sus controles y volver a esta fila para pausarlo."
            : "Video ready. Use the player controls, then return here to pause."
    }

    @objc private func togglePlayback() {
        guard webView != nil, playbackButton.isEnabled else { return }
        if pausedFromNative {
            webView.resumeAllMediaPlayback()
            pausedFromNative = false
            playbackButton.setTitle(spanish ? "Pausar vídeo" : "Pause video", for: .normal)
            statusLabel.text = spanish ? "Reanudando vídeo." : "Resuming video."
        } else {
            webView.pauseAllMediaPlayback { [weak self] in
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    self.pausedFromNative = true
                    self.playbackButton.setTitle(self.spanish ? "Reanudar vídeo" : "Resume video", for: .normal)
                    self.statusLabel.text = self.spanish ? "Vídeo en pausa." : "Video paused."
                }
            }
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
