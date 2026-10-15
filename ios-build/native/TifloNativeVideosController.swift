import UIKit

// Dedicated TifloAcosta iOS videos screen. The HTML catalog is a data source,
// never a second screen VoiceOver users have to dismiss to reach search.
private struct TifloVideoRecord {
    let id: String
    let title: String
    let channel: String
    let published: String
    let description: String
    let duration: Double
    let views: Int

    init?(_ raw: [String: Any]) {
        guard let id = raw["id"] as? String,
              id.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil,
              let title = raw["title"] as? String, !title.isEmpty else { return nil }
        self.id = id
        self.title = String(title.prefix(250))
        self.channel = String((raw["channelTitle"] as? String ?? raw["channel"] as? String ?? "TifloAcosta").prefix(180))
        self.published = String((raw["publishedAt"] as? String ?? "").prefix(50))
        self.description = String((raw["fullDescription"] as? String ?? raw["description"] as? String ?? "").prefix(6000))
        self.duration = max(0, (raw["durationSeconds"] as? NSNumber)?.doubleValue ?? 0)
        self.views = max(0, (raw["viewCount"] as? NSNumber)?.intValue ?? 0)
    }

    // Visible metadata is intentionally subordinate to the title. VoiceOver
    // reads the entire record as ONE accessible row, regardless of line wraps.
    var visualMetadata: String {
        var parts: [String] = []
        if !channel.isEmpty { parts.append(channel) }
        if !published.isEmpty {
            let formatter = ISO8601DateFormatter()
            if let dateValue = formatter.date(from: published) {
                let style = DateFormatter()
                style.locale = Locale(identifier: "es_ES")
                style.dateStyle = .medium
                parts.append(style.string(from: dateValue))
            } else { parts.append(String(published.prefix(10))) }
        }
        if duration > 0 {
            let total = Int(duration)
            parts.append(total >= 3600
                ? String(format: "%d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
                : String(format: "%d:%02d", total / 60, total % 60))
        }
        if views > 0 {
            parts.append("\(views.formatted(.number)) visualizaciones")
        }
        return parts.joined(separator: " · ")
    }

    var speech: String {
        var parts = [title]
        if !channel.isEmpty { parts.append("Canal: " + channel) }
        if !published.isEmpty {
            let iso = ISO8601DateFormatter()
            if let day = iso.date(from: published) {
                let date = DateFormatter()
                date.locale = Locale(identifier: "es_ES")
                date.dateStyle = .medium
                parts.append("Publicado: " + date.string(from: day))
            } else { parts.append("Publicado: " + published.prefix(10)) }
        }
        if duration > 0 {
            let total = Int(duration)
            parts.append("Duración: " + (total >= 3600
                ? String(format: "%d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
                : String(format: "%d:%02d", total / 60, total % 60)))
        }
        if views > 0 { parts.append("Visualizaciones: " + String(views)) }
        return parts.joined(separator: ". ")
    }
}

private final class TifloVideoRotorAction: NSObject {
    let action: UIAccessibilityCustomAction
    init(_ label: String, callback: @escaping () -> Void) {
        // UIAccessibilityCustomAction retains the closure with the corresponding
        // cell; there is no global, possibly stale, focused-video identifier.
        action = UIAccessibilityCustomAction(name: label, actionHandler: { _ in
            callback()
            return true
        })
        super.init()
    }
}

// Colours are passed from the same CSS variables that render TifloAcosta's
// other sections. This native accessible list does not maintain a second theme.
private struct TifloVideoTheme {
    let background: UIColor
    let surface: UIColor
    let text: UIColor
    let muted: UIColor
    let border: UIColor
    let brand: UIColor

    static func color(_ raw: String?, fallback: String) -> UIColor {
        let source = ((raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            .hasPrefix("#") ? raw : nil) ?? fallback
        let hex = String(source.dropFirst())
        guard (hex.count == 6 || hex.count == 3),
              hex.allSatisfy({ $0.isHexDigit }) else { return color(nil, fallback: fallback) }
        let full = hex.count == 3 ? hex.map { "\($0)\($0)" }.joined() : hex
        guard let value = UInt64(full, radix: 16) else { return UIColor.black }
        return UIColor(red: CGFloat((value >> 16) & 255) / 255,
                       green: CGFloat((value >> 8) & 255) / 255,
                       blue: CGFloat(value & 255) / 255, alpha: 1)
    }

    init(_ raw: [String: String]) {
        background = Self.color(raw["background"], fallback: "#0B0B0B")
        surface = Self.color(raw["surface"], fallback: "#151010")
        text = Self.color(raw["text"], fallback: "#FFFFFF")
        muted = Self.color(raw["muted"], fallback: "#E7E1E1")
        border = Self.color(raw["border"], fallback: "#806969")
        brand = Self.color(raw["brand"], fallback: "#A61B1B")
    }
}

// Real UIKit cells keep UIAccessibilityCustomAction on the focused video.
// These decorations are NOT extra VoiceOver stops: the whole cell is one
// accessible element, while the visible hierarchy follows TifloAcosta.
private final class TifloBrandedVideoCell: UITableViewCell {
    static let reuseId = "TifloBrandedVideoCell"
    let heading = UILabel()
    let metadata = UILabel()
    private let panel = UIView()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        contentView.backgroundColor = .clear
        selectionStyle = .none

        panel.backgroundColor = UIColor(red: 0.10, green: 0.065, blue: 0.068, alpha: 1)
        panel.layer.cornerRadius = 18
        panel.layer.borderWidth = 1
        panel.layer.borderColor = UIColor(red: 0.48, green: 0.32, blue: 0.33, alpha: 1).cgColor
        panel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(panel)

        heading.font = UIFont.preferredFont(forTextStyle: .body)
        heading.adjustsFontForContentSizeCategory = true
        heading.textColor = .white
        heading.numberOfLines = 0
        metadata.font = UIFont.preferredFont(forTextStyle: .footnote)
        metadata.adjustsFontForContentSizeCategory = true
        metadata.textColor = UIColor(white: 0.80, alpha: 1)
        metadata.numberOfLines = 0

        let text = UIStackView(arrangedSubviews: [heading, metadata])
        text.axis = .vertical
        text.alignment = .fill
        text.spacing = 5
        text.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(text)
        NSLayoutConstraint.activate([
            panel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            panel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            panel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 14),
            panel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -14),
            text.topAnchor.constraint(equalTo: panel.topAnchor, constant: 14),
            text.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -14),
            text.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 16),
            text.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -16)
        ])
        isAccessibilityElement = true
        accessibilityTraits = [.button]
    }

    required init?(coder: NSCoder) { return nil }

    func configure(title: String, info: String?, theme: TifloVideoTheme, isMore: Bool = false) {
        panel.backgroundColor = theme.surface
        heading.textColor = theme.text
        metadata.textColor = theme.muted

        heading.text = title
        heading.font = UIFont.preferredFont(forTextStyle: isMore ? .headline : .body)
        metadata.text = info
        metadata.isHidden = info?.isEmpty ?? true
        panel.layer.borderColor = (isMore ? theme.brand : theme.border).cgColor
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        accessibilityCustomActions = []
        accessibilityHint = nil
        accessibilityLabel = nil
    }
}

