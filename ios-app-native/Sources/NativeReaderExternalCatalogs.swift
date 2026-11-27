import SwiftUI
import Foundation

/// Bibliotecas públicas y catálogos añadidos por la persona usuaria.
/// No se guardan contraseñas ni se transmiten los libros de la biblioteca local.
struct NativeExternalCatalog: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var url: URL

    static let gutenberg = NativeExternalCatalog(
        id: "gutenberg",
        name: "Proyecto Gutenberg",
        url: URL(string: "https://www.gutenberg.org/ebooks/search.opds/")!
    )
}

private struct NativeOPDSLink {
    let url: URL
    let mime: String
}

private struct NativeOPDSEntry: Identifiable {
    let id = UUID()
    let title: String
    let author: String
    let navigationURL: URL?
    let acquisition: NativeOPDSLink?
}

private struct NativeOPDSPage {
    let entries: [NativeOPDSEntry]
    let nextURL: URL?
}

private enum NativeCatalogError: LocalizedError {
    case invalidURL, invalidCatalog, invalidResponse, tooLarge, unavailableFormat
    case gutenbergDenied, gutenbergRateLimited
    case gutenbergUnavailable
    case gutenbergRetryAfter(Date)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return MusicLocalized.message("Introduce una dirección HTTPS válida de un catálogo OPDS.")
        case .invalidCatalog: return MusicLocalized.message("No se ha podido interpretar este catálogo como OPDS 1 o 2.")
        case .invalidResponse: return MusicLocalized.message("La biblioteca ha devuelto una respuesta no válida.")
        case .tooLarge: return MusicLocalized.message("El catálogo o el archivo supera el tamaño máximo permitido.")
        case .unavailableFormat: return MusicLocalized.message("Esta obra no ofrece una descarga directa en un formato que TifloLector pueda leer.")
        case .gutenbergDenied: return MusicLocalized.message("Proyecto Gutenberg ha rechazado la conexión. Puedes consultar su web oficial.")
        case .gutenbergRateLimited: return MusicLocalized.message("Proyecto Gutenberg ha limitado temporalmente las consultas. Inténtalo más tarde.")
        case .gutenbergUnavailable: return MusicLocalized.message("Proyecto Gutenberg no está disponible temporalmente. Inténtalo más tarde.")
        case .gutenbergRetryAfter(let date):
            return MusicLocalized.format("Proyecto Gutenberg solicita esperar hasta %@ antes de volver a conectar.", DateFormatter.localizedString(from: date, dateStyle: .short, timeStyle: .short))
        }
    }
}

/// OPDS 1: Atom XML con enlaces de navegación y adquisición.
/// Un enlace a compra, préstamo o muestra nunca se trata como descarga libre.
private final class NativeAtomOPDSParser: NSObject, XMLParserDelegate {
    private let base: URL
    private var inEntry = false
    private var hasFeedRoot = false
    private var sawRoot = false
    private var inAuthor = false
    private var activeField = ""
    private var buffer = ""
    private var title = ""
    private var author = ""
    private var navigation: URL?
    private var acquisition: NativeOPDSLink?
    private(set) var entries: [NativeOPDSEntry] = []
    private(set) var nextURL: URL?

    init(base: URL) { self.base = base }

