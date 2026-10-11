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
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

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
            let controller = TifloYouTubeViewController(videoId: videoId)
            controller.modalPresentationStyle = .fullScreen
            presenting.present(controller, animated: true) {
                call.resolve()
            }
        }
    }
}

/// Uses Google's documented WKWebView loadRequest with an app-ID Referer.
/// It does not pretend to originate from youtube.com and does not proxy media.
private final class TifloYouTubeViewController: UIViewController, WKNavigationDelegate {
    private let videoId: String
    private let spanish = Locale.preferredLanguages.first?.lowercased().hasPrefix("es") ?? true
    private var closeButton = UIButton(type: .system)
    private var statusLabel = UILabel()
    private var webView: WKWebView!

    init(videoId: String) {
        self.videoId = videoId
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let header = UIStackView()
        header.axis = .horizontal
        header.alignment = .center
        header.distribution = .fillEqually
        header.spacing = 12
        header.translatesAutoresizingMaskIntoConstraints = false

        closeButton.setTitle(spanish ? "Cerrar vídeo y volver" : "Close video and return", for: .normal)
        closeButton.accessibilityLabel = closeButton.title(for: .normal)
        closeButton.addTarget(self, action: #selector(closePlayer), for: .touchUpInside)
        closeButton.titleLabel?.numberOfLines = 2

        let openYouTube = UIButton(type: .system)
        openYouTube.setTitle(spanish ? "Abrir en YouTube" : "Open in YouTube", for: .normal)
        openYouTube.accessibilityLabel = openYouTube.title(for: .normal)
        openYouTube.addTarget(self, action: #selector(openOriginal), for: .touchUpInside)
        openYouTube.titleLabel?.numberOfLines = 2
        header.addArrangedSubview(closeButton)
        header.addArrangedSubview(openYouTube)

        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.accessibilityLabel = spanish ? "Reproductor de YouTube" : "YouTube player"
        webView.scrollView.isScrollEnabled = false

        statusLabel.text = spanish ? "Cargando reproductor de vídeo." : "Loading video player."
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.accessibilityTraits = .staticText

        view.addSubview(header)
        view.addSubview(statusLabel)
        view.addSubview(webView)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            header.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            header.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -16),
            header.topAnchor.constraint(equalTo: safe.topAnchor, constant: 12),
            header.heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
            statusLabel.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 8),
            statusLabel.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -16),
            webView.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 12),
            webView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: safe.bottomAnchor)
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
        statusLabel.text = spanish ? "Reproductor cargado. Usa sus controles para reproducir." :
          "Player loaded. Use its controls to play."
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        statusLabel.text = spanish ? "El vídeo no se pudo cargar. Puedes abrirlo en YouTube." :
          "Video could not load. You can open it on YouTube."
        UIAccessibility.post(notification: .announcement, argument: statusLabel.text)
    }

    @objc private func closePlayer() {
        webView.stopLoading()
        webView.loadHTMLString("", baseURL: nil)
        dismiss(animated: true)
    }

    @objc private func openOriginal() {
        guard let url = URL(string: "https://www.youtube.com/watch?v=" + videoId) else { return }
        UIApplication.shared.open(url)
    }
}
