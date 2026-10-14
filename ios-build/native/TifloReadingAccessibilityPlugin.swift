import Foundation
import UIKit
import UniformTypeIdentifiers
import Capacitor

/// Native Files picker and automatic VoiceOver actions for the focused library title.
/// Installed only in the packaged iOS application.
@objc(TifloReadingAccessibilityPlugin)
public final class TifloReadingAccessibilityPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "TifloReadingAccessibilityPlugin"
    public let jsName = "TifloReadingAccessibility"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickDocument", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setDocumentActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerLibraryTitles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDocumentActions", returnType: CAPPluginReturnPromise)
    ]

    private var pendingPicker: CAPPluginCall?
    private var lastPickedCopy: URL?
    private var documentId = ""
    private var installedOnElement: UIAccessibilityElement?
    private var installedOnView: UIView?
    private var registeredLibraryTitles: [[String: Any]] = []

    public override func load() {
        super.load()
        NotificationCenter.default.addObserver(
            self, selector: #selector(voiceOverFocusChanged(_:)),
            name: UIAccessibility.elementFocusedNotification, object: nil
        )
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    @objc public func registerLibraryTitles(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.registeredLibraryTitles = call.getArray("documents") as? [[String: Any]] ?? []
            self.updateFocusedLibraryTitle()
            call.resolve(["registered": self.registeredLibraryTitles.count,
                          "voiceOverEnabled": UIAccessibility.isVoiceOverRunning])
        }
    }

    @objc private func voiceOverFocusChanged(_ notification: Notification) {
        let focused = notification.userInfo?[UIAccessibility.focusedElementUserInfoKey]
        updateFocusedLibraryTitle(focused)
    }

    private func updateFocusedLibraryTitle(_ focusedCandidate: Any? = nil) {
        guard UIAccessibility.isVoiceOverRunning else {
            documentId = ""
            clearInstalledActions()
            return
        }
        let focused = focusedCandidate ?? UIAccessibility.focusedElement(using: .notificationVoiceOver)
        let label: String
        if let element = focused as? UIAccessibilityElement {
            label = element.accessibilityLabel ?? ""
        } else if let view = focused as? UIView {
            label = view.accessibilityLabel ?? ""
        } else {
            documentId = ""
            clearInstalledActions()
            return
        }
        // No confundir dos libros con el mismo título ni asociar acciones a
        // elementos ajenos a la biblioteca.
        let normalized = label.trimmingCharacters(in: .whitespacesAndNewlines)
        // WKWebView puede incluir el tipo de control después del nombre.
        // Coincidencia exclusiva con el título, nunca con una coincidencia parcial.
        let matches = registeredLibraryTitles.filter { document in
            let expected = (document["label"] as? String ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let plain = (document["plainLabel"] as? String ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !expected.isEmpty else { return false }
            if normalized == expected { return true }
            // Una etiqueta accesible puede añadir ", botón" o ", button".
            for suffix in [", botón", ", button", ". botón", ". button"] {
                if normalized == expected + suffix { return true }
            }
            // El título sin prefijo también es válido SOLO si VoiceOver
            // ha enfocado realmente un botón con ese nombre inequívoco.
            let buttonFocused: Bool
            if let element = focused as? UIAccessibilityElement {
                buttonFocused = element.accessibilityTraits.contains(.button)
            } else if let view = focused as? UIView {
                buttonFocused = view.accessibilityTraits.contains(.button)
            } else {
                buttonFocused = false
            }
            return buttonFocused && !plain.isEmpty && normalized == plain
        }
        guard matches.count == 1, let title = matches.first,
              let id = title["id"] as? String, !id.isEmpty,
              let entries = title["actions"] as? [[String: Any]] else {
            documentId = ""
            clearInstalledActions()
            return
        }
        // No vaciar las acciones del título que continúa bajo el foco.
        if documentId == id, (installedOnElement != nil || installedOnView != nil) { return }
        clearInstalledActions()
        documentId = id
        let selectors: [String: Selector] = [
            "open": #selector(openDocument(_:)), "continue": #selector(continueDocument(_:)),
            "queue": #selector(queueDocument(_:)), "info": #selector(infoDocument(_:)),
            "move": #selector(moveDocument(_:)), "export": #selector(exportDocument(_:)),
            "rename": #selector(renameDocument(_:)), "delete": #selector(deleteDocument(_:))
        ]
        let actions = entries.compactMap { entry -> UIAccessibilityCustomAction? in
            guard let key = entry["id"] as? String,
                  let name = entry["label"] as? String, !name.isEmpty,
                  let selector = selectors[key] else { return nil }
            return UIAccessibilityCustomAction(name: name, target: self, selector: selector)
        }
        if let element = focused as? UIAccessibilityElement {
            element.accessibilityCustomActions = actions
            installedOnElement = element
        } else if let view = focused as? UIView {
            view.accessibilityCustomActions = actions
            installedOnView = view
        }
    }

    @objc public func pickDocument(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingPicker == nil else {
                call.reject("A document picker is already open")
                return
            }
            guard let controller = self.bridge?.viewController else {
                call.reject("Cannot present Files")
                return
            }
            self.pendingPicker = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.item], asCopy: true)
            picker.allowsMultipleSelection = false
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        let call = pendingPicker
        pendingPicker = nil
        call?.resolve(["cancelled": true])
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        let call = pendingPicker
        pendingPicker = nil
        guard let url = urls.first else {
            call?.resolve(["cancelled": true])
            return
        }
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        do {
            let folder = FileManager.default.temporaryDirectory
                .appendingPathComponent("tifloacosta-imports", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let copy = folder.appendingPathComponent(UUID().uuidString + "-" + url.lastPathComponent)
            try FileManager.default.copyItem(at: url, to: copy)
            // The web reader must finish reading the previous copy before it is removed.
            if let old = lastPickedCopy { try? FileManager.default.removeItem(at: old) }
            lastPickedCopy = copy
            call?.resolve(["cancelled": false, "name": url.lastPathComponent, "uri": copy.absoluteString])
        } catch {
            call?.reject("Unable to read the chosen file")
        }
    }

    @objc public func setDocumentActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let id = (call.getString("documentId") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !id.isEmpty else { call.reject("Missing document ID"); return }
            self.clearInstalledActions()
            self.documentId = id
            let entries = call.getArray("actions") as? [[String: Any]] ?? []
            let selectors: [String: Selector] = [
                "open": #selector(self.openDocument(_:)),
                "continue": #selector(self.continueDocument(_:)),
                "queue": #selector(self.queueDocument(_:)),
                "info": #selector(self.infoDocument(_:)),
                "move": #selector(self.moveDocument(_:)),
                "export": #selector(self.exportDocument(_:)),
                "rename": #selector(self.renameDocument(_:)),
                "delete": #selector(self.deleteDocument(_:))
            ]
            var actions: [UIAccessibilityCustomAction] = []
            var used = Set<String>()
            for entry in entries {
                guard let key = entry["id"] as? String,
                      let name = entry["label"] as? String,
                      !name.isEmpty, let selector = selectors[key],
                      used.insert(key).inserted else { continue }
                actions.append(UIAccessibilityCustomAction(name: name, target: self, selector: selector))
            }
            // VoiceOver acts on the focused accessibility node, not on the WKWebView
            // container. Installing the actions only on webView hides them from the rotor.
            let focused = UIAccessibility.focusedElement(using: .notificationVoiceOver)
            var attachedToFocusedTitle = false
            if let element = focused as? UIAccessibilityElement {
                attachedToFocusedTitle = true
                element.accessibilityCustomActions = actions
                self.installedOnElement = element
            } else if let view = focused as? UIView {
                attachedToFocusedTitle = true
                view.accessibilityCustomActions = actions
                self.installedOnView = view
            } else {
                self.webView?.accessibilityCustomActions = actions
            }
            call.resolve([
                "configured": !actions.isEmpty && attachedToFocusedTitle,
                "count": actions.count,
                "voiceOverEnabled": UIAccessibility.isVoiceOverRunning
            ])
        }
    }

    private func clearInstalledActions() {
        installedOnElement?.accessibilityCustomActions = nil
        installedOnView?.accessibilityCustomActions = nil
        installedOnElement = nil
        installedOnView = nil
        webView?.accessibilityCustomActions = nil
    }

    @objc public func clearDocumentActions(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let expected = call.getString("documentId") ?? ""
            guard expected.isEmpty || expected == self.documentId else {
                call.resolve(["cleared": false])
                return
            }
            self.documentId = ""
            self.clearInstalledActions()
            call.resolve(["cleared": true])
        }
    }

    private func emit(_ action: String) -> Bool {
        guard !documentId.isEmpty else { return false }
        notifyListeners("documentAction", data: ["documentId": documentId, "action": action])
        return true
    }

    @objc private func openDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("open") }
    @objc private func continueDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("continue") }
    @objc private func queueDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("queue") }
    @objc private func infoDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("info") }
    @objc private func moveDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("move") }
    @objc private func exportDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("export") }
    @objc private func renameDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("rename") }
    @objc private func deleteDocument(_ action: UIAccessibilityCustomAction) -> Bool { emit("delete") }
}
