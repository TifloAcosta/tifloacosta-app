import Foundation

/// Descarga archivos públicos de Drive sin confundir las páginas HTML de confirmación
/// con documentos. No salta permisos ni intenta acceder a archivos privados.
enum NativeDriveTransfer {
    static func download(_ item: NativeAnalyzedDownload) async throws -> (URL, URLResponse) {
        guard item.isGoogleDrive else {
            return try await URLSession.shared.download(from: item.downloadURL)
        }

        var candidates = [item.downloadURL]
        // Drive puede servir el archivo desde su dominio de contenidos en lugar de /uc.
        if item.downloadURL.host == "drive.google.com",
           let id = URLComponents(url: item.downloadURL, resolvingAgainstBaseURL: false)?
               .queryItems?.first(where: { $0.name == "id" })?.value {
            var direct = URLComponents(string: "https://drive.usercontent.google.com/download")!
            direct.queryItems = [
                URLQueryItem(name: "id", value: id),
                URLQueryItem(name: "export", value: "download"),
                URLQueryItem(name: "confirm", value: "t")
            ]
            if let key = URLComponents(url: item.downloadURL, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "resourcekey" }) {
                direct.queryItems?.append(key)
            }
            if let url = direct.url { candidates.append(url) }

            // Algunos archivos grandes requieren confirm=t también en /uc;
            // no es un método para acceder a archivos privados.
            var confirmedOriginal = URLComponents(url: item.downloadURL, resolvingAgainstBaseURL: false)!
            var query = confirmedOriginal.queryItems ?? []
            query.removeAll { $0.name == "confirm" }
            query.append(URLQueryItem(name: "confirm", value: "t"))
            confirmedOriginal.queryItems = query
            if let url = confirmedOriginal.url { candidates.append(url) }
        }

        var lastError: Error = NativeDownloadLinkError.webPageInsteadOfFile
        for candidate in candidates {
            do {
                let (temporary, response) = try await URLSession.shared.download(from: candidate)
                do {
                    try NativeAnalyzedDownload.verifyResponse(response, for: item)
                    return (temporary, response)
                } catch NativeDownloadLinkError.webPageInsteadOfFile {
                    // Algunos archivos grandes requieren aceptar la confirmación de Drive.
                    // Solo seguimos formularios de descarga HTTPS en dominios oficiales.
                    if let confirmation = confirmationURL(temporary, response: response, item: item) {
                        // Algunos enlaces públicos exigen más de una pantalla
                        // de confirmación. Se admiten como máximo tres saltos,
                        // siempre en dominios oficiales y con el mismo ID.
                        var nextURL = confirmation
                        var visited = Set([candidate.absoluteString])
                        for _ in 0..<3 {
                            guard visited.insert(nextURL.absoluteString).inserted else { break }
                            let (file, confirmedResponse) = try await URLSession.shared.download(from: nextURL)
                            do {
                                try NativeAnalyzedDownload.verifyResponse(confirmedResponse, for: item)
                                return (file, confirmedResponse)
                            } catch NativeDownloadLinkError.webPageInsteadOfFile {
                                guard let following = confirmationURL(
                                    file, response: confirmedResponse, item: item
                                ) else { break }
                                nextURL = following
                            }
                        }
                    }
                    lastError = NativeDownloadLinkError.webPageInsteadOfFile
                }
            } catch {
                lastError = error
                if let linkError = error as? NativeDownloadLinkError {
                    switch linkError {
                    case .accessDenied, .notFound:
                        // Un punto de descarga de Google puede rechazar el
                        // acceso anónimo mientras el otro sí sirve el archivo
                        // público. Comprobar ambas URLs antes de darlo por denegado.
                        // Nunca se eluden permisos ni se guarda una página HTML.
                        continue
                    default: break
                    }
                }
            }
        }
        throw lastError
    }

    private static func confirmationURL(
        _ temporary: URL, response: URLResponse, item: NativeAnalyzedDownload
    ) -> URL? {
        guard item.downloadURL.host == "drive.google.com",
              let expectedID = URLComponents(url: item.downloadURL, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "id" })?.value,
              let size = try? temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size > 0 && size <= 1024 * 1024,
              let data = try? Data(contentsOf: temporary),
              let html = String(data: data, encoding: .utf8) else { return nil }

        let pattern = #"<form\b[^>]*>[\s\S]*?</form>"#
        guard let forms = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }
        let matches = forms.matches(in: html, range: NSRange(html.startIndex..., in: html))
        for match in matches {
            guard let range = Range(match.range, in: html) else { continue }
            let form = String(html[range])
            guard let opening = form.range(of: ">", options: .literal) else { continue }
            let attributes = attributesOf(String(form[..<opening.upperBound]))
            guard let action = attributes["action"],
                  let url = URL(string: action.replacingOccurrences(of: "&amp;", with: "&"),
                                relativeTo: response.url)?.absoluteURL,
                  var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                  validHost(components.host), components.scheme == "https" else { continue }

            var query = components.queryItems ?? []
            let inputPattern = #"<input\b[^>]*>"#
            if let inputs = try? NSRegularExpression(pattern: inputPattern, options: [.caseInsensitive]) {
                for input in inputs.matches(in: form, range: NSRange(form.startIndex..., in: form)) {
                    guard let r = Range(input.range, in: form) else { continue }
                    let attrs = attributesOf(String(form[r]))
                    if let name = attrs["name"], let value = attrs["value"],
                       ["id", "export", "confirm", "uuid", "resourcekey", "at", "authuser"].contains(name.lowercased()) {
                        query.removeAll { $0.name == name }
                        query.append(URLQueryItem(name: name, value: value))
                    }
                }
            }
            guard query.first(where: { $0.name == "id" })?.value == expectedID,
                  query.contains(where: { $0.name == "confirm" }) else { continue }
            components.queryItems = query
            if let confirmed = components.url { return confirmed }
        }

        // Algunas respuestas de Drive muestran un enlace de descarga en
        // vez de un formulario. Nunca seguimos vínculos arbitrarios: deben
        // ser HTTPS oficiales, contener el ID original y confirmación.
        let linkPattern = #"<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>"#
        if let links = try? NSRegularExpression(pattern: linkPattern, options: [.caseInsensitive]) {
            for match in links.matches(in: html, range: NSRange(html.startIndex..., in: html)) {
                guard match.numberOfRanges > 1,
                      let range = Range(match.range(at: 1), in: html) else { continue }
                let raw = String(html[range])
                    .replacingOccurrences(of: "&amp;", with: "&")
                guard let url = URL(string: raw, relativeTo: response.url)?.absoluteURL,
                      let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                      components.scheme == "https",
                      validHost(components.host),
                      components.queryItems?.first(where: { $0.name == "id" })?.value == expectedID,
                      components.queryItems?.contains(where: { $0.name == "confirm" }) == true else {
                    continue
                }
                return url
            }
        }
        return nil
    }

    private static func validHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        return host == "drive.google.com" || host == "drive.usercontent.google.com"
    }

    private static func attributesOf(_ tag: String) -> [String: String] {
        let pattern = #"([A-Za-z_-]+)\s*=\s*["']([^"']*)["']"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [:] }
        var attributes: [String: String] = [:]
        for match in regex.matches(in: tag, range: NSRange(tag.startIndex..., in: tag)) {
            guard match.numberOfRanges == 3,
                  let name = Range(match.range(at: 1), in: tag),
                  let value = Range(match.range(at: 2), in: tag) else { continue }
            attributes[String(tag[name]).lowercased()] = String(tag[value])
        }
        return attributes
    }
}
