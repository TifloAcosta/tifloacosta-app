import Foundation
import UIKit
import Capacitor

@objc(SaveFilePlugin)
public class SaveFilePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "SaveFilePlugin"
    public let jsName = "SaveFile"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var temporaryURL: URL?

    @objc public func save(_ call: CAPPluginCall) {
        guard let base64Data = call.getString("base64Data"),
              let data = Data(base64Encoded: base64Data) else {
            call.reject("Missing or invalid file data")
            return
        }

        let requestedName = call.getString("fileName") ?? "TifloAcosta-download"
        let fileName = URL(fileURLWithPath: requestedName).lastPathComponent
        let tempDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let fileURL = tempDirectory.appendingPathComponent(fileName)

        do {
            try FileManager.default.createDirectory(at: tempDirectory, withIntermediateDirectories: true)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            call.reject("Unable to prepare file for saving", nil, error)
            return
        }

        pendingCall = call
        temporaryURL = fileURL
        call.keepAlive = true

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let picker = UIDocumentPickerViewController(forExporting: [fileURL], asCopy: true)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        finish(saved: !urls.isEmpty)
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        finish(saved: false)
    }

    private func finish(saved: Bool) {
        pendingCall?.resolve(["saved": saved])
        pendingCall?.keepAlive = false
        pendingCall = nil
        if let temporaryURL {
            try? FileManager.default.removeItem(at: temporaryURL.deletingLastPathComponent())
        }
        temporaryURL = nil
    }
}