    private func key(_ element: String) -> String {
        element.split(separator: ":").last.map(String.init)?.lowercased() ?? element.lowercased()
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        let element = key(elementName)
        if !sawRoot {
            sawRoot = true
            hasFeedRoot = element == "feed"
        }
        if element == "entry" {
            inEntry = true
            title = ""
            author = ""
            navigation = nil
            acquisition = nil
        } else if element == "author" && inEntry {
            inAuthor = true
        } else if inEntry && (element == "title" || (element == "name" && inAuthor)) {
            activeField = element
            buffer = ""
        } else if element == "link",
                  let href = attributeDict["href"],
                  let url = NativeOPDSService.secureURL(href, relativeTo: base) {
            let rel = attributeDict["rel"] ?? ""
            let mime = attributeDict["type"] ?? ""
            if inEntry {
                if NativeOPDSService.isDirectAcquisition(rel),
                   NativeOPDSService.supportedExtension(url: url, mime: mime) != nil,
                   acquisition == nil {
                    acquisition = NativeOPDSLink(url: url, mime: mime)
                } else if rel == "subsection" || rel == "alternate" ||
                          (mime.contains("application/atom+xml") && rel.isEmpty) {
                    navigation = navigation ?? url
                }
            } else if rel == "next" {
                nextURL = url
            }
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if !activeField.isEmpty { buffer += string }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        let element = key(elementName)
        if inEntry && element == activeField {
            let value = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            if element == "title" { title = value }
            if element == "name" && inAuthor { author = value }
            activeField = ""
            buffer = ""
        }
        if element == "author" { inAuthor = false }
        if element == "entry" {
            if !title.isEmpty {
                entries.append(NativeOPDSEntry(title: title, author: author,
                    navigationURL: navigation, acquisition: acquisition))
            }
            inEntry = false
        }
    }

    func read(_ data: Data) throws -> NativeOPDSPage {
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.shouldResolveExternalEntities = false
        guard parser.parse(), hasFeedRoot else { throw NativeCatalogError.invalidCatalog }
        return NativeOPDSPage(entries: entries, nextURL: nextURL)
    }
}

private enum NativeOPDSService {
    static let feedLimit = 5 * 1024 * 1024
    static let bookLimit = 80 * 1024 * 1024
    static let supported = Set([
        "epub", "pdf", "txt", "text", "html", "htm", "rtf", "fb2", "docx", "odt",
        "pptx", "ppsx", "pptm", "xlsx", "xlsm", "daisy", "zip", "mp3", "m4a", "m4b",
        "jpg", "jpeg", "png", "md"
    ])

    static func secureURL(_ address: String, relativeTo base: URL? = nil) -> URL? {
        guard let url = URL(string: address, relativeTo: base)?.absoluteURL,
              url.scheme?.lowercased() == "https",
              url.host?.isEmpty == false,
              url.user == nil, url.password == nil else { return nil }
        return url
    }

    static func isDirectAcquisition(_ relation: String) -> Bool {
        relation == "http://opds-spec.org/acquisition" ||
        relation == "http://opds-spec.org/acquisition/open-access"
    }

    static func supportedExtension(url: URL, mime: String) -> String? {
        let type = mime.lowercased().split(separator: ";").first.map(String.init) ?? ""
        let formats = [
            "application/epub+zip": "epub",
            "application/pdf": "pdf",
            "text/plain": "txt",
            "text/html": "html",
            "application/rtf": "rtf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
            "application/zip": "zip",
            "audio/mpeg": "mp3",
            "audio/mp4": "m4a"
        ]
        if let ext = formats[type] { return ext }
        let ext = url.pathExtension.lowercased()
        return supported.contains(ext) ? ext : nil
    }

    static func isGutenbergURL(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return url.scheme?.lowercased() == "https" && ["www.gutenberg.org", "gutenberg.org"].contains(host)
    }

    static func catalogRequest(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        if isGutenbergURL(url) {
            let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.7"
            request.setValue("TifloAcosta/\(version) (tifloacosta@gmail.com)", forHTTPHeaderField: "User-Agent")
        }
        return request
    }

    private static let gutenbergRetryKey = "native-reader-gutenberg-retry-after-v1"

