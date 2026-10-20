import SwiftUI
import AVFoundation

/// Reusable VoiceOver-adjustable controls. A document can supply independent
/// bindings; the general settings keep using the existing AppStorage keys.
struct NativeReaderAudioControls: View {
    @AppStorage("native-reading-speed-index") private var generalSpeed = 2
    @AppStorage("native-reading-voice-id") private var generalVoiceID = ""
    let speedSelection: Binding<Int>?
    let voiceSelection: Binding<String>?
    let allowVoiceDownloads: Bool
    @State private var filterIndex = 0
    @State private var systemVoices: [AVSpeechSynthesisVoice] = []
    @State private var showVoiceHelp = false

    init(speedSelection: Binding<Int>? = nil, voiceSelection: Binding<String>? = nil,
         allowVoiceDownloads: Bool = true) {
        self.speedSelection = speedSelection
        self.voiceSelection = voiceSelection
        self.allowVoiceDownloads = allowVoiceDownloads
    }

    private var selectedVoiceID: String { voiceSelection?.wrappedValue ?? generalVoiceID }

    private var voices: [AVSpeechSynthesisVoice] {
        switch filterIndex {
        case 1: return systemVoices.filter { $0.language.lowercased().hasPrefix("es") }
        case 2: return systemVoices.filter { $0.language.lowercased().hasPrefix("en") }
        default: return systemVoices
        }
    }

    private var voiceChoices: [String] {
        ["Predeterminada del sistema"] + voices.map { voice in
            let language = Locale(identifier: "es")
                .localizedString(forIdentifier: voice.language) ?? voice.language
            return "\(voice.name), \(language), \(voice.quality == .enhanced ? "mejorada" : "estándar")"
        }
    }

    private var selectedVoiceIndex: Binding<Int> {
        Binding(
            get: {
                guard let index = voices.firstIndex(where: { $0.identifier == selectedVoiceID }) else {
                    return 0
                }
                return index + 1
            },
            set: { index in
                let identifier = index > 0 && voices.indices.contains(index - 1)
                    ? voices[index - 1].identifier : ""
                if let voiceSelection { voiceSelection.wrappedValue = identifier }
                else { generalVoiceID = identifier }
            }
        )
    }

