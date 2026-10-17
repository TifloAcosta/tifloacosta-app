import UIKit
import UniformTypeIdentifiers

// A separate Share Extension process: no Capacitor or WebKit dependency.
// Accept exactly one input and store it privately until the host imports it.
final class ShareViewController: UIViewController {
    private let groupId = "group.com.tifloacosta.app"
    private let maxBytes: Int64 = 100 * 1024 * 1024
    private let statusLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private var saving = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let heading = UILabel()
        heading.text = "Enviar a TifloAcosta"
        heading.font = .preferredFont(forTextStyle: .title2)
        heading.adjustsFontForContentSizeCategory = true
        heading.textAlignment = .center
        statusLabel.text = "Preparando contenido…"
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.accessibilityTraits = [.staticText]
        closeButton.setTitle("Cerrar", for: .normal)
        closeButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
        closeButton.isEnabled = false
        let stack = UIStackView(arrangedSubviews: [heading, statusLabel, closeButton])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !saving else { return }
        saving = true
        receiveFirstAttachment()
    }

    private func finish(_ text: String) {
        DispatchQueue.main.async {
            self.statusLabel.text = text
            self.closeButton.isEnabled = true
            UIAccessibility.post(notification: .screenChanged, argument: self.statusLabel)
        }
    }

    @objc private func close() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    // A provider may publish BOTH a local file and a URL. A file:// URL
    // is never a broken HTTPS link: it is an attachment to copy into App Group.
    private func receiveFirstAttachment() {
        guard let context = extensionContext,
              let incoming = context.inputItems as? [NSExtensionItem] else {
            finish("No se ha recibido contenido compatible.")
            return
        }
        let supported: Set<String> = [
            "pdf", "txt", "html", "htm", "md", "docx", "pptx", "xlsx",
            "epub", "odt", "rtf", "fb2", "mp3", "m4a", "aac", "wav",
            "aiff", "flac", "zip", "png", "jpg", "jpeg", "webp"
        ]
        let providers = incoming.flatMap { $0.attachments ?? [] }
        let imageExtensions: Set<String> = ["png", "jpg", "jpeg", "webp"]
        // WhatsApp may put an image preview before the original EPUB.
        // A named document/audio always beats an image; a standalone image
        // remains available for the reader's existing OCR.
        let provider = providers.first(where: { candidate in
            let suffix = URL(fileURLWithPath: candidate.suggestedName ?? "")
                .pathExtension.lowercased()
            return supported.contains(suffix) && !imageExtensions.contains(suffix)
        }) ?? providers.first(where: { candidate in
            candidate.registeredTypeIdentifiers.contains(where: { identifier in
                guard let type = UTType(identifier) else { return false }
                let suffix = type.preferredFilenameExtension?.lowercased() ?? ""
                return !type.conforms(to: .url) && !type.conforms(to: .plainText)
                    && !type.conforms(to: .image)
                    && (type.conforms(to: .audio) || type.conforms(to: .data)
                        || type.conforms(to: .content)
                        || (supported.contains(suffix) && !imageExtensions.contains(suffix)))
            })
        }) ?? providers.first(where: { candidate in
            let suffix = URL(fileURLWithPath: candidate.suggestedName ?? "")
                .pathExtension.lowercased()
            return imageExtensions.contains(suffix)
        }) ?? providers.first
        guard let provider = provider else {
            finish("No se ha recibido contenido compatible.")
            return
        }

        let suggested = provider.suggestedName ?? ""
        let namedExtension = URL(fileURLWithPath: suggested).pathExtension.lowercased()
        let namedFile = supported.contains(namedExtension)
        let identifiers = provider.registeredTypeIdentifiers
        let fileIdentifier = identifiers.first { identifier in
            guard let type = UTType(identifier) else { return false }
            if type.conforms(to: .url) || type.conforms(to: .fileURL) { return false }
            if type.conforms(to: .plainText) && !namedFile { return false }
            if type.conforms(to: .html) && !namedFile &&
                provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) { return false }
            return type.conforms(to: .audio) || type.conforms(to: .data) ||
                type.conforms(to: .content) ||
                supported.contains(type.preferredFilenameExtension?.lowercased() ?? "")
        }

        // Prefer file bytes, including unnamed data provided by Files/WhatsApp.
        // Never coerce binary data to a URL or text.
        if let identifier = fileIdentifier {
            provider.loadFileRepresentation(forTypeIdentifier: identifier) { [weak self] source, error in
                guard let self = self else { return }
                guard let source = source else {
                    // Some third-party apps provide raw bytes but no temporary
                    // file representation. Accept that data without converting
                    // it into a misleading web link or discarding the original.
                    provider.loadDataRepresentation(forTypeIdentifier: identifier) { [weak self] data, _ in
                        guard let self = self, let data = data, !data.isEmpty,
                              Int64(data.count) <= self.maxBytes else {
                            self?.finish("No se pudo recibir el archivo. Inténtalo de nuevo desde la aplicación de origen.")
                            return
                        }
                        let suffix = UTType(identifier)?.preferredFilenameExtension?.lowercased() ?? ""
                        var fallbackName = suggested.isEmpty ? "Contenido" : suggested
                        let fallbackSuffix = URL(fileURLWithPath: fallbackName).pathExtension.lowercased()
                        if !supported.contains(fallbackSuffix) && supported.contains(suffix) {
                            if !fallbackSuffix.isEmpty {
                                fallbackName = String(fallbackName.dropLast(fallbackSuffix.count + 1))
                            }
                            fallbackName += "." + suffix
                        }
                        let temporary = FileManager.default.temporaryDirectory
                            .appendingPathComponent(UUID().uuidString + "-" + fallbackName)
                        do {
                            try data.write(to: temporary, options: [.atomic])
                            self.store(kind: "file", title: fallbackName, value: nil,
                                       file: temporary, typeIdentifier: identifier)
                        } catch {
                            self.finish("No se pudo conservar el archivo recibido.")
                        }
                        try? FileManager.default.removeItem(at: temporary)
                    }
                    return
                }
                let typeSuffix = UTType(identifier)?.preferredFilenameExtension?.lowercased() ?? ""
                let sourceName = source.lastPathComponent
                var name = suggested.isEmpty ? sourceName : suggested
                let nameSuffix = URL(fileURLWithPath: name).pathExtension.lowercased()
                // NSItemProvider may expose an arbitrary ".tmp" filename.
                // The real format declared by UniformTypeIdentifiers wins
                // whenever the suggested name has no usable extension.
                if !supported.contains(nameSuffix) && supported.contains(typeSuffix) {
                    if !nameSuffix.isEmpty {
                        name = String(name.dropLast(nameSuffix.count + 1))
                    }
                    name += "." + typeSuffix
                } else if nameSuffix.isEmpty && supported.contains(source.pathExtension.lowercased()) {
                    name += "." + source.pathExtension.lowercased()
                }
                self.store(kind: "file", title: name, value: nil, file: source,
                           typeIdentifier: identifier)
            }
            return
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { [weak self] value, _ in
                guard let self = self else { return }
                if let url = (value as? URL) ?? (value as? String).flatMap(URL.init(string:)),
                   url.isFileURL {
                    let filename = suggested.isEmpty ? url.lastPathComponent : suggested
                    self.store(kind: "file", title: filename, value: nil, file: url)
                } else {
                    self.finish("No se pudo acceder al archivo compartido.")
                }
            }
            return
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] value, _ in
                guard let self = self else { return }
                let address = (value as? URL) ?? (value as? String).flatMap(URL.init(string:))
                guard let address = address else {
                    self.finish("No se pudo leer el contenido compartido.")
                    return
                }
                if address.isFileURL {
                    self.store(kind: "file",
                               title: suggested.isEmpty ? address.lastPathComponent : suggested,
                               value: nil, file: address)
                } else if ["http", "https"].contains(address.scheme?.lowercased() ?? ""),
                          address.host != nil {
                    self.store(kind: "url", title: suggested.isEmpty ? "Enlace" : suggested,
                               value: address.absoluteString, file: nil)
                } else {
                    self.finish("El contenido recibido no es un enlace web ni un archivo accesible.")
                }
            }
            return
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] value, _ in
                guard let self = self else { return }
                if let string = value as? String, !string.isEmpty {
                    self.store(kind: "text", title: suggested.isEmpty ? "Texto" : suggested,
                               value: String(string.prefix(200_000)), file: nil)
                } else {
                    self.finish("No se pudo leer el texto compartido.")
                }
            }
            return
        }
        finish("Formato no compatible con TifloAcosta.")
    }

    private func store(kind: String, title: String, value: String?, file: URL?,
                       typeIdentifier: String? = nil) {
        guard let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) else {
            finish("Falta configurar el grupo compartido de Apple.")
            return
        }
        let manager = FileManager.default
        let inbox = group.appendingPathComponent("ShareInbox", isDirectory: true)
        let id = UUID().uuidString
        let basename = URL(fileURLWithPath: title).lastPathComponent
        let clean = (basename == "." || basename == ".." || basename.isEmpty)
            ? "Contenido.txt" : basename.replacingOccurrences(of: "/", with: "-")
        do {
            try manager.createDirectory(at: inbox, withIntermediateDirectories: true)
            var message: [String: String] = [
                "id": id, "kind": kind,
                "name": String(clean.prefix(170)), "createdAt": ISO8601DateFormatter().string(from: Date())
            ]
            if kind == "file" {
                let detected = typeIdentifier.flatMap { UTType($0) }
                    ?? UTType(filenameExtension: URL(fileURLWithPath: clean).pathExtension)
                message["contentType"] = detected?.preferredMIMEType ?? ""
            }
            if let file = file {
                let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size >= 0 && Int64(size) <= maxBytes else {
                    finish("El archivo supera el límite de 100 MB.")
                    return
                }
                let storedName = id + ".data"
                let destination = inbox.appendingPathComponent(storedName)
                try manager.copyItem(at: file, to: destination)
                message["storedName"] = storedName
            } else {
                guard let value = value, !value.isEmpty else {
                    finish("El contenido estaba vacío.")
                    return
                }
                message["value"] = value
            }
            let manifest = inbox.appendingPathComponent(id + ".json")
            let data = try JSONSerialization.data(withJSONObject: message, options: [.sortedKeys])
            try data.write(to: manifest, options: [.atomic])
            if kind == "file" {
                finish("Documento recibido. Abre TifloAcosta para leerlo directamente o guardarlo.")
            } else if kind == "url" {
                finish("Enlace recibido. Abre TifloAcosta para reproducirlo, abrirlo o analizar descargas.")
            } else {
                finish("Texto recibido. Abre TifloAcosta para elegir la acción adecuada.")
            }
        } catch {
            try? manager.removeItem(at: inbox.appendingPathComponent(id + ".data"))
            finish("No se pudo guardar el contenido. Puedes volver a intentarlo.")
        }
    }
}