    static func retryAfter(_ header: String?, now: Date = Date()) -> Date? {
        guard let value = header?.trimmingCharacters(in: .whitespacesAndNewlines) else { return nil }
        if let seconds = Double(value), seconds.isFinite, seconds > 0 {
            return now.addingTimeInterval(seconds)
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        guard let date = formatter.date(from: value), date > now else { return nil }
        return date
    }

    static func respectGutenbergRetryAfter(_ url: URL) throws {
        guard isGutenbergURL(url), let date = UserDefaults.standard.object(forKey: gutenbergRetryKey) as? Date else { return }
        if date > Date() { throw NativeCatalogError.gutenbergRetryAfter(date) }
        UserDefaults.standard.removeObject(forKey: gutenbergRetryKey)
    }

    static func validateResponse(_ response: URLResponse, requestedURL: URL) throws -> HTTPURLResponse {
        guard let http = response as? HTTPURLResponse,
              secureURL(http.url?.absoluteString ?? "") != nil else {
            throw NativeCatalogError.invalidResponse
        }
        if isGutenbergURL(requestedURL) {
            if http.statusCode == 503 || http.statusCode == 429,
               let date = retryAfter(http.value(forHTTPHeaderField: "Retry-After")) {
                UserDefaults.standard.set(date, forKey: gutenbergRetryKey)
                throw NativeCatalogError.gutenbergRetryAfter(date)
            }
            if http.statusCode == 403 { throw NativeCatalogError.gutenbergDenied }
            if http.statusCode == 429 { throw NativeCatalogError.gutenbergRateLimited }
            if http.statusCode == 503 { throw NativeCatalogError.gutenbergUnavailable }
        }
        guard (200...299).contains(http.statusCode) else { throw NativeCatalogError.invalidResponse }
        return http
    }

    static func fetch(_ url: URL) async throws -> NativeOPDSPage {
        try respectGutenbergRetryAfter(url)
        var request = catalogRequest(url)
        request.timeoutInterval = 25
        request.setValue("application/atom+xml, application/opds+json, application/json",
                         forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = try validateResponse(response, requestedURL: url)
        if http.mimeType?.lowercased() == "text/html" { throw NativeCatalogError.invalidCatalog }
        guard data.count <= feedLimit else { throw NativeCatalogError.tooLarge }
        return try decodeFeed(data, base: http.url ?? url, mime: http.mimeType)
    }

    static func decodeFeed(_ data: Data, base: URL, mime: String? = nil) throws -> NativeOPDSPage {
        let prefix = data.starts(with: [0xEF, 0xBB, 0xBF]) ? data.dropFirst(3) : data[...]
        let first = prefix.first { ![9, 10, 13, 32].contains($0) }
        if mime?.lowercased().contains("json") == true || first == 123 || first == 91 {
            return try parseJSON(Data(prefix), base: base)
        }
        return try NativeAtomOPDSParser(base: base).read(data)
    }

    static func parseJSON(_ data: Data, base: URL) throws -> NativeOPDSPage {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeCatalogError.invalidCatalog
        }
        guard root["navigation"] is [[String: Any]] || root["publications"] is [[String: Any]] || root["groups"] is [[String: Any]] else {
            throw NativeCatalogError.invalidCatalog
        }
        var entries: [NativeOPDSEntry] = []
        var next: URL?
        if let links = root["links"] as? [[String: Any]] {
            for link in links where (link["rel"] as? String) == "next" {
                if let href = link["href"] as? String {
                    next = secureURL(href, relativeTo: base)
                }
            }
        }
        var sections = (root["navigation"] as? [[String: Any]] ?? []) +
                       (root["publications"] as? [[String: Any]] ?? [])
        for group in root["groups"] as? [[String: Any]] ?? [] {
            sections += group["navigation"] as? [[String: Any]] ?? []
            sections += group["publications"] as? [[String: Any]] ?? []
        }
        for record in sections {
            let metadata = record["metadata"] as? [String: Any] ?? [:]
            let title = (metadata["title"] as? String ?? record["title"] as? String ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty else { continue }
            var author = metadata["author"] as? String ?? ""
            if author.isEmpty, let people = metadata["author"] as? [[String: Any]] {
                author = people.compactMap { $0["name"] as? String }.joined(separator: ", ")
            }
            let links = record["links"] as? [[String: Any]] ?? []
            var acquisition: NativeOPDSLink?
            var navigation: URL?
            for link in links {
                guard let href = link["href"] as? String,
                      let url = secureURL(href, relativeTo: base) else { continue }
                let mime = link["type"] as? String ?? ""
                let rels = (link["rel"] as? [String]) ??
                           (link["rel"] as? String).map { [$0] } ?? []
                if rels.contains(where: isDirectAcquisition),
                   supportedExtension(url: url, mime: mime) != nil,
                   acquisition == nil {
                    acquisition = NativeOPDSLink(url: url, mime: mime)
                } else if (record["href"] != nil || record["title"] != nil ||
                           rels.contains("subsection") || rels.contains("collection")),
                          mime.contains("opds") || mime.contains("atom") {
                    navigation = navigation ?? url
                }
            }
            // An OPDS 2 navigation object is a link itself, not always a "links" array.
            if navigation == nil, let href = record["href"] as? String {
                navigation = secureURL(href, relativeTo: base)
            }
            entries.append(NativeOPDSEntry(title: title, author: author,
                navigationURL: navigation, acquisition: acquisition))
        }
        return NativeOPDSPage(entries: entries, nextURL: next)
    }

    @MainActor
    static func importBook(_ link: NativeOPDSLink, title: String,
                           into library: NativeReaderLibrary) async throws {
        guard secureURL(link.url.absoluteString) != nil,
              let format = supportedExtension(url: link.url, mime: link.mime) else {
            throw NativeCatalogError.unavailableFormat
        }
        try respectGutenbergRetryAfter(link.url)
        var request = catalogRequest(link.url)
        request.timeoutInterval = 90
        let (temporary, response) = try await URLSession.shared.download(for: request)
        defer { try? FileManager.default.removeItem(at: temporary) }
        _ = try validateResponse(response, requestedURL: link.url)
        let size = (try? temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size > 0 && size <= bookLimit else { throw NativeCatalogError.tooLarge }
        // A provider may redirect to an HTML sign-in form instead of a book.
        if format != "html", response.mimeType?.lowercased() == "text/html" {
            throw NativeCatalogError.invalidResponse
        }
        let prepared = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString).appendingPathExtension(format)
        try await library.importFile(from: temporary, originalName: prepared.lastPathComponent,
                                     preferredTitle: title)
    }
}

struct NativeReaderCatalogsScreen: View {
    @State private var saved: [NativeExternalCatalog] = []
    @State private var showAdd = false
    @State private var proposedName = ""
    @State private var proposedURL = ""
    @State private var errorMessage: String?

    private func load() {
        if let data = UserDefaults.standard.data(forKey: "native-reader-opds-sources"),
           let decoded = try? JSONDecoder().decode([NativeExternalCatalog].self, from: data) {
            saved = decoded
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(saved) {
            UserDefaults.standard.set(data, forKey: "native-reader-opds-sources")
        }
    }

    private func addCatalog() {
        guard let url = NativeOPDSService.secureURL(
            proposedURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            errorMessage = NativeCatalogError.invalidURL.localizedDescription
            return
        }
        let name = proposedName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.count <= 80,
              !saved.contains(where: { $0.url == url }),
              url != NativeExternalCatalog.gutenberg.url else {
            errorMessage = MusicLocalized.message("Introduce un nombre válido y una biblioteca que no figure ya en la lista.")
            return
        }
        saved.append(NativeExternalCatalog(id: UUID().uuidString, name: name, url: url))
        persist()
        proposedName = ""
        proposedURL = ""
        showAdd = false
    }

    var body: some View {
        List {
            Section("Bibliotecas públicas") {
                NavigationLink("Proyecto Gutenberg") {
                    NativeReaderOPDSFeedScreen(
                        heading: "Proyecto Gutenberg",
                        initialURL: NativeExternalCatalog.gutenberg.url,
                        isGutenberg: true
                    )
                }
            }
            Section("Mis catálogos OPDS") {
                ForEach(saved) { source in
                    NavigationLink(source.name) {
                        NativeReaderOPDSFeedScreen(heading: source.name,
                                                   initialURL: source.url,
                                                   isGutenberg: false)
                    }
                    .accessibilityHint("Explorar catálogo.")
                }
                .onDelete { indices in saved.remove(atOffsets: indices); persist() }
                Button("Añadir catálogo OPDS") { showAdd = true }
                Text("Admite catálogos públicos OPDS 1 (Atom) y OPDS 2 (JSON), mediante HTTPS.")
                    .font(.footnote)
            }
            Section("Bibliotecas con acceso autorizado") {
                Link("Abrir Bookshare", destination: URL(string: "https://www.bookshare.org/")!)
                Text("Bookshare exige una cuenta elegible y autorización de su API para descargar directamente desde TifloLector. Por ahora se abre su sitio web.")
                    .font(.footnote)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Bibliotecas en línea")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: load)
        .sheet(isPresented: $showAdd) {
            NavigationStack {
                Form {
                    TextField("Nombre de la biblioteca", text: $proposedName)
                    TextField("Dirección HTTPS del catálogo OPDS", text: $proposedURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    Button("Guardar catálogo") { addCatalog() }
                }
                .tifloScreenSurface()
                .navigationTitle("Añadir catálogo")
                .toolbar { Button("Cerrar") { showAdd = false } }
            }
        }
        .alert("No se pudo añadir la biblioteca", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) {
            Button("Aceptar", role: .cancel) { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }
}

private struct NativeReaderOPDSFeedScreen: View {
    let heading: String
    let initialURL: URL
    let isGutenberg: Bool
    @EnvironmentObject private var library: NativeReaderLibrary
    @State private var currentURL: URL
    @State private var page: NativeOPDSPage?
    @State private var loading = false
    @State private var feedFailed = false
    @State private var feedError: String?
    @State private var loadRevision = 0
    @State private var importing: UUID?
    @State private var searchText = ""
    @State private var message: String?
    @State private var error: String?

    init(heading: String, initialURL: URL, isGutenberg: Bool) {
        self.heading = heading
        self.initialURL = initialURL
        self.isGutenberg = isGutenberg
        _currentURL = State(initialValue: initialURL)
    }

    private var filtered: [NativeOPDSEntry] {
        guard let entries = page?.entries else { return [] }
        if isGutenberg { return entries }
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return entries }
        return entries.filter { $0.title.localizedStandardContains(term) ||
                                $0.author.localizedStandardContains(term) }
    }

    private func loadFeed() async {
        let url = currentURL
        loading = true
        let revision = loadRevision
        feedFailed = false
        feedError = nil
        defer { if currentURL == url && loadRevision == revision { loading = false } }
        do {
            let result = try await NativeOPDSService.fetch(url)
            guard !Task.isCancelled, currentURL == url, loadRevision == revision else { return }
            page = result
        } catch {
            guard !Task.isCancelled, currentURL == url, loadRevision == revision else { return }
            feedFailed = true
            feedError = error.localizedDescription
            page = nil
        }
    }

    private func searchGutenberg() {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var components = URLComponents(url: NativeExternalCatalog.gutenberg.url,
                                             resolvingAgainstBaseURL: false) else { return }
        components.queryItems = term.isEmpty ? nil : [URLQueryItem(name: "query", value: term)]
        if let url = components.url, url != currentURL {
            page = nil
            currentURL = url
        } else if feedFailed && !loading {
            loadRevision += 1
        }
    }

    private var searchSection: some View {
        Section("Buscar") {
            TextField("Título o autor", text: $searchText)
                .submitLabel(.search)
                .onSubmit {
                    if isGutenberg { searchGutenberg() }
                }
            if isGutenberg {
                Button("Buscar en todo Proyecto Gutenberg") { searchGutenberg() }
            } else {
                Text("La búsqueda filtra los resultados de esta página del catálogo.")
                    .font(.footnote)
            }
        }
    }

    private func importEntry(_ item: NativeOPDSEntry, link: NativeOPDSLink) {
        importing = item.id
        Task {
            defer { importing = nil }
            do {
                try await NativeOPDSService.importBook(link, title: item.title, into: library)
                message = MusicLocalized.format("«%@» guardado en TifloLector.", item.title)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    @ViewBuilder
    private func itemRow(_ item: NativeOPDSEntry) -> some View {
        if let url = item.navigationURL, item.acquisition == nil {
            NavigationLink {
                NativeReaderOPDSFeedScreen(heading: item.title, initialURL: url,
                                           isGutenberg: isGutenberg)
            } label: {
                VStack(alignment: .leading) {
                    Text(item.title)
                    if !item.author.isEmpty { Text(item.author).font(.footnote) }
                }
            }
            .accessibilityHint("Abrir sección del catálogo.")
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title)
                if !item.author.isEmpty { Text(item.author).font(.footnote) }
                if let link = item.acquisition {
                    Button(MusicLocalized.message(importing == item.id ? "Importando" : "Importar a mi biblioteca")) {
                        importEntry(item, link: link)
                    }
                    .disabled(importing != nil)
                    .accessibilityHint("Descarga la obra y la incorpora a TifloLector.")
                } else {
                    Text("Esta entrada no ofrece descarga directa compatible.")
                        .font(.footnote)
                }
            }
        }
    }

    private var resultsSection: some View {
        Section("Resultados") {
            if !loading && !feedFailed && filtered.isEmpty {
                Text("No se encontraron obras en esta página.")
            }
            ForEach(filtered) { item in itemRow(item) }
        }
    }

    var body: some View {
        List {
            searchSection
            if loading { ProgressView("Consultando biblioteca") }
            if let message {
                Text(message).accessibilityAddTraits(.updatesFrequently)
            }
            if feedFailed && !loading {
                Section {
                    if let feedError { Text(feedError).accessibilityAddTraits(.updatesFrequently) }
                    Button("Reintentar") { loadRevision += 1 }
                    if isGutenberg {
                        Link("Abrir Proyecto Gutenberg en la web", destination: URL(string: "https://www.gutenberg.org/")!)
                    }
                }
            }
            resultsSection
            if let next = page?.nextURL, !loading {
                Section {
                    Button("Mostrar más resultados") { currentURL = next }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(heading)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: currentURL.absoluteString + "#" + String(loadRevision)) { await loadFeed() }
        .alert("No se pudo completar la operación", isPresented: Binding(
            get: { error != nil }, set: { if !$0 { error = nil } }
        )) {
            Button("Aceptar", role: .cancel) { error = nil }
        } message: { Text(error ?? "") }
    }
}
