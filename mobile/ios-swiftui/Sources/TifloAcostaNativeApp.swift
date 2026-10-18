import SwiftUI
import UniformTypeIdentifiers

@main
struct TifloAcostaNativeApp: App {
    var body: some Scene {
        WindowGroup { NativeHomeView() }
    }
}

// Pantalla de inicio nativa. Orden acordado para TifloAcosta, sin componentes HTML.
private enum NativeDestination: String, CaseIterable, Identifiable, Hashable {
    case actualidad = "Actualidad"
    case recursos = "Recursos"
    case lector = "TifloLector"
    case recibidos = "Recibidos"
    case novedades = "Novedades"
    case descarga = "Descargar desde un enlace"
    case favoritos = "Favoritos"
    case videos = "Vídeos"
    case podcast = "Podcast"
    case libro = "Mi libro"
    case contacto = "Contacto y redes"
    case privacidad = "Privacidad y accesibilidad"
    case configuracion = "Configuración"

    var id: String { rawValue }

    // Vocabulario de navegación. No equivale todavía a buscar en los contenidos.
    var searchKeywords: String {
        switch self {
        case .actualidad: return "noticias información actualidad rss tecnología"
        case .recursos: return "recursos guías cursos tutoriales documentos aplicaciones"
        case .lector: return "leer lectura tiflolector lector pdf epub txt documentos audiolibros"
        case .recibidos: return "recibidos compartir compartidos archivos enlaces"
        case .novedades: return "novedades publicaciones nuevos artículos"
        case .descarga: return "descargar desde enlace url descarga"
        case .favoritos: return "favoritos guardados"
        case .videos: return "vídeos videos youtube canal reproductor"
        case .podcast: return "podcast podcasts episodios audio"
        case .libro: return "mi libro reflexiones la vida vista desde donde estoy"
        case .contacto: return "contacto redes whatsapp correo facebook youtube"
        case .privacidad: return "privacidad accesibilidad política datos"
        case .configuracion: return "configuración ajustes idioma visual voz tamaño texto"
        }
    }
}

private enum NativeHomeStyle {
    static let red = Color(red: 166.0 / 255.0, green: 27.0 / 255.0, blue: 27.0 / 255.0)
    static let deepRed = Color(red: 127.0 / 255.0, green: 20.0 / 255.0, blue: 20.0 / 255.0)
}

struct NativeHomeView: View {
    @State private var searchText = ""
    @State private var submittedQuery = ""

    private var matchingSections: [NativeDestination] {
        let words = normalized(submittedQuery)
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
        guard !words.isEmpty else { return [] }
        return NativeDestination.allCases.filter { section in
            let searchable = normalized(section.rawValue + " " + section.searchKeywords)
            return words.allSatisfy { searchable.contains($0) }
        }
    }

    private func normalized(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es_ES"))
    }

    private func submitSearch() {
        submittedQuery = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("TifloAcosta App")
                            .font(.title2.bold())
                            .accessibilityAddTraits(.isHeader)
                        Text("Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.")
                            .font(.subheadline)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(NativeHomeStyle.deepRed)
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }

                Section("Buscar con TifloAcosta") {
                    TextField("Introduce tu búsqueda", text: $searchText)
                        .textInputAutocapitalization(.sentences)
                        .submitLabel(.search)
                        .onSubmit(submitSearch)
                        .accessibilityLabel("Introduce tu búsqueda")
                    Button(action: submitSearch) {
                        Text("Buscar")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(NativeHomeStyle.red)
                    .disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                if !submittedQuery.isEmpty {
                    Section("Accesos relacionados") {
                        if matchingSections.isEmpty {
                            Text("No hay secciones relacionadas con esa búsqueda.")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(matchingSections) { destination in
                                NavigationLink(value: destination) {
                                    Text(destination.rawValue)
                                        .frame(minHeight: 44, alignment: .leading)
                                }
                            }
                        }
                        Text("La búsqueda dentro de recursos, noticias y vídeos se conectará al completar esas secciones. Por ahora se buscan accesos de la aplicación.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Secciones") {
                    ForEach(NativeDestination.allCases) { destination in
                        NavigationLink(value: destination) {
                            Text(destination.rawValue)
                                .font(.body)
                                .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        }
                        .accessibilityLabel(destination.rawValue)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Inicio")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: NativeDestination.self) { section in
                switch section {
                case .lector: NativeReaderView()
                case .configuracion: NativeSettingsView()
                default: NativeSectionView(title: section.rawValue)
                }
            }
        }
    }
}

private struct NativeSectionView: View {
    let title: String
    var body: some View {
        List {
            Text("Esta sección todavía no se ha migrado. No se utilizará una vista HTML como sustituto.")
                .accessibilityAddTraits(.isStaticText)
        }
        .navigationTitle(title)
    }
}

private struct NativeSettingsView: View {
    @AppStorage("nativeSpeakRate") private var rate = 0.5
    @AppStorage("nativeFontSize") private var fontSize = 17.0
    var body: some View {
        Form {
            Section("Audio") {
                Slider(value: $rate, in: 0.1...0.9, step: 0.05) {
                    Text("Velocidad de voz")
                }
                .accessibilityValue("\(Int(rate * 100)) por ciento")
            }
            Section("Visual") {
                Slider(value: $fontSize, in: 14...36, step: 1) {
                    Text("Tamaño de texto")
                }
                .accessibilityValue("\(Int(fontSize)) puntos")
            }
        }
        .navigationTitle("Configuración")
    }
}

private struct NativeReaderView: View {
    @State private var importedText = ""
    @State private var title = ""
    @State private var importing = false
    @State private var showSettings = false
    @State private var filter = 0
    @State private var position = 0.0
    @FocusState private var titleFocused: Bool
    private let filters = ["Todos", "Biblioteca", "Fecha", "Título", "Autor"]
    var body: some View {
        List {
            Button("Importar") { importing = true }
            DisclosureGroup("Ajustes", isExpanded: $showSettings) {
                Text("Los ajustes de lectura se incorporarán sin controles web.")
            }
            Picker("Filtro", selection: $filter) {
                ForEach(filters.indices, id: \.self) { index in
                    Text(filters[index]).tag(index)
                }
            }
            .pickerStyle(.navigationLink)
            if !title.isEmpty {
                Section("Documentos") {
                    Text(title)
                        .font(.headline)
                    Text(importedText)
                        .textSelection(.enabled)
                    Slider(value: $position, in: 0...100, step: 10) {
                        Text("Ir a posición")
                    }
                    .accessibilityValue("\(Int(position)) por ciento")
                }
            } else {
                Text("No hay documentos importados.")
            }
        }
        .navigationTitle("TifloLector")
        .fileImporter(isPresented: $importing, allowedContentTypes: [.plainText, .utf8PlainText]) { result in
            guard case let .success(url) = result else { return }
            let granted = url.startAccessingSecurityScopedResource()
            defer { if granted { url.stopAccessingSecurityScopedResource() } }
            if let data = try? Data(contentsOf: url),
               let value = String(data: data, encoding: .utf8) {
                title = url.lastPathComponent
                importedText = value
                position = 0
            }
        }
    }
}
