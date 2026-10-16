import UIKit
import UniformTypeIdentifiers

// Share Extension writes only to its App Group sandbox. It never attempts to
// launch the containing app, access its WebView, or play shared content.
final class ShareViewController: UIViewController {
    private let group = "group.com.tifloacosta.app"
    private let maxBytes: Int64 = 50 * 1024 * 1024
    private let status = UILabel()
    private let saveButton = UIButton(type: .system)
    private let closeButton = UIButton(type: .system)
    private var saving = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let title = UILabel()
        title.text = "Compartir con TifloAcosta"
        title.font = UIFont.preferredFont(forTextStyle: .title2)
        title.adjustsFontForContentSizeCategory = true
        title.numberOfLines = 0
        title.accessibilityTraits.insert(.header)
        status.text = "Guarda el contenido para importarlo cuando abras TifloAcosta."
        status.font = UIFont.preferredFont(forTextStyle: .body)
        status.adjustsFontForContentSizeCategory = true
        status.numberOfLines = 0
        status.accessibilityLabel = status.text
        saveButton.setTitle("Guardar en TifloAcosta", for: .normal)
        saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)
        closeButton.setTitle("Cancelar", for: .normal)
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, status, saveButton, closeButton])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -22),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24)
        ])
    }

    @objc private func close() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func inbox() throws -> URL {
        guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
            throw NSError(domain: "TifloAcostaShare", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "El grupo compartido no está configurado"])
        }
        let folder = root.appendingPathComponent("TifloInbox", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private func saveMetadata(kind: String, name: String, value: String?, file: URL?) throws {
        let dir = try inbox()
        let id = UUID().uuidString
        var data: [String: String] = ["id": id, "kind": kind, "name": String(name.prefix(200))]
        if let value { data["text"] = String(value.prefix(100_000)) }
        if let file {
            let attrs = try FileManager.default.attributesOfItem(atPath: file.path)
            let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0
            guard size <= maxBytes else { throw NSError(domain: "TifloAcostaShare", code: 2) }
            let ext = file.pathExtension.lowercased()
            let allowed = ["txt", "html", "htm", "pdf", "docx", "pptx", "xlsx", "epub",
                           "odt", "rtf", "md", "fb2", "mp3", "zip", "png", "jpg", "jpeg", "webp"]
            guard allowed.contains(ext) else { throw NSError(domain: "TifloAcostaShare", code: 3) }
            let fileName = id + "." + ext
            try FileManager.default.copyItem(at: file, to: dir.appendingPathComponent(fileName))
            data["file"] = fileName
        }
        let json = try JSONSerialization.data(withJSONObject: data)
        try json.write(to: dir.appendingPathComponent(id + ".json"), options: .atomic)
    }

    private func normalizedFile(_ url: URL, provider: NSItemProvider, type: String) -> URL {
        let original = provider.suggestedName ?? url.deletingPathExtension().lastPathComponent
        let suffix = (original as NSString).pathExtension.lowercased()
        if !suffix.isEmpty { return URL(fileURLWithPath: url.path).deletingPathExtension().appendingPathExtension(suffix) }
        let ext = UTType(type)?.preferredFilenameExtension ?? url.pathExtension
        return url.deletingPathExtension().appendingPathExtension(ext)
    }

    @objc private func save() {
        guard !saving else { return }
        saving = true
        saveButton.isEnabled = false
        status.text = "Preparando el contenido compartido…"
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }.prefix(10)
        let group = DispatchGroup()
        let lock = NSLock()
        var accepted = 0
        let types = [
            "com.adobe.pdf", "org.idpf.epub-container",
            "org.openxmlformats.wordprocessingml.document",
            "org.openxmlformats.presentationml.presentation",
            "org.openxmlformats.spreadsheetml.sheet",
            "public.plain-text", "public.html", "public.rtf", "public.data"
        ]
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                    defer { group.leave() }
                    guard let value = (item as? URL)?.absoluteString ?? item as? String,
                          let self, value.count <= 4_096,
                          let url = URL(string: value), ["https", "http"].contains(url.scheme?.lowercased() ?? "") else { return }
                    if (try? self.saveMetadata(kind: "url", name: url.host ?? "Enlace", value: value, file: nil)) != nil {
                        lock.lock(); accepted += 1; lock.unlock()
                    }
                }
            } else if let type = types.first(where: { provider.hasItemConformingToTypeIdentifier($0) && $0 != "public.plain-text" }) {
                group.enter()
                provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, _ in
                    defer { group.leave() }
                    guard let url, let self else { return }
                    let normalized = self.normalizedFile(url, provider: provider, type: type)
                    // NSItemProvider's temporary file exists only inside this callback.
                    // Preserve its bytes under a stable, sanitized extension name.
                    let temp = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString)
                        .appendingPathExtension(normalized.pathExtension)
                    do {
                        try FileManager.default.copyItem(at: url, to: temp)
                        defer { try? FileManager.default.removeItem(at: temp) }
                        try self.saveMetadata(kind: "file", name: provider.suggestedName ?? "Documento",
                                              value: nil, file: temp)
                        lock.lock(); accepted += 1; lock.unlock()
                    } catch { }
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
                    defer { group.leave() }
                    guard let value = item as? String, !value.isEmpty, let self else { return }
                    if (try? self.saveMetadata(kind: "text", name: "Texto compartido", value: value, file: nil)) != nil {
                        lock.lock(); accepted += 1; lock.unlock()
                    }
                }
            }
        }
        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            self.saving = false
            self.status.text = accepted > 0
                ? "Guardado en TifloAcosta. Abre la aplicación para importar el contenido."
                : "No se pudo guardar el contenido. Comprueba el formato y el espacio disponible."
            self.saveButton.isHidden = accepted > 0
            self.saveButton.isEnabled = true
            self.closeButton.setTitle("Terminar", for: .normal)
            UIAccessibility.post(notification: .announcement, argument: self.status.text)
        }
    }
}
