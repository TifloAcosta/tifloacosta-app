import Foundation
import Capacitor

// Host-side, read-only preview of the App Group inbox. The shared item is
// deleted ONLY after TifloLector confirms that it imported the document.
@objc(TifloShareInboxPlugin)
public final class TifloShareInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloShareInboxPlugin"
    public let jsName = "TifloShareInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise)
    ]
    private let group = "group.com.tifloacosta.app"

    private func inbox() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appendingPathComponent("ShareInbox", isDirectory: true)
    }

    private func validated(_ id: String) -> String? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return uuid.uuidString
    }

    private func manifest(_ id: String, in folder: URL) -> [String: String]? {
        let source = folder.appendingPathComponent(id + ".json")
        guard let data = try? Data(contentsOf: source),
              let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: String],
              value["id"] == id,
              ["url", "text", "file"].contains(value["kind"] ?? "") else { return nil }
        return value
    }

    @objc public func pending(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let folder = self.inbox() else {
                call.reject("App Group no configurado")
                return
            }
            let list = (try? FileManager.default.contentsOfDirectory(at: folder,
                includingPropertiesForKeys: nil)) ?? []
            let items: [[String: String]] = list.compactMap { url in
                guard url.pathExtension == "json",
                      let id = self.validated(url.deletingPathExtension().lastPathComponent),
                      let info = self.manifest(id, in: folder) else { return nil }
                return [
                    "id": id,
                    "kind": info["kind"] ?? "file",
                    "name": info["name"] ?? "Contenido",
                    "createdAt": info["createdAt"] ?? ""
                ]
            }.sorted { ($0["createdAt"] ?? "") < ($1["createdAt"] ?? "") }
            call.resolve(["items": Array(items.prefix(30))])
        }
    }

    @objc public func openItem(_ call: CAPPluginCall) {
        guard let id = validated(call.getString("id") ?? ""),
              let folder = inbox(), let value = manifest(id, in: folder) else {
            call.reject("No se encuentra el contenido")
            return
        }
        if value["kind"] != "file" {
            call.resolve([
                "id": id, "kind": value["kind"] ?? "text",
                "name": value["name"] ?? "Contenido",
                "value": value["value"] ?? ""
            ])
            return
        }
        guard value["storedName"] == id + ".data" else {
            call.reject("Archivo de entrada no válido")
            return
        }
        let source = folder.appendingPathComponent(id + ".data")
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent("tifloacosta-inbox-" + id, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
            let filename = URL(fileURLWithPath: value["name"] ?? "documento.bin").lastPathComponent
            let copy = destination.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: copy.path) {
                try FileManager.default.removeItem(at: copy)
            }
            try FileManager.default.copyItem(at: source, to: copy)
            call.resolve([
                "id": id, "kind": "file", "name": filename, "uri": copy.absoluteString
            ])
        } catch {
            call.reject("No se puede preparar el archivo")
        }
    }

    @objc public func acknowledge(_ call: CAPPluginCall) {
        guard let id = validated(call.getString("id") ?? ""),
              let folder = inbox(), manifest(id, in: folder) != nil else {
            call.reject("Entrada no encontrada")
            return
        }
        do {
            // Remove only validated items belonging to this entry.
            let record = folder.appendingPathComponent(id + ".json")
            try FileManager.default.removeItem(at: record)
            try? FileManager.default.removeItem(at: folder.appendingPathComponent(id + ".data"))
            let temporary = FileManager.default.temporaryDirectory
                .appendingPathComponent("tifloacosta-inbox-" + id, isDirectory: true)
            try? FileManager.default.removeItem(at: temporary)
            call.resolve(["acknowledged": true])
        } catch {
            call.reject("No se pudo cerrar la entrada")
        }
    }
}
