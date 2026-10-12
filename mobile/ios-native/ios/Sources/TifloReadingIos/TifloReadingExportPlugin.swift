import Foundation
import UIKit
import Capacitor

/// Shares a completed translation as a UTF-8 text file using the native iOS share sheet.
@objc(TifloReadingExportPlugin)
public final class TifloReadingExportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloReadingExportPlugin"
    public let jsName = "TifloReadingExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareTextFile", returnType: CAPPluginReturnPromise)
    ]

    @objc public func shareTextFile(_ call: CAPPluginCall) {
        guard let contents = call.getString("text"), !contents.isEmpty else {
            call.reject("A nonempty text is required")
            return
        }
        guard contents.utf8.count <= 15_000_000 else {
            call.reject("The text is too large to export")
            return
        }
        let proposed = call.getString("filename") ?? "traduccion.txt"
        let safe = proposed.replacingOccurrences(of: "[^a-zA-Z0-9._-]", with: "_", options: .regularExpression)
        let filename = safe.hasSuffix(".txt") ? safe : safe + ".txt"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + filename)
        do {
            try contents.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            call.reject("Failed to prepare the exported text file", nil, error)
            return
        }
        DispatchQueue.main.async {
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = self.bridge?.viewController?.view
                popover.sourceRect = self.bridge?.viewController?.view.bounds ?? .zero
            }
            guard let presenter = self.bridge?.viewController else {
                call.reject("The share sheet is unavailable")
                return
            }
            sheet.completionWithItemsHandler = { _, completed, _, _ in
                call.resolve(["shared": completed])
            }
            presenter.present(sheet, animated: true)
        }
    }
}
