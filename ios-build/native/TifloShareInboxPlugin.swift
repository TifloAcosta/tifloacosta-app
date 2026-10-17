import Foundation
import UIKit
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
        CAPPluginMethod(name: "readItemChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolveYouTubeTitle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openURL", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareData", returnType: CAPPluginReturnPromise)
    ]

    // File-based native Share Sheet for originals stored only in the Web reader.
    // Limited to 15 MB because the Capacitor bridge passes base64 in memory.
    @objc public func shareData(_ call: CAPPluginCall) {
        guard let raw = call.getString("base64"),
              raw.count <= 21_000_000,
              let data = Data(base64Encoded: raw), data.count <= 15 * 1024 * 1024,
              !data.isEmpty else {
            call.reject("Archivo demasiado grande o no válido para Compartir")
            return
        }
        let untrusted = call.getString("name") ?? "documento.txt"
        let name = URL(fileURLWithPath: untrusted).lastPathComponent
        guard !name.isEmpty, name != ".", name != ".." else {
            call.reject("Nombre de archivo no válido")
            return
        }
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("tiflo-share-" + UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let target = folder.appendingPathComponent(name)
            try data.write(to: target, options: [.atomic])
            DispatchQueue.main.async {
                guard let controller = self.bridge?.viewController,
                      controller.presentedViewController == nil else {
                    try? FileManager.default.removeItem(at: folder)
                    call.reject("Ya hay una ventana abierta")
                    return
                }
                let sheet = UIActivityViewController(activityItems: [target], applicationActivities: nil)
                if let popover = sheet.popoverPresentationController {
                    popover.sourceView = controller.view
                    popover.sourceRect = CGRect(x: controller.view.bounds.midX,
                        y: controller.view.bounds.midY, width: 1, height: 1)
                }
                sheet.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: folder)
                    if error != nil { call.reject("No se pudo compartir el documento") }
                    else { call.resolve(["completed": completed]) }
                }
                controller.present(sheet, animated: true)
            }
        } catch {
            try? FileManager.default.removeItem(at: folder)
            call.reject("No se pudo preparar el archivo para compartir")
        }
    }

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
                    "contentType": info["contentType"] ?? "",
                    "createdAt": info["createdAt"] ?? "",
                    // Small preview only; files stay as private App Group bytes.
                    "preview": String((info["value"] ?? "").prefix(2000))
                ]
            }.sorted { ($0["createdAt"] ?? "") > ($1["createdAt"] ?? "") }
            call.resolve(["items": Array(items.prefix(100))])
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
            guard !filename.isEmpty, filename != ".", filename != ".." else {
                call.reject("Nombre recibido no válido")
                return
            }
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

    // When WKWebView cannot fetch a local file:// URL, stream its original
    // App Group bytes over the Capacitor bridge in bounded chunks. This also
    // works for older pending receipts, without editing their manifests.
    @objc public func readItemChunk(_ call: CAPPluginCall) {
        guard let id = validated(call.getString("id") ?? ""),
              let folder = inbox(),
              let record = manifest(id, in: folder),
              record["kind"] == "file",
              record["storedName"] == id + ".data" else {
            call.reject("Archivo recibido no encontrado")
            return
        }
        let offset = call.getInt("offset") ?? 0
        let requested = call.getInt("length") ?? 524288
        guard offset >= 0, offset <= 100 * 1024 * 1024,
              requested > 0, requested <= 524288 else {
            call.reject("Rango de lectura no válido")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let url = folder.appendingPathComponent(id + ".data")
            do {
                let handle = try FileHandle(forReadingFrom: url)
                defer { try? handle.close() }
                let size = Int(try handle.seekToEnd())
                guard size > 0, size <= 100 * 1024 * 1024, offset <= size else {
                    call.reject("Archivo vacío o demasiado grande")
                    return
                }
                try handle.seek(toOffset: UInt64(offset))
                let data = try handle.read(upToCount: requested) ?? Data()
                let next = offset + data.count
                call.resolve([
                    "data": data.base64EncodedString(),
                    "nextOffset": next,
                    "size": size,
                    "done": next == size,
                    "name": record["name"] ?? "Contenido",
                    "contentType": record["contentType"] ?? ""
                ])
            } catch {
                call.reject("No se pudieron recuperar los bytes del archivo recibido")
            }
        }
    }

    // YouTube oEmbed exposes the video's public title without OAuth.
    // A failure must never prevent playback or invent a misleading title.
    @objc public func resolveYouTubeTitle(_ call: CAPPluginCall) {
        guard let id = call.getString("videoId"),
              id.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil else {
            call.reject("Identificador de vídeo inválido")
            return
        }
        let watch = "https://www.youtube.com/watch?v=" + id
        var parts = URLComponents(string: "https://www.youtube.com/oembed")
        parts?.queryItems = [URLQueryItem(name: "url", value: watch),
                             URLQueryItem(name: "format", value: "json")]
        guard let url = parts?.url else {
            call.resolve(["title": ""])
            return
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        URLSession.shared.dataTask(with: request) { data, response, _ in
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let data = data, data.count <= 131072,
                  let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let title = object["title"] as? String else {
                call.resolve(["title": ""])
                return
            }
            let clean = title.trimmingCharacters(in: .whitespacesAndNewlines)
            call.resolve(["title": String(clean.prefix(240))])
        }.resume()
    }

    // Open real HTTPS URLs without reclassifying them as text documents.
    @objc public func openURL(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"),
              let url = URL(string: raw),
              ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
              url.user == nil, url.password == nil, url.host != nil else {
            call.reject("Enlace recibido no válido")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { succeeded in
                if succeeded { call.resolve(["opened": true]) }
                else { call.reject("No se pudo abrir el enlace") }
            }
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
