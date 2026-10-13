import Foundation
import UIKit
import Capacitor

// Separate native document-title accessibility surface: WKWebView DOM buttons
// cannot receive UIAccessibilityCustomAction through a Capacitor view plugin.
@objc(TifloReadingAccessibilityPlugin)
public final class TifloReadingAccessibilityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloReadingAccessibilityPlugin"
    public let jsName = "TifloReadingAccessibility"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "presentLibrary", returnType: CAPPluginReturnPromise)
    ]

    private weak var activeNavigation: UINavigationController?

    @objc public func presentLibrary(_ call: CAPPluginCall) {
        let rawItems = call.getArray("items") as? [[String: Any]] ?? []
        let language = (call.getString("language") ?? "es").lowercased()
        let english = language.hasPrefix("en")
        // This is one filtered/paginated web-library page, not an entire unbounded archive.
        guard !rawItems.isEmpty && rawItems.count <= 60 else {
            call.reject("No library books on the current page")
            return
        }
        let books = rawItems.compactMap { entry -> ReadingLibraryNativeItem? in
            guard let id = entry["id"] as? String, !id.isEmpty, id.count <= 256,
                  let title = entry["title"] as? String, !title.isEmpty else { return nil }
            return ReadingLibraryNativeItem(
                id: id, title: String(title.prefix(350)),
                format: String((entry["format"] as? String ?? "").prefix(20)),
                percent: max(0, min(100, entry["percent"] as? Double ?? 0))
            )
        }
        guard !books.isEmpty else {
            call.reject("No valid library items")
            return
        }
        DispatchQueue.main.async {
            guard self.activeNavigation == nil,
                  let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("A native view is already displayed")
                return
            }
            let screen = ReadingLibraryNativeScreen(items: books, english: english)
            let nav = UINavigationController(rootViewController: screen)
            nav.modalPresentationStyle = .fullScreen
            self.activeNavigation = nav
            screen.onDismiss = { [weak self, weak nav] in
                nav?.dismiss(animated: true) {
                    self?.activeNavigation = nil
                    self?.notifyListeners("readingLibraryClosed", data: [:])
                }
            }
            screen.onAction = { [weak self, weak nav] id, action in
                nav?.dismiss(animated: true) {
                    self?.activeNavigation = nil
                    self?.notifyListeners("readingLibraryAction", data: [
                        "id": id, "action": action
                    ])
                }
            }
            presenter.present(nav, animated: true) {
                UIAccessibility.post(notification: .screenChanged, argument: screen.navigationItem.title)
            }
            call.resolve(["opened": true, "count": books.count])
        }
    }
}

private struct ReadingLibraryNativeItem {
    let id: String
    let title: String
    let format: String
    let percent: Double
}

private final class ReadingLibraryActionCell: UITableViewCell {
    var onAction: ((String) -> Void)?
    private func activate(_ action: String) -> Bool {
        guard let onAction else { return false }
        onAction(action)
        return true
    }
    @objc func openAction(_ action: UIAccessibilityCustomAction) -> Bool { activate("open") }
    @objc func readAction(_ action: UIAccessibilityCustomAction) -> Bool { activate("read") }
    @objc func detailsAction(_ action: UIAccessibilityCustomAction) -> Bool { activate("details") }
    @objc func deleteAction(_ action: UIAccessibilityCustomAction) -> Bool { activate("delete") }
}

private final class ReadingLibraryNativeScreen: UIViewController, UITableViewDataSource, UITableViewDelegate {
    var onAction: ((String, String) -> Void)?
    var onDismiss: (() -> Void)?
    private let items: [ReadingLibraryNativeItem]
    private let english: Bool
    private let table = UITableView(frame: .zero, style: .plain)

    init(items: [ReadingLibraryNativeItem], english: Bool) {
        self.items = items
        self.english = english
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("Storyboard unsupported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = english ? "My library" : "Mi biblioteca"
        view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: english ? "Close" : "Cerrar",
            style: .plain, target: self, action: #selector(close))
        table.translatesAutoresizingMaskIntoConstraints = false
        table.dataSource = self
        table.delegate = self
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 64
        view.addSubview(table)
        NSLayoutConstraint.activate([
            table.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            table.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            table.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            table.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])
    }

    @objc private func close() { onDismiss?() }
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { items.count }
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let item = items[indexPath.row]
        let cell = ReadingLibraryActionCell(style: .subtitle, reuseIdentifier: nil)
        cell.textLabel?.text = item.title
        let percentText = String(Int(item.percent.rounded(.down))) + " %"
        cell.detailTextLabel?.text = item.format.uppercased() + " · " + percentText
        cell.accessibilityLabel = item.title + ". " + item.format.uppercased() + ". " + percentText
        cell.accessibilityTraits.insert(.button)
        cell.accessibilityHint = english
            ? "Double-tap to open. Swipe up or down to choose an action."
            : "Pulsa dos veces para abrir. Desliza arriba o abajo para elegir una acción."
        cell.onAction = { [weak self] action in self?.onAction?(item.id, action) }
        let open = english ? "Open" : "Abrir"
        let read = english ? "Read aloud" : "Leer en voz alta"
        let details = english ? "Details and settings" : "Detalles y ajustes"
        let delete = english ? "Delete" : "Eliminar"
        cell.accessibilityCustomActions = [
            UIAccessibilityCustomAction(name: open, target: cell, selector: #selector(ReadingLibraryActionCell.openAction(_:))),
            UIAccessibilityCustomAction(name: read, target: cell, selector: #selector(ReadingLibraryActionCell.readAction(_:))),
            UIAccessibilityCustomAction(name: details, target: cell, selector: #selector(ReadingLibraryActionCell.detailsAction(_:))),
            UIAccessibilityCustomAction(name: delete, target: cell, selector: #selector(ReadingLibraryActionCell.deleteAction(_:)))
        ]
        return cell
    }
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        onAction?(items[indexPath.row].id, "open")
    }
}
