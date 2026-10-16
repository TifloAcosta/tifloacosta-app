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
        heading.text = "Guardar en TifloAcosta"
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

    private func receiveFirstAttachment() {
        guard let context = extensionContext,
              let item = (context.inputItems as? [NSExtensionItem])?.first,
              let provider = item.attachments?.first else {
            finish("No se ha recibido contenido compatible.")
            return
        }
        let name = provider.suggestedName ?? "Contenido"
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                guard let self = self else { return }
                if let url = item as? URL, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                    self.store(kind: "url", title: name, value: url.absoluteString, file: nil)
                } else {
                    self.finish("El enlace no es válido.")
                }
            }
            return
        }
        // Files retain their exact bytes. The provider's temporary URL is only
        // valid inside this callback, so copy before returning.
        let supported = ["pdf", "txt", "html", "htm", "md", "docx", "pptx",
                         "xlsx", "epub", "odt", "mp3", "zip"]
        let types = provider.registeredTypeIdentifiers
        let selected = types.first { identifier in
            guard let type = UTType(identifier) else { return false }
            return supported.contains(type.preferredFilenameExtension?.lowercased() ?? "") ||
                type.conforms(to: .pdf) || type.conforms(to: .plainText) ||
                type.conforms(to: .html) || type.conforms(to: .mp3)
        }
        if let identifier = selected {
            provider.loadFileRepresentation(forTypeIdentifier: identifier) { [weak self] url, _ in
                guard let self = self else { return }
                guard let url = url else {
                    self.finish("No se pudo abrir el archivo recibido.")
                    return
                }
                let suffix = UTType(identifier)?.preferredFilenameExtension ?? ""
                var fileName = name
                if URL(fileURLWithPath: fileName).pathExtension.isEmpty && !suffix.isEmpty {
                    fileName += "." + suffix
                }
                self.store(kind: "file", title: fileName, value: nil, file: url)
            }
            return
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
                guard let self = self else { return }
                if let string = item as? String, !string.isEmpty {
                    self.store(kind: "text", title: name, value: String(string.prefix(200_000)), file: nil)
                } else {
                    self.finish("No se pudo leer el texto compartido.")
                }
            }
        } else {
            finish("Formato no compatible con TifloLector.")
        }
    }

    private func store(kind: String, title: String, value: String?, file: URL?) {
        guard let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) else {
            finish("Falta configurar el grupo compartido de Apple.")
            return
        }
        let manager = FileManager.default
        let inbox = group.appendingPathComponent("ShareInbox", isDirectory: true)
        let id = UUID().uuidString
        let clean = URL(fileURLWithPath: title).lastPathComponent
            .replacingOccurrences(of: "/", with: "-")
        do {
            try manager.createDirectory(at: inbox, withIntermediateDirectories: true)
            var message: [String: String] = [
                "id": id, "kind": kind,
                "name": String(clean.prefix(170)), "createdAt": ISO8601DateFormatter().string(from: Date())
            ]
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
            finish("Contenido guardado. Abre TifloAcosta para importarlo a la Biblioteca.")
        } catch {
            try? manager.removeItem(at: inbox.appendingPathComponent(id + ".data"))
            finish("No se pudo guardar el contenido. Puedes volver a intentarlo.")
        }
    }
}
