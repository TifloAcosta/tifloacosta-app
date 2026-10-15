import Foundation
import UIKit
import Capacitor

/// Exposes document-specific UIKit accessibility actions on the reader's web view.
/// The HTML title remains usable without this bridge (e.g. on Android and web).
@objc(TifloReadingAccessibilityPlugin)
public final class TifloReadingAccessibilityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloReadingAccessibilityPlugin"
    public let jsName = "TifloReadingAccessibility"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setDocumentActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDocumentActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNativeActionList", returnType: CAPPluginReturnPromise)
    ]

    private var documentId = ""
    private var actionIds: [String: String] = [:]

    @objc public func setDocumentActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let id = (call.getString("documentId") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !id.isEmpty else {
                call.reject("A document ID is required")
                return
            }
            self.documentId = id
            self.actionIds.removeAll()
            let entries = call.getArray("actions") as? [[String: Any]] ?? []
            let allowed = Set(["open", "play", "details", "rename", "delete"])
            var nativeActions: [UIAccessibilityCustomAction] = []
            for entry in entries {
                guard let key = entry["id"] as? String, allowed.contains(key),
                      let name = entry["label"] as? String, !name.isEmpty,
                      !self.actionIds.values.contains(key) else { continue }
                let selector: Selector
                switch key {
                case "open": selector = #selector(self.performOpen(_:))
                case "play": selector = #selector(self.performPlay(_:))
                case "details": selector = #selector(self.performDetails(_:))
                case "rename": selector = #selector(self.performRename(_:))
                default: selector = #selector(self.performDelete(_:))
                }
                nativeActions.append(UIAccessibilityCustomAction(name: name, target: self, selector: selector))
                self.actionIds[key] = key
            }
            self.webView?.accessibilityCustomActions = nativeActions
            call.resolve(["configured": !nativeActions.isEmpty, "count": nativeActions.count])
        }
    }

    @objc public func clearDocumentActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Avoid clearing a newer focused book when an older blur arrives late.
            let expectedId = call.getString("documentId") ?? ""
            if !expectedId.isEmpty && self.documentId != expectedId {
                call.resolve(["cleared": false])
                return
            }
            self.documentId = ""
            self.actionIds.removeAll()
            self.webView?.accessibilityCustomActions = nil
            call.resolve(["cleared": true])
        }
    }

    /// An opt-in UIKit pilot, independent from the existing HTML library.
    /// Each row is a real accessibility element; no actions are attached to WKWebView.
    @objc public func showNativeActionList(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("Another native screen is already open")
                return
            }
            guard let rawItems = call.getArray("items") as? [[String: Any]],
                  !rawItems.isEmpty, rawItems.count <= 30 else {
                call.reject("Provide between 1 and 30 list items")
                return
            }
            var seen = Set<String>()
            let allowed = Set(["open", "details", "rename", "delete", "play", "share", "download"])
            let entries: [TifloNativeListItem] = rawItems.compactMap { raw in
                guard let id = raw["id"] as? String, !id.isEmpty,
                      id.count <= 256, !seen.contains(id),
                      let label = raw["label"] as? String,
                      !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                      label.count <= 500 else { return nil }
                seen.insert(id)
                let actions = (raw["actions"] as? [[String: Any]] ?? []).prefix(8).compactMap { entry -> TifloNativeListAction? in
                    guard let key = entry["id"] as? String, allowed.contains(key),
                          let title = entry["label"] as? String,
                          !title.isEmpty, title.count <= 100 else { return nil }
                    return TifloNativeListAction(id: key, label: title)
                }
                guard !actions.isEmpty else { return nil }
                return TifloNativeListItem(id: id, title: label, actions: actions)
            }
            guard entries.count == rawItems.count else {
                call.reject("Invalid list items or action identifiers")
                return
            }
            let isEnglish = call.getString("language") == "en"
            let title = call.getString("title") ?? (isEnglish ? "Native library test" : "Prueba de biblioteca nativa")
            let controller = TifloNativeActionListController(
                title: title,
                entries: entries,
                closeLabel: isEnglish ? "Close" : "Cerrar",
                actionHint: isEnglish
                    ? "Choose Actions in the VoiceOver rotor, then swipe up or down."
                    : "Seleccione Acciones en el rotor de VoiceOver y deslice arriba o abajo."
            )
            controller.onSelected = { [weak self] itemId, actionId in
                self?.notifyListeners("nativeListAction", data: ["itemId": itemId, "action": actionId])
            }
            controller.onClosed = { [weak self] in
                self?.notifyListeners("nativeListClosed", data: [:])
            }
            let navigation = UINavigationController(rootViewController: controller)
            navigation.modalPresentationStyle = .fullScreen
            presenter.present(navigation, animated: true) {
                call.resolve(["presented": true, "count": entries.count])
            }
        }
    }

    private func emit(_ action: String) -> Bool {
        guard !documentId.isEmpty, actionIds[action] != nil else { return false }
        notifyListeners("documentAction", data: ["documentId": documentId, "action": action])
        return true
    }

    @objc private func performOpen(_ action: UIAccessibilityCustomAction) -> Bool { emit("open") }
    @objc private func performPlay(_ action: UIAccessibilityCustomAction) -> Bool { emit("play") }
    @objc private func performDetails(_ action: UIAccessibilityCustomAction) -> Bool { emit("details") }
    @objc private func performRename(_ action: UIAccessibilityCustomAction) -> Bool { emit("rename") }
    @objc private func performDelete(_ action: UIAccessibilityCustomAction) -> Bool { emit("delete") }
}
