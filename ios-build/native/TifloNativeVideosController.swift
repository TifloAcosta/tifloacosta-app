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

    func configure(title: String, info: String?, isMore: Bool = false) {
        heading.text = title
        heading.font = UIFont.preferredFont(forTextStyle: isMore ? .headline : .body)
        metadata.text = info
        metadata.isHidden = info?.isEmpty ?? true
        panel.layer.borderColor = (isMore
            ? UIColor(red: 0.72, green: 0.15, blue: 0.16, alpha: 1)
            : UIColor(red: 0.48, green: 0.32, blue: 0.33, alpha: 1)).cgColor
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
    private var retainedActions = [IndexPath: [TifloVideoRotorAction]]()
    private let brandRed = UIColor(red: 0.65, green: 0.10, blue: 0.11, alpha: 1)

    init(videos: [[String: Any]]) {
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
        navigationController?.navigationBar.prefersLargeTitles = false
        navigationController?.navigationBar.barTintColor = brandRed
        navigationController?.navigationBar.backgroundColor = brandRed
        navigationController?.navigationBar.tintColor = .white
        navigationController?.navigationBar.titleTextAttributes = [.foregroundColor: UIColor.white]
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Volver al inicio", style: .plain, target: self, action: #selector(closeToHome))
        view.backgroundColor = UIColor(red: 0.045, green: 0.041, blue: 0.043, alpha: 1)
        tableView.backgroundColor = view.backgroundColor
        tableView.separatorStyle = .none
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 94
        tableView.register(TifloBrandedVideoCell.self, forCellReuseIdentifier: TifloBrandedVideoCell.reuseId)

        searchBar.placeholder = "Buscar vídeos públicos en YouTube"
        searchBar.searchBarStyle = .minimal
        searchBar.searchTextField.textColor = .white
        searchBar.searchTextField.backgroundColor = UIColor(red: 0.08, green: 0.065, blue: 0.067, alpha: 1)
        searchBar.searchTextField.layer.cornerRadius = 12
        searchBar.searchTextField.layer.masksToBounds = true
        searchBar.searchTextField.layer.borderWidth = 1
        searchBar.searchTextField.layer.borderColor = brandRed.cgColor
        searchBar.searchTextField.attributedPlaceholder = NSAttributedString(
            string: "Buscar vídeos públicos en YouTube",
            attributes: [.foregroundColor: UIColor(white: 0.77, alpha: 1)]
        )
        searchBar.delegate = self
        searchBar.returnKeyType = .search
        searchBar.accessibilityIdentifier = "tiflo-youtube-search-native"

        order.selectedSegmentIndex = 0
        order.selectedSegmentTintColor = brandRed
        order.backgroundColor = UIColor(red: 0.12, green: 0.10, blue: 0.11, alpha: 1)
        order.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .selected)
        order.setTitleTextAttributes([.foregroundColor: UIColor.white], for: .normal)
        order.accessibilityLabel = "Orden de vídeos del canal"
        order.addTarget(self, action: #selector(changeOrder), for: .valueChanged)

        stateLabel.textColor = .white
        stateLabel.font = UIFont.preferredFont(forTextStyle: .footnote)
        stateLabel.adjustsFontForContentSizeCategory = true
        stateLabel.numberOfLines = 0

        let header = UIStackView(arrangedSubviews: [searchBar, order, stateLabel])
        header.axis = .vertical
        header.spacing = 8
        header.isLayoutMarginsRelativeArrangement = true
        header.layoutMargins = UIEdgeInsets(top: 14, left: 18, bottom: 16, right: 18)
        header.backgroundColor = UIColor(red: 0.10, green: 0.065, blue: 0.068, alpha: 1)
        header.layer.cornerRadius = 18
        header.layer.borderWidth = 1
        header.layer.borderColor = UIColor(red: 0.48, green: 0.32, blue: 0.33, alpha: 1).cgColor
        header.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: 170)
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
        UIAccessibility.post(notification: .screenChanged, argument: navigationItem.leftBarButtonItem)
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
        navigationItem.rightBarButtonItem = showingSearch
            ? UIBarButtonItem(title: "Volver al canal", style: .plain,
                              target: self, action: #selector(backToChannel))
            : nil
        navigationItem.rightBarButtonItem?.tintColor = .white
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
            cell.configure(title: showingSearch ? "Mostrar diez resultados más" : "Mostrar diez vídeos más", info: nil, isMore: true)
            cell.accessibilityLabel = showingSearch ? "Mostrar diez resultados más" : "Mostrar diez vídeos más"
            cell.accessibilityCustomActions = []
        } else {
            let video = visible[indexPath.row]
            cell.configure(title: video.title, info: video.visualMetadata)
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
