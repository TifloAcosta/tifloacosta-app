import Foundation
import UIKit
import Capacitor

// iOS-only bridge for VoiceOver actions on the actual focused document title.
// Assigning actions to WKWebView itself does not attach them to its HTML buttons.
@objc(TifloReadingDocumentActionsPlugin)
public final class TifloReadingDocumentActionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloReadingDocumentActionsPlugin"
    public let jsName = "TifloReadingDocumentActions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setDocumentActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDocumentActions", returnType: CAPPluginReturnPromise)
    ]

    private var activeDocumentId = ""
    private weak var activeElement: NSObject?
    private var previousActions: [UIAccessibilityCustomAction]?

    private func reset() {
        if let element = activeElement {
            element.accessibilityCustomActions = previousActions
        }
        activeElement = nil
        previousActions = nil
        activeDocumentId = ""
    }

    @objc public func setDocumentActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let id = (call.getString("documentId") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let title = (call.getString("title") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !id.isEmpty, !title.isEmpty, UIAccessibility.isVoiceOverRunning else {
                call.resolve(["configured": false, "reason": "not-focused"])
                return
            }
            // WebKit exposes the focused HTML button as an accessibility object.
            // Only modify that object; never install all-book actions on the web view.
            guard let element = UIAccessibility.focusedElement(using: .notificationVoiceOver) as? NSObject,
                  let label = element.accessibilityLabel,
                  label.localizedCaseInsensitiveContains(title) else {
                call.resolve(["configured": false, "reason": "focus-mismatch"])
                return
            }
            if self.activeDocumentId != id || self.activeElement !== element {
                self.reset()
                self.activeElement = element
                self.previousActions = element.accessibilityCustomActions
                self.activeDocumentId = id
            }
            element.accessibilityCustomActions = [
                UIAccessibilityCustomAction(name: call.getString("openLabel") ?? "Abrir", target: self, selector: #selector(self.open(_:))),
                UIAccessibilityCustomAction(name: call.getString("detailsLabel") ?? "Acciones del documento", target: self, selector: #selector(self.details(_:))),
                UIAccessibilityCustomAction(name: call.getString("deleteLabel") ?? "Eliminar", target: self, selector: #selector(self.delete(_:)))
            ]
            call.resolve(["configured": true, "count": 3])
        }
    }

    @objc public func clearDocumentActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let id = call.getString("documentId") ?? ""
            guard id.isEmpty || id == self.activeDocumentId else {
                call.resolve(["cleared": false])
                return
            }
            self.reset()
            call.resolve(["cleared": true])
        }
    }

    private func perform(_ action: String) -> Bool {
        guard !activeDocumentId.isEmpty else { return false }
        notifyListeners("documentAction", data: ["documentId": activeDocumentId, "action": action])
        return true
    }
    @objc private func open(_ action: UIAccessibilityCustomAction) -> Bool { perform("open") }
    @objc private func details(_ action: UIAccessibilityCustomAction) -> Bool { perform("details") }
    @objc private func delete(_ action: UIAccessibilityCustomAction) -> Bool { perform("delete") }
}
