import SwiftUI
import UniformTypeIdentifiers

@main
struct TifloAcostaNativeApp: App {
    var body: some Scene {
        WindowGroup { NativeHomeView() }
    }
}

private enum NativeDestination: String, CaseIterable, Identifiable {
    case novedades = "Novedades"
    case actualidad = "Actualidad"
    case recursos = "Recursos"
    case videos = "Vídeos"
    case podcasts = "Podcasts"
    case lector = "TifloLector"
    case configuracion = "Configuración"

    var id: String { rawValue }
}

struct NativeHomeView: View {
    @State private var selected: NativeDestination??
    var body: some View {
        NavigationStack {
            List(NativeDestination.allCases) { section in
                NavigationLink(value: section) {
                    Text(section.rawValue)
                }
            }
            .navigationTitle("TifloAcosta")
            .navigationDestination(for: Section.self) { section in
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
