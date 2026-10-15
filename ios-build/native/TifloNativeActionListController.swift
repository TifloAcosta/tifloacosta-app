import Foundation
import UIKit

// Experimental native list. Unlike a WKWebView-wide action, each action belongs
// to the actual UITableViewCell that VoiceOver focuses.
struct TifloNativeListAction {
    let id: String
    let label: String
}

struct TifloNativeListItem {
    let id: String
    let title: String
    let actions: [TifloNativeListAction]
}

private final class TifloNativeRowActionHandler: NSObject {
    private let invoke: () -> Void
    private(set) var accessibilityAction: UIAccessibilityCustomAction!

    init(label: String, invoke: @escaping () -> Void) {
        self.invoke = invoke
        super.init()
        // The custom action targets the retained handler of this exact row.
        self.accessibilityAction = UIAccessibilityCustomAction(
            name: label,
            target: self,
            selector: #selector(run(_:))
        )
    }

    @objc private func run(_ action: UIAccessibilityCustomAction) -> Bool {
        invoke()
        return true
    }
}

final class TifloNativeActionListController: UITableViewController {
    private let screenTitle: String
    private let entries: [TifloNativeListItem]
    private let closeLabel: String
    private let actionHint: String
    private let initialItemId: String?
    private var rowActionHandlers: [[TifloNativeRowActionHandler]] = []
    private var isClosing = false

    var onSelected: ((String, String) -> Void)?
    var onClosed: (() -> Void)?

    init(title: String, entries: [TifloNativeListItem], closeLabel: String, actionHint: String, initialItemId: String? = nil) {
        self.screenTitle = title
        self.entries = entries
        self.closeLabel = closeLabel
        self.actionHint = actionHint
        self.initialItemId = initialItemId
        super.init(style: .plain)
        rowActionHandlers = entries.map { entry in
            entry.actions.map { action in
                TifloNativeRowActionHandler(label: action.label) { [weak self] in
                    self?.select(itemId: entry.id, actionId: action.id)
                }
            }
        }
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = screenTitle
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: closeLabel,
            style: .done,
            target: self,
            action: #selector(close)
        )
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "TifloNativeActionRow")
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 56
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if UIAccessibility.isVoiceOverRunning {
            let position = entries.firstIndex(where: { $0.id == initialItemId }) ?? 0
            if !entries.isEmpty {
                let indexPath = IndexPath(row: position, section: 0)
                tableView.scrollToRow(at: indexPath, at: .middle, animated: false)
                tableView.layoutIfNeeded()
                let focused = tableView.cellForRow(at: indexPath)
                UIAccessibility.post(notification: .screenChanged, argument: focused ?? tableView)
            } else {
                UIAccessibility.post(notification: .screenChanged, argument: tableView)
            }
        }
    }

    override func numberOfSections(in tableView: UITableView) -> Int { 1 }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        entries.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "TifloNativeActionRow", for: indexPath)
        let entry = entries[indexPath.row]
        cell.textLabel?.text = entry.title
        cell.textLabel?.numberOfLines = 0
        cell.isAccessibilityElement = true
        cell.accessibilityLabel = entry.title
        cell.accessibilityTraits = [.button]
        cell.accessibilityHint = actionHint
        cell.accessibilityCustomActions = rowActionHandlers[indexPath.row].map { $0.accessibilityAction }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let entry = entries[indexPath.row]
        guard let action = entry.actions.first(where: { $0.id == "open" }) else {
            tableView.deselectRow(at: indexPath, animated: true)
            return
        }
        select(itemId: entry.id, actionId: action.id)
    }

    private func select(itemId: String, actionId: String) {
        guard !isClosing else { return }
        isClosing = true
        let callback = onSelected
        dismiss(animated: true) {
            callback?(itemId, actionId)
        }
    }

    @objc private func close() {
        guard !isClosing else { return }
        isClosing = true
        let callback = onClosed
        dismiss(animated: true) {
            callback?()
        }
    }
}
