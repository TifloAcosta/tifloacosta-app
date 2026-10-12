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
        CAPPluginMethod(name: "clearDocumentActions", returnType: CAPPluginReturnPromise)
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
            self.documentId = ""
            self.actionIds.removeAll()
            self.webView?.accessibilityCustomActions = nil
            call.resolve(["cleared": true])
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
