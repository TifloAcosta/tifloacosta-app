import Foundation

enum NativeDownloadLinkError: LocalizedError {
    case invalid
    case unsupportedFolder
    case unsupportedGoogleLink
    case accessDenied
    case notFound
    case httpStatus(Int)
    case webPageInsteadOfFile
    case tooLarge
    case emptyFile

    var errorDescription: String? {
        switch self {
        case .invalid:
            return "Pega un enlace HTTPS válido y pulsa Analizar enlace."
        case .unsupportedFolder:
            return "Este enlace señala una carpeta. Abre la carpeta en Google Drive y comparte el enlace de un archivo concreto."
        case .unsupportedGoogleLink:
            return "No se ha podido reconocer el archivo de Google Drive. Comprueba el enlace compartido."
        case .accessDenied:
            return "Google Drive no permite descargar este archivo sin autorización. Si es tuyo, revisa Compartir y permite el acceso a quien tenga el enlace. Si no, solicita permiso a la persona propietaria."
        case .notFound:
            return "El archivo no se ha encontrado. Puede que el enlace haya caducado o que el archivo se haya eliminado."
        case .httpStatus(let code):
            return "El servidor ha rechazado la descarga (HTTP \(code)). Comprueba el enlace o inténtalo más tarde."
        case .webPageInsteadOfFile:
            return "Google Drive ha devuelto una página de visualización o de inicio de sesión, no el archivo. Abre el enlace original y comprueba los permisos de descarga."
        case .tooLarge:
            return "El archivo supera el límite de 100 MB."
        case .emptyFile:
            return "El archivo está vacío y no se ha guardado."
        }
    }
}

struct NativeAnalyzedDownload {
    let sourceURL: URL
    let downloadURL: URL
    let type: String
    let isGoogleDrive: Bool
    let fallbackFilename: String

    static func inspect(_ raw: String) throws -> NativeAnalyzedDownload {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let source = URL(string: value),
              source.scheme?.lowercased() == "https",
              let host = source.host?.lowercased(),
              !host.isEmpty else {
            throw NativeDownloadLinkError.invalid
        }
        let segments = source.pathComponents.filter { $0 != "/" }
        let googleDrive = host == "drive.google.com" || host == "www.drive.google.com"
        let googleDocs = host == "docs.google.com"
        let key = URLComponents(url: source, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name.lowercased() == "resourcekey" })

        func validID(_ id: String) -> Bool {
            !id.isEmpty && id.rangeOfCharacter(
                from: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-").inverted
            ) == nil
        }

        if googleDrive {
            if source.path.contains("/folders/") {
                throw NativeDownloadLinkError.unsupportedFolder
            }
            var fileID: String?
            if segments.count >= 3 && segments[0] == "file" && segments[1] == "d" {
                fileID = segments[2]
            } else if segments.first == "uc" || segments.first == "open" {
                fileID = URLComponents(url: source, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "id" })?.value
            }
            guard let id = fileID, validID(id) else {
                throw NativeDownloadLinkError.unsupportedGoogleLink
            }
            var direct = URLComponents(string: "https://drive.google.com/uc")!
            direct.queryItems = [
                URLQueryItem(name: "export", value: "download"),
                URLQueryItem(name: "id", value: id)
            ]
            if let key { direct.queryItems?.append(key) }
            return NativeAnalyzedDownload(
                sourceURL: source, downloadURL: direct.url!, type: "Archivo de Google Drive",
                isGoogleDrive: true, fallbackFilename: "Archivo-\(id)"
            )
        }

        if googleDocs {
            guard segments.count >= 3,
                  ["document", "spreadsheets", "presentation"].contains(segments[0]),
                  segments[1] == "d", validID(segments[2]) else {
                throw NativeDownloadLinkError.unsupportedGoogleLink
            }
            let id = segments[2]
            var export = URLComponents(string: "https://docs.google.com/\(segments[0])/d/\(id)/export")!
            export.queryItems = [URLQueryItem(name: "format", value: "pdf")]
            return NativeAnalyzedDownload(
                sourceURL: source, downloadURL: export.url!, type: "Documento de Google (PDF)",
                isGoogleDrive: true, fallbackFilename: "Documento-\(id).pdf"
            )
        }

        if host == "localhost" || host == "127.0.0.1" || host == "::1" {
            throw NativeDownloadLinkError.invalid
        }
        let candidate = source.lastPathComponent
        return NativeAnalyzedDownload(
            sourceURL: source, downloadURL: source, type: "Enlace HTTPS",
            isGoogleDrive: false, fallbackFilename: candidate.isEmpty || candidate == "/"
                ? "Archivo" : candidate
        )
    }

    static func verifyResponse(_ response: URLResponse, for item: NativeAnalyzedDownload) throws {
        guard let http = response as? HTTPURLResponse else {
            throw NativeDownloadLinkError.httpStatus(-1)
        }
        switch http.statusCode {
        case 200...299: break
        case 401, 403: throw NativeDownloadLinkError.accessDenied
        case 404, 410: throw NativeDownloadLinkError.notFound
        default: throw NativeDownloadLinkError.httpStatus(http.statusCode)
        }
        let contentType = (http.value(forHTTPHeaderField: "Content-Type") ?? "")
            .lowercased()
        let attachment = (http.value(forHTTPHeaderField: "Content-Disposition") ?? "")
            .lowercased().contains("attachment")
        if item.isGoogleDrive && contentType.contains("text/html") && !attachment {
            throw NativeDownloadLinkError.webPageInsteadOfFile
        }
    }
}