    private func refreshVoices() {
        systemVoices = AVSpeechSynthesisVoice.speechVoices().sorted {
            if $0.language != $1.language { return $0.language < $1.language }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    var body: some View {
        NativeAdjustableChoice(
            title: "Velocidad de voz",
            choices: ["0,75 veces", "0,9 veces", "Normal", "1,25 veces", "1,5 veces"],
            selectedIndex: speedSelection ?? $generalSpeed
        )
        NativeAdjustableChoice(
            title: "Mostrar voces",
            choices: ["Todos los idiomas", "Español", "Inglés"],
            selectedIndex: $filterIndex
        )
        NativeAdjustableChoice(
            title: "Voz del sistema",
            choices: voiceChoices,
            selectedIndex: selectedVoiceIndex
        )
        .onAppear(perform: refreshVoices)
        if allowVoiceDownloads {
            Button("Buscar más voces") { showVoiceHelp = true }
                .accessibilityHint("Indica dónde descargar voces adicionales de iOS.")
                .alert("Buscar más voces", isPresented: $showVoiceHelp) {
                    Button("Entendido", role: .cancel) {}
                } message: {
                    Text("Abre Ajustes del iPhone, Accesibilidad, Contenido leído, Voces. Descarga las voces deseadas y vuelve al lector. Después entra de nuevo en Audio para actualizar la lista.")
                }
        }
        // Voice list is refreshed when this control group appears.
    }
}


struct NativeReaderVisualControls: View {
    @AppStorage("native-reading-text-size") private var generalTextSize = 20.0
    @AppStorage("native-reading-line-spacing-index") private var generalSpacing = 0
    @AppStorage("native-reading-strong-text") private var generalStrongText = false

    let textSizeSelection: Binding<Double>?
    let spacingSelection: Binding<Int>?
    let strongTextSelection: Binding<Bool>?

    init(textSizeSelection: Binding<Double>? = nil, spacingSelection: Binding<Int>? = nil,
         strongTextSelection: Binding<Bool>? = nil) {
        self.textSizeSelection = textSizeSelection
        self.spacingSelection = spacingSelection
        self.strongTextSelection = strongTextSelection
    }

    private var textSizeBinding: Binding<Double> { textSizeSelection ?? $generalTextSize }
    private var strongTextBinding: Binding<Bool> { strongTextSelection ?? $generalStrongText }

    var body: some View {
        NativeAdjustableChoice(
            title: "Tamaño de letra",
            choices: stride(from: 14, through: 40, by: 2).map { "\($0) puntos" },
            selectedIndex: Binding(
                get: { max(0, min(13, Int((textSizeBinding.wrappedValue - 14) / 2))) },
                set: { textSizeBinding.wrappedValue = Double(14 + $0 * 2) }
            )
        )
        NativeAdjustableChoice(
            title: "Espacio entre líneas",
            choices: ["Normal", "Cómodo", "Amplio"],
            selectedIndex: spacingSelection ?? $generalSpacing
        )
        NativeAdjustableChoice(
            title: "Texto reforzado",
            choices: ["Desactivado", "Activado"],
            selectedIndex: Binding(
                get: { strongTextBinding.wrappedValue ? 1 : 0 },
                set: { strongTextBinding.wrappedValue = $0 == 1 }
            )
        )
    }
}

struct NativeReaderAudioSettingsScreen: View {
    var body: some View {
        List {
            Section("Audio y voces del sistema") { NativeReaderAudioControls() }
        }
        .tifloScreenSurface()
        .navigationTitle("Audio y voces")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct NativeReaderVisualSettingsScreen: View {
    var body: some View {
        List {
            Section("Presentación del documento") { NativeReaderVisualControls() }
        }
        .tifloScreenSurface()
        .navigationTitle("Ajustes visuales")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Only real, supported decoders are described as available.
struct NativeReaderSupportedFormatsScreen: View {
    var body: some View {
        List {
            ForEach(NativeReaderFormats.supportedFormatGroups) { group in
                Section(group.title) { Text(group.details) }
            }
            Section("Formatos antiguos") {
                Text("PPS, PPT y XLS todavía necesitan recuperar su conversión a texto accesible. Para las presentaciones y hojas modernas se admiten PPTX y XLSX.")
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Formatos de lectura")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct NativeReaderDocumentAudioControls: View {
    let document: NativeReadingDocument
    @EnvironmentObject private var library: NativeReaderLibrary
    @AppStorage("native-reading-speed-index") private var defaultSpeed = 2
    @AppStorage("native-reading-voice-id") private var defaultVoiceID = ""

    var body: some View {
        NativeReaderAudioControls(
            speedSelection: Binding(
                get: { library.latest(document).readerPreferences?.speedIndex ?? defaultSpeed },
                set: { value in library.updatePreferences(document) { $0.speedIndex = value } }
            ),
            voiceSelection: Binding(
                get: { library.latest(document).readerPreferences?.voiceID ?? defaultVoiceID },
                set: { value in library.updatePreferences(document) { $0.voiceID = value } }
            ),
            allowVoiceDownloads: false
        )
    }
}

struct NativeReaderDocumentVisualControls: View {
    let document: NativeReadingDocument
    @EnvironmentObject private var library: NativeReaderLibrary
    @AppStorage("native-reading-text-size") private var defaultTextSize = 20.0
    @AppStorage("native-reading-line-spacing-index") private var defaultSpacing = 0
    @AppStorage("native-reading-strong-text") private var defaultStrongText = false

    var body: some View {
        NativeReaderVisualControls(
            textSizeSelection: Binding(
                get: { library.latest(document).readerPreferences?.textSize ?? defaultTextSize },
                set: { value in library.updatePreferences(document) { $0.textSize = value } }
            ),
            spacingSelection: Binding(
                get: { library.latest(document).readerPreferences?.lineSpacingIndex ?? defaultSpacing },
                set: { value in library.updatePreferences(document) { $0.lineSpacingIndex = value } }
            ),
            strongTextSelection: Binding(
                get: { library.latest(document).readerPreferences?.strongText ?? defaultStrongText },
                set: { value in library.updatePreferences(document) { $0.strongText = value } }
            )
        )
    }
}

struct NativeReaderDocumentAudioSettingsScreen: View {
    let document: NativeReadingDocument
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List { Section("Audio de esta obra") {
                NativeReaderDocumentAudioControls(document: document)
            }}
            .tifloScreenSurface()
            .navigationTitle("Audio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cerrar") { dismiss() } }
        }
    }
}

struct NativeReaderDocumentVisualSettingsScreen: View {
    let document: NativeReadingDocument
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List { Section("Presentación de esta obra") {
                NativeReaderDocumentVisualControls(document: document)
            }}
            .tifloScreenSurface()
            .navigationTitle("Visual")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cerrar") { dismiss() } }
        }
    }
}

struct NativeReaderDocumentSettingsScreen: View {
    let document: NativeReadingDocument
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Audio y voz") {
                    List { Section("Audio de esta obra") {
                        NativeReaderDocumentAudioControls(document: document)
                    }}.tifloScreenSurface().navigationTitle("Audio")
                }
                NavigationLink("Ajustes visuales") {
                    List { Section("Presentación de esta obra") {
                        NativeReaderDocumentVisualControls(document: document)
                    }}.tifloScreenSurface().navigationTitle("Visual")
                }
                Text("Estos ajustes se guardan para esta obra. Las demás seguirán los ajustes generales.")
                    .font(.footnote)
            }
            .tifloScreenSurface()
            .navigationTitle("Ajustes del documento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cerrar") { dismiss() } }
        }
    }
}

struct NativeReaderSettingsScreen: View {
    @AppStorage("native-reader-navigation-unit") private var navigationUnit = 0
    @AppStorage("native-reader-reading-mode") private var readingMode = 0

    var body: some View {
        List {
            NavigationLink("Audio y voces") { NativeReaderAudioSettingsScreen() }
            NavigationLink("Modo de lectura") {
                List {
                    Section("Al abrir un documento") {
                        NativeAdjustableChoice(
                            title: "Modo de lectura",
                            choices: ["Manual, reproducir cuando lo indique",
                                      "Automático, reproducir al abrir"],
                            selectedIndex: $readingMode
                        )
                        Text("La elección se conserva hasta que la cambies. El modo manual permite leer el documento visualmente sin iniciar la voz.")
                            .font(.footnote)
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Modo de lectura")
            }
            NavigationLink("Ajustes visuales") { NativeReaderVisualSettingsScreen() }
            NavigationLink("Navegación y avances") {
                List {
                    Section("Desplazamiento") {
                        NativeAdjustableChoice(
                            title: "Unidad de avance",
                            choices: ["Bloque", "Párrafo", "Frase"],
                            selectedIndex: $navigationUnit
                        )
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Navegación y avances")
            }
            NavigationLink("Formatos de lectura") { NativeReaderSupportedFormatsScreen() }
        }
        .tifloScreenSurface()
        .navigationTitle("Ajustes de TifloLector")
        .navigationBarTitleDisplayMode(.inline)
    }
}