final class TifloNativeVideosController: UITableViewController, UISearchBarDelegate {
    var onClosed: (() -> Void)?
    private let startingVideos: [TifloVideoRecord]
    private var channelVideos: [TifloVideoRecord]
    private var searchVideos: [TifloVideoRecord] = []
    private var showingSearch = false
    private var ascending = false
    private var limit = 10
    private var nextToken = ""
    private var query = ""
    private var loading = false
    private var needsInitialFocus = true
    private let searchBar = UISearchBar()
    private let order = UISegmentedControl(items: ["Recientes", "Antiguos"])
    private let stateLabel = UILabel()
    private let backButton = UIButton(type: .system)
    private let sectionHeading = UILabel()
    private let sectionIntro = UILabel()
    private let theme: TifloVideoTheme
    private var retainedActions = [IndexPath: [TifloVideoRotorAction]]()

    init(videos: [[String: Any]], theme: [String: String] = [:]) {
        self.theme = TifloVideoTheme(theme)
        let parsed = videos.compactMap(TifloVideoRecord.init)
        startingVideos = parsed
        channelVideos = parsed
        super.init(style: .plain)
    }
    required init?(coder: NSCoder) { return nil }

    private var current: [TifloVideoRecord] {
        if showingSearch { return searchVideos }
        return channelVideos.sorted { ascending ? $0.published < $1.published : $0.published > $1.published }
    }
    private var visible: [TifloVideoRecord] { Array(current.prefix(limit)) }
    private var canShowMore: Bool {
        showingSearch ? (!nextToken.isEmpty || visible.count < current.count)
                      : visible.count < current.count
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Vídeos de TifloAcosta"
        // No separate UIKit navigation bar: the back action and section title
        // belong to the same content hierarchy as the other TifloAcosta pages.
        navigationController?.setNavigationBarHidden(true, animated: false)
        view.backgroundColor = theme.background
        tableView.backgroundColor = view.backgroundColor
        tableView.separatorStyle = .none
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 94
        tableView.register(TifloBrandedVideoCell.self, forCellReuseIdentifier: TifloBrandedVideoCell.reuseId)

        searchBar.placeholder = "Buscar vídeos públicos en YouTube"
        searchBar.searchBarStyle = .minimal
        searchBar.searchTextField.textColor = theme.text
        searchBar.searchTextField.backgroundColor = theme.background
        searchBar.searchTextField.layer.cornerRadius = 12
        searchBar.searchTextField.layer.masksToBounds = true
        searchBar.searchTextField.layer.borderWidth = 1
        searchBar.searchTextField.layer.borderColor = theme.border.cgColor
        searchBar.searchTextField.attributedPlaceholder = NSAttributedString(
            string: "Buscar vídeos públicos en YouTube",
            attributes: [.foregroundColor: theme.muted]
        )
        searchBar.delegate = self
        searchBar.returnKeyType = .search
        searchBar.accessibilityIdentifier = "tiflo-youtube-search-native"

        order.selectedSegmentIndex = 0
        order.selectedSegmentTintColor = theme.brand
        order.backgroundColor = theme.background
        order.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .selected)
        order.setTitleTextAttributes([.foregroundColor: theme.text], for: .normal)
        order.accessibilityLabel = "Orden de vídeos del canal"
        order.addTarget(self, action: #selector(changeOrder), for: .valueChanged)

        stateLabel.textColor = theme.muted
        stateLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
        stateLabel.adjustsFontForContentSizeCategory = true
        stateLabel.numberOfLines = 0

        backButton.setTitle("Volver al inicio", for: .normal)
        backButton.setTitleColor(.white, for: .normal)
        backButton.backgroundColor = theme.brand
        backButton.layer.cornerRadius = 10
        backButton.contentEdgeInsets = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        backButton.titleLabel?.font = UIFont.preferredFont(forTextStyle: .body)
        backButton.titleLabel?.adjustsFontForContentSizeCategory = true
        backButton.addTarget(self, action: #selector(closeToHome), for: .touchUpInside)
        backButton.accessibilityIdentifier = "tiflo-videos-back-home"

        sectionHeading.text = "Vídeos"
        sectionHeading.textColor = theme.text
        sectionHeading.font = UIFont.preferredFont(forTextStyle: .title1)
        sectionHeading.adjustsFontForContentSizeCategory = true
        sectionHeading.numberOfLines = 0
        sectionHeading.accessibilityTraits = [.header]

        sectionIntro.text = "Buscar en YouTube o explorar los vídeos de TifloAcosta."
        sectionIntro.textColor = theme.muted
        sectionIntro.font = UIFont.preferredFont(forTextStyle: .subheadline)
        sectionIntro.adjustsFontForContentSizeCategory = true
        sectionIntro.numberOfLines = 0

        let header = UIStackView(arrangedSubviews: [
            backButton, sectionHeading, sectionIntro, searchBar, order, stateLabel
        ])
        header.axis = .vertical
        header.spacing = 8
        header.isLayoutMarginsRelativeArrangement = true
        header.layoutMargins = UIEdgeInsets(top: 14, left: 18, bottom: 16, right: 18)
        header.backgroundColor = theme.surface
        header.layer.cornerRadius = 16
        header.layer.borderWidth = 1
        header.layer.borderColor = theme.border.cgColor
        header.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: 255)
        tableView.tableHeaderView = header
        updateState()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let header = tableView.tableHeaderView, tableView.bounds.width > 0 else { return }
        let size = header.systemLayoutSizeFitting(
            CGSize(width: tableView.bounds.width, height: UIView.layoutFittingCompressedSize.height),
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        )
        if size.height > 0 && abs(size.height - header.frame.height) > 1 {
            header.frame.size.height = size.height
            tableView.tableHeaderView = header
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard needsInitialFocus && UIAccessibility.isVoiceOverRunning else { return }
        needsInitialFocus = false
        UIAccessibility.post(notification: .screenChanged, argument: sectionHeading)
    }

    @objc private func closeToHome() {
        // When embedded as an app section, there is no modal to dismiss.
        // Release the native section before returning to the web app home.
        let completion = onClosed
        if presentingViewController != nil {
            dismiss(animated: true, completion: completion)
        } else {
            completion?()
        }
    }

    @objc private func changeOrder() {
        ascending = order.selectedSegmentIndex == 1
        limit = 10
        showingSearch = false
        retainedActions.removeAll()
        tableView.reloadData()
        updateState()
    }

    private func updateState(_ override: String? = nil) {
        if let override = override { stateLabel.text = override; return }
        stateLabel.text = showingSearch
            ? "Resultados de YouTube: \(searchVideos.count) vídeos cargados."
            : "Vídeos de TifloAcosta: \(min(limit, channelVideos.count)) de \(channelVideos.count)."
        order.isHidden = showingSearch
        // A search-mode return button belongs to the same header, not a
        // navigation bar. The search field stays accessible by a single swipe.
        if showingSearch {
            order.isHidden = true
        }
    }

    @objc private func backToChannel() {
        showingSearch = false
        limit = 10
        searchBar.text = ""
        searchBar.resignFirstResponder()
        retainedActions.removeAll()
        tableView.reloadData()
        updateState()
        UIAccessibility.post(notification: .screenChanged, argument: tableView)
    }

    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        let entered = (searchBar.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard entered.count >= 2 && entered.count <= 100 else {
            updateState("Escribe entre 2 y 100 caracteres para buscar.")
            UIAccessibility.post(notification: .announcement, argument: stateLabel.text)
            return
        }
        searchBar.resignFirstResponder()
        query = entered
        nextToken = ""
        searchVideos = []
        showingSearch = true
        limit = 10
        retainedActions.removeAll()
        tableView.reloadData()
        updateState("Buscando en YouTube…")
        requestResults(append: false)
    }

    private func requestResults(append: Bool) {
        guard !loading else { return }
        loading = true
        var url = URLComponents(string: "https://youtube-auth.tifloacosta.com/search")
        url?.queryItems = [URLQueryItem(name: "q", value: query)]
        if append && !nextToken.isEmpty {
            url?.queryItems?.append(URLQueryItem(name: "pageToken", value: nextToken))
        }
        guard let target = url?.url else { loading = false; return }
        var request = URLRequest(url: target)
        request.timeoutInterval = 18
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("capacitor://localhost", forHTTPHeaderField: "Origin")
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.loading = false
                guard error == nil, let status = response as? HTTPURLResponse,
                      status.statusCode == 200, let data = data,
                      data.count < 500_000,
                      let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let raw = response["items"] as? [[String: Any]] else {
                    self.updateState("No se pudo realizar la búsqueda. Inténtalo de nuevo.")
                    UIAccessibility.post(notification: .announcement, argument: self.stateLabel.text)
                    return
                }
                self.searchVideos += raw.compactMap(TifloVideoRecord.init)
                self.nextToken = response["nextPageToken"] as? String ?? ""
                self.limit = self.searchVideos.count
                self.retainedActions.removeAll()
                self.tableView.reloadData()
                self.updateState()
                UIAccessibility.post(notification: .announcement, argument: self.stateLabel.text)
            }
        }.resume()
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        visible.count + (canShowMore ? 1 : 0)
    }
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(
            withIdentifier: TifloBrandedVideoCell.reuseId, for: indexPath
        ) as? TifloBrandedVideoCell else { return UITableViewCell() }
        if indexPath.row == visible.count {
            cell.configure(title: showingSearch ? "Mostrar diez resultados más" : "Mostrar diez vídeos más", info: nil, theme: theme, isMore: true)
            cell.accessibilityLabel = showingSearch ? "Mostrar diez resultados más" : "Mostrar diez vídeos más"
            cell.accessibilityCustomActions = []
        } else {
            let video = visible[indexPath.row]
            cell.configure(title: video.title, info: video.visualMetadata, theme: theme)
            cell.accessibilityLabel = video.speech
            let actions: [(String, String)] = [
                ("play", "Reproducir"),
                ("youtube", "Abrir en YouTube"),
                ("like", "Me gusta"),
                ("subscribe", "Suscripción"),
                ("share", "Compartir"),
                ("comment", "Comentar")
            ]
            let handlers = actions.map { action in
                TifloVideoRotorAction(action.1) { [weak self] in
                    self?.perform(action: action.0, video: video)
                }
            }
            retainedActions[indexPath] = handlers
            cell.accessibilityCustomActions = handlers.map(\.action)
            cell.accessibilityHint = "Acciones de VoiceOver: flic arriba o abajo, y doble toque."
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if indexPath.row == visible.count {
            if showingSearch && !nextToken.isEmpty {
                updateState("Cargando otros diez resultados…")
                requestResults(append: true)
            } else { limit += 10; tableView.reloadData(); updateState() }
        } else { perform(action: "play", video: visible[indexPath.row]) }
    }

    override func tableView(_ tableView: UITableView,
                            contextMenuConfigurationForRowAt indexPath: IndexPath,
                            point: CGPoint) -> UIContextMenuConfiguration? {
        guard indexPath.row < visible.count else { return nil }
        let video = visible[indexPath.row]
        let options: [(String, String)] = [
            ("play", "Reproducir"), ("youtube", "Abrir en YouTube"),
            ("like", "Me gusta"), ("subscribe", "Suscripción"),
            ("share", "Compartir"), ("comment", "Comentar")
        ]
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
            UIMenu(children: options.map { pair in
                UIAction(title: pair.1) { [weak self] _ in
                    self?.perform(action: pair.0, video: video)
                }
            })
        }
    }

    private func perform(action: String, video: TifloVideoRecord) {
        guard let url = URL(string: "https://www.youtube.com/watch?v=" + video.id) else { return }
        switch action {
        case "play":
            let player = TifloYouTubeViewController(
                videoId: video.id, title: video.title, description: video.description,
                channel: video.channel, publishedAt: video.published)
            player.modalPresentationStyle = .fullScreen
            present(player, animated: true)
        case "youtube":
            UIApplication.shared.open(url)
        case "share":
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = view
                popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY,
                                            width: 1, height: 1)
            }
            present(sheet, animated: true)
        case "like", "subscribe", "comment":
            accountAction(action, video: video)
        default: break
        }
    }

    private func accountAction(_ action: String, video: TifloVideoRecord) {
        let account = TifloNativeYouTubeAccount.shared
        let proceed = { [weak self] in self?.authorizedAction(action, video: video) }
        if account.hasLocalSession { proceed(); return }
        account.signIn(from: self) { result in
            if case .success = result { proceed() }
            else { UIAccessibility.post(notification: .announcement,
                                        argument: "No se completó el inicio de sesión en YouTube.") }
        }
    }

    private func authorizedAction(_ action: String, video: TifloVideoRecord) {
        if action == "comment" {
            let alert = UIAlertController(title: "Comentar", message: video.title, preferredStyle: .alert)
            alert.addTextField { $0.placeholder = "Escribe tu comentario" }
            alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
            alert.addAction(UIAlertAction(title: "Publicar", style: .default) { [weak self] _ in
                let message = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard !message.isEmpty else { return }
                TifloNativeYouTubeAccount.shared.perform(action: "comment", videoId: video.id, text: message) { result in
                    self?.announce(result.isSuccess ? "Comentario publicado." : "No se pudo publicar el comentario.")
                }
            })
            present(alert, animated: true)
            return
        }
        TifloNativeYouTubeAccount.shared.state(videoId: video.id) { [weak self] result in
            guard let self = self else { return }
            guard case .success(let state) = result else {
                self.announce("No se pudo consultar el estado de tu cuenta.")
                return
            }
            let name: String
            let title: String
            if action == "like" {
                name = (state["rating"] as? String) == "like" ? "unlike" : "like"
                title = name == "like" ? "Dar Me gusta" : "Quitar Me gusta"
            } else {
                name = state["subscribed"] as? Bool == true ? "unsubscribe" : "subscribe"
                title = name == "subscribe" ? "Suscribirse al canal" : "Cancelar suscripción"
            }
            let alert = UIAlertController(title: title, message: video.title, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel))
            alert.addAction(UIAlertAction(title: "Confirmar", style: .default) { [weak self] _ in
                TifloNativeYouTubeAccount.shared.perform(action: name, videoId: video.id) { result in
                    self?.announce(result.isSuccess
                        ? (name == "like" ? "Me gusta registrado."
                           : name == "unlike" ? "Me gusta retirado."
                           : name == "subscribe" ? "Suscripción realizada." : "Suscripción cancelada.")
                        : "No se pudo realizar la acción de YouTube.")
                }
            })
            self.present(alert, animated: true)
        }
    }
    private func announce(_ text: String) {
        stateLabel.text = text
        UIAccessibility.post(notification: .announcement, argument: text)
    }
}

private extension Result {
    var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }
}
