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
        CAPPluginMethod(name: "registerAccessibleTargets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDocumentActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNativeActionList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVoiceOverStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showNativeContextMenu", returnType: CAPPluginReturnPromise)
    ]

    private var pendingPicker: CAPPluginCall?
    private var lastPickedCopy: URL?
    private var documentId = ""
    private var installedOnElement: UIAccessibilityElement?
    private var installedOnView: UIView?
    private var registeredLibraryTitles: [[String: Any]] = []
    private var registeredAccessibleTargets: [[String: Any]] = []
    private var focusedTargetId = ""
    private var nativePilotPresented = false
    private var autoNativeLibraryEnabled = false
    private var suppressAutoNativeTitleId = ""
    private var presentingAutoNativeTitleId = ""

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
            self.autoNativeLibraryEnabled = call.getBool("nativeRowsOnFocus") ?? false
            if !self.autoNativeLibraryEnabled {
                self.suppressAutoNativeTitleId = ""
                self.presentingAutoNativeTitleId = ""
            }
            self.updateFocusedLibraryTitle()
            call.resolve(["registered": self.registeredLibraryTitles.count,
                          "voiceOverEnabled": UIAccessibility.isVoiceOverRunning])
        }
    }


    // Cross-section actions for web elements, without changing the website or
    // creating secondary buttons. Only the ACTUAL VoiceOver-focused node is modified.
    @objc public func registerAccessibleTargets(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let incoming = call.getArray("targets") as? [[String: Any]] ?? []
            self.registeredAccessibleTargets = Array(incoming.prefix(250))
            self.updateFocusedLibraryTitle()
            call.resolve(["registered": self.registeredAccessibleTargets.count,
                          "voiceOverEnabled": UIAccessibility.isVoiceOverRunning])
        }
    }

    private func updateFocusedGenericTarget(_ focused: Any, label: String) {
        let matches = registeredAccessibleTargets.filter { target in
            guard let expected = target["label"] as? String, !expected.isEmpty else { return false }
            let value = expected.trimmingCharacters(in: .whitespacesAndNewlines)
            if label == value { return true }
            // VoiceOver may append a localized role; never use a substring match.
            return [", botón", ", button", ", encabezamiento", ", heading"].contains {
                label == value + $0
            }
        }
        // Duplicate labels are ambiguous; failing closed is safer than activating
        // the wrong episode, video or document.
        guard matches.count == 1, let target = matches.first,
              let targetId = target["id"] as? String, !targetId.isEmpty,
              let entries = target["actions"] as? [[String: Any]] else { return }
        focusedTargetId = targetId
        let actions: [UIAccessibilityCustomAction] = entries.compactMap { entry in
            guard let actionId = entry["id"] as? String, !actionId.isEmpty,
                  let actionLabel = entry["label"] as? String, !actionLabel.isEmpty else { return nil }
            return UIAccessibilityCustomAction(name: actionLabel, actionHandler: { [weak self] _ in
                guard let self = self, self.focusedTargetId == targetId else { return false }
                self.notifyListeners("targetAction", data: ["targetId": targetId, "action": actionId])
                return true
            })
        }
        if let element = focused as? UIAccessibilityElement {
            element.accessibilityCustomActions = actions
            installedOnElement = element
        } else if let view = focused as? UIView {
            view.accessibilityCustomActions = actions
            installedOnView = view
        }
    }

    @objc private func voiceOverFocusChanged(_ notification: Notification) {
        // The UIKit pilot owns its own focused cells and rotor actions.
        guard !nativePilotPresented else { return }
        let focused = notification.userInfo?[UIAccessibility.focusedElementUserInfoKey]
        updateFocusedLibraryTitle(focused)
    }

    private func updateFocusedLibraryTitle(_ focusedCandidate: Any? = nil) {
        guard !nativePilotPresented else { return }
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
            suppressAutoNativeTitleId = ""
            updateFocusedGenericTarget(focused, label: normalized)
            return
        }
        if autoNativeLibraryEnabled {
            // VoiceOver is focusing a DOM title; give it a real UIKit row with
            // native Actions instead of decorating an inaccessible WKWebView node.
            if suppressAutoNativeTitleId == id || presentingAutoNativeTitleId == id { return }
            guard !nativePilotPresented, bridge?.viewController?.presentedViewController == nil else { return }
            presentingAutoNativeTitleId = id
            let snapshot = registeredLibraryTitles
            let isEnglish = (title["label"] as? String ?? "").hasPrefix("Open ")
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                self.presentingAutoNativeTitleId = ""
                guard self.autoNativeLibraryEnabled, !self.nativePilotPresented,
                      self.suppressAutoNativeTitleId != id else { return }
                self.presentNativeActionList(
                    rawItems: snapshot,
                    title: isEnglish ? "Library" : "Biblioteca",
                    isEnglish: isEnglish,
                    preferredFocusId: id,
                    onFailure: nil,
                    onPresented: nil
                )
            }
            return
        }
        // No vaciar las acciones del título que continúa bajo el foco.
        if documentId == id {
            if let element = focused as? UIAccessibilityElement,
               let attached = installedOnElement, attached === element { return }
            if let view = focused as? UIView,
               let attached = installedOnView, attached === view { return }
        }
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

    /// The native list is opened automatically when VoiceOver reaches a library
    /// title, without requiring a separate "test" button. The HTML list remains
    /// the normal fallback when VoiceOver is off or presentation fails.
    private func presentNativeActionList(
        rawItems: [[String: Any]],
        title: String,
        isEnglish: Bool,
        preferredFocusId: String?,
        onFailure: ((String) -> Void)?,
        onPresented: ((Int) -> Void)?
    ) {
        guard let presenter = bridge?.viewController,
              !nativePilotPresented,
              presenter.presentedViewController == nil else {
            onFailure?("Another native screen is already open")
            return
        }
        guard !rawItems.isEmpty, rawItems.count <= 200 else {
            onFailure?("Provide between 1 and 200 list items")
            return
        }
        var seen = Set<String>()
        let allowed = Set([
            "open", "continue", "read", "translate", "queue", "info", "move",
            "export", "rename", "delete", "play", "youtube", "description",
            "download", "share", "favorite", "options", "copy", "original",
            "readmore", "mark", "remove", "pause", "listen"
        ])
        let entries: [TifloNativeListItem] = rawItems.compactMap { raw in
            guard let id = raw["id"] as? String, !id.isEmpty,
                  id.count <= 256, !seen.contains(id),
                  let label = (raw["plainLabel"] as? String ?? raw["label"] as? String),
                  !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  label.count <= 500 else { return nil }
            seen.insert(id)
            let actions = (raw["actions"] as? [[String: Any]] ?? []).prefix(12).compactMap { entry -> TifloNativeListAction? in
                guard let key = entry["id"] as? String, allowed.contains(key),
                      let title = entry["label"] as? String,
                      !title.isEmpty, title.count <= 100 else { return nil }
                return TifloNativeListAction(id: key, label: title)
            }
            guard !actions.isEmpty else { return nil }
            return TifloNativeListItem(id: id, title: label, actions: actions)
        }
        guard entries.count == rawItems.count else {
            onFailure?("Invalid list items or action identifiers")
            return
        }
        let controller = TifloNativeActionListController(
            title: title,
            entries: entries,
            closeLabel: isEnglish ? "Close" : "Cerrar",
            actionHint: isEnglish
                ? "VoiceOver Actions: swipe up or down to choose an action, then double tap."
                : "Acciones de VoiceOver: deslice arriba o abajo para elegir y toque dos veces.",
            initialItemId: preferredFocusId
        )
        controller.onSelected = { [weak self] itemId, actionId in
            self?.nativePilotPresented = false
            self?.suppressAutoNativeTitleId = itemId
            self?.notifyListeners("nativeListAction", data: ["itemId": itemId, "action": actionId])
        }
        controller.onClosed = { [weak self] in
            self?.nativePilotPresented = false
            self?.suppressAutoNativeTitleId = preferredFocusId ?? ""
            self?.notifyListeners("nativeListClosed", data: ["itemId": preferredFocusId ?? ""])
        }
        clearInstalledActions()
        documentId = ""
        focusedTargetId = ""
        nativePilotPresented = true
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .fullScreen
        presenter.present(navigation, animated: true) {
            onPresented?(entries.count)
        }
    }

    // Read-only state query; unlike registerAccessibleTargets this does not
    // replace another screen's current accessibility action registrations.
    @objc public func getVoiceOverStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["enabled": UIAccessibility.isVoiceOverRunning])
        }
    }

    // Long press on a web-backed title opens a system action sheet immediately.
    // The same item/action identifier is used by UIKit rotor custom actions.
    @objc public func showNativeContextMenu(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil,
                  let item = call.getObject("item"),
                  let itemId = item["id"] as? String, !itemId.isEmpty, itemId.count <= 256,
                  let label = item["label"] as? String, !label.isEmpty, label.count <= 500,
                  let definitions = item["actions"] as? [[String: Any]],
                  !definitions.isEmpty, definitions.count <= 12 else {
                call.reject("Invalid item or another native screen is open")
                return
            }
            let allowed = Set([
                "open", "continue", "read", "translate", "queue", "info", "move",
                "export", "rename", "delete", "play", "youtube", "description",
                "download", "share", "favorite", "options", "copy", "original",
                "readmore", "mark", "remove", "pause", "listen"
            ])
            let sheet = UIAlertController(title: label, message: nil, preferredStyle: .actionSheet)
            var seen = Set<String>()
            for definition in definitions {
                guard let actionId = definition["id"] as? String, allowed.contains(actionId),
                      seen.insert(actionId).inserted,
                      let title = definition["label"] as? String,
                      !title.isEmpty, title.count <= 100 else {
                    call.reject("Invalid or duplicated context action")
                    return
                }
                sheet.addAction(UIAlertAction(
                    title: title,
                    style: actionId == "delete" ? .destructive : .default
                ) { [weak self] _ in
                    self?.notifyListeners("nativeListAction", data: [
                        "itemId": itemId, "action": actionId
                    ])
                })
            }
            sheet.addAction(UIAlertAction(
                title: call.getString("language") == "en" ? "Cancel" : "Cancelar",
                style: .cancel
            ))
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX,
                                            y: presenter.view.bounds.midY, width: 1, height: 1)
            }
            presenter.present(sheet, animated: true) {
                call.resolve(["presented": true])
            }
        }
    }

    @objc public func showNativeActionList(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let raw = call.getArray("items") as? [[String: Any]] ?? []
            let isEnglish = call.getString("language") == "en"
            self.presentNativeActionList(
                rawItems: raw,
                title: call.getString("title") ?? (isEnglish ? "Library" : "Biblioteca"),
                isEnglish: isEnglish,
                preferredFocusId: call.getString("focusedItemId"),
                onFailure: { call.reject($0) },
                onPresented: { call.resolve(["presented": true, "count": $0]) }
            )
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
        focusedTargetId = ""
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
