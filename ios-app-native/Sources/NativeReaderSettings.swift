import SwiftUI
import AVFoundation

/// Reusable VoiceOver-adjustable controls. A document can supply independent
/// bindings; the general settings keep using the existing AppStorage keys.
struct NativeReaderAudioControls: View {
    @AppStorage("native-reading-speed-index") private var generalSpeed = 2
    @AppStorage("native-reading-pitch-index") private var generalPitch = 2
    @AppStorage("native-reading-voice-id") private var generalVoiceID = ""
    @AppStorage("native-reader-reading-style") private var generalReadingStyle = 0
    let speedSelection: Binding<Int>?
    let pitchSelection: Binding<Int>?
    let voiceSelection: Binding<String>?
    let readingStyleSelection: Binding<Int>?
    let allowVoiceDownloads: Bool
    @State private var filterIndex = 0
    @State private var systemVoices: [AVSpeechSynthesisVoice] = []
    @State private var showVoiceHelp = false
    @State private var showVoicePicker = false
    @State private var previewSynthesizer = AVSpeechSynthesizer()
    @State private var personalVoiceStatus = AVSpeechSynthesizer.personalVoiceAuthorizationStatus

    init(speedSelection: Binding<Int>? = nil, pitchSelection: Binding<Int>? = nil,
         voiceSelection: Binding<String>? = nil,
         readingStyleSelection: Binding<Int>? = nil,
         allowVoiceDownloads: Bool = true) {
        self.speedSelection = speedSelection
        self.pitchSelection = pitchSelection
        self.voiceSelection = voiceSelection
        self.readingStyleSelection = readingStyleSelection
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
            let quality = voice.voiceTraits.contains(.isPersonalVoice) ? "Voz personal" :
                (voice.quality == .enhanced ? "mejorada" : "estándar")
            return "\(voice.name), \(language), \(quality)"
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

    private func selectVoice(_ identifier: String) {
        previewSynthesizer.stopSpeaking(at: .immediate)
        if let voiceSelection { voiceSelection.wrappedValue = identifier }
        else { generalVoiceID = identifier }
        showVoicePicker = false
    }

    private func preview(_ voice: AVSpeechSynthesisVoice?) {
        previewSynthesizer.stopSpeaking(at: .immediate)
        let spanish = voice?.language.lowercased().hasPrefix("es") ?? true
        let sample = spanish ? "Esta es una muestra de voz para leer tus documentos."
                             : "This is a sample voice for reading your documents."
        let utterance = AVSpeechUtterance(string: sample)
        utterance.voice = voice ?? AVSpeechSynthesisVoice(language: "es-ES")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        previewSynthesizer.speak(utterance)
    }

    private func refreshVoices() {
        systemVoices = AVSpeechSynthesisVoice.speechVoices().sorted {
            if $0.language != $1.language { return $0.language < $1.language }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    var body: some View {
        NativeAdjustableChoice(
            title: "Estilo de lectura",
            choices: ["Normal", "Mayor", "Expresiva"],
            selectedIndex: readingStyleSelection ?? $generalReadingStyle
        )
        .accessibilityHint("Normal utiliza la puntuación habitual. Mayor refuerza pausas en comas, puntos y párrafos. Expresiva distingue diálogos, preguntas, exclamaciones y secciones en las voces del sistema.")
        NativeAdjustableChoice(
            title: "Velocidad de voz",
            choices: ["0,75 veces", "0,9 veces", "Normal", "1,25 veces", "1,5 veces"],
            selectedIndex: speedSelection ?? $generalSpeed
        )
        NativeAdjustableChoice(
            title: "Tono de lectura",
            choices: ["Más grave", "Grave", "Normal", "Agudo", "Más agudo"],
            selectedIndex: pitchSelection ?? $generalPitch
        )
        NativeAdjustableChoice(
            title: "Mostrar voces",
            choices: ["Todos los idiomas", "Español", "Inglés"],
            selectedIndex: $filterIndex
        )
        Button("Voz") { showVoicePicker = true }
        .accessibilityValue(
            systemVoices.first(where: { $0.identifier == selectedVoiceID })?.name ?? "Predeterminada"
        )
        .sheet(isPresented: $showVoicePicker) {
            NavigationStack {
                List {
                    Section("Voces") {
                        HStack {
                            Button("Predeterminada") { selectVoice("") }
                            Spacer()
                            Button("Escuchar") { preview(nil) }
                        }
                        ForEach(voices, id: \.identifier) { voice in
                            HStack {
                                Button {
                                    selectVoice(voice.identifier)
                                } label: {
                                    Text(voiceChoices.first(where: { $0.hasPrefix(voice.name + ",") })
                                         ?? voice.name)
                                }
                                Spacer()
                                Button("Escuchar") { preview(voice) }
                                    .accessibilityLabel("Escuchar \(voice.name)")
                            }
                        }
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Voz")
                .toolbar { Button("Cerrar") { showVoicePicker = false } }
                .onDisappear { previewSynthesizer.stopSpeaking(at: .immediate) }
            }
        }
        .onAppear {
            personalVoiceStatus = AVSpeechSynthesizer.personalVoiceAuthorizationStatus
            refreshVoices()
        }
        .onReceive(NotificationCenter.default.publisher(for: AVSpeechSynthesizer.availableVoicesDidChangeNotification)) { _ in
            refreshVoices()
        }
        if allowVoiceDownloads {
            if personalVoiceStatus == .notDetermined {
                Button("Permitir mi Voz personal") {
                    Task {
                        personalVoiceStatus = await AVSpeechSynthesizer.requestPersonalVoiceAuthorization()
                        refreshVoices()
                    }
                }
                .accessibilityHint("Solicita permiso al sistema para utilizar una Voz personal ya creada.")
            } else if personalVoiceStatus == .denied {
                Text("Voz personal no autorizada. El permiso puede cambiarse en Ajustes del iPhone.")
            } else if personalVoiceStatus == .unsupported {
                Text("Este dispositivo no admite el uso de Voz personal en TifloLector.")
            }
            Text("El tono modifica la voz sintetizada, no los audiolibros grabados.").font(.footnote)
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
    @AppStorage("native-reading-pitch-index") private var defaultPitch = 2
    @AppStorage("native-reading-voice-id") private var defaultVoiceID = ""
    @AppStorage("native-reader-reading-style") private var defaultReadingStyle = 0

    var body: some View {
        NativeReaderAudioControls(
            speedSelection: Binding(
                get: { library.latest(document).readerPreferences?.speedIndex ?? defaultSpeed },
                set: { value in library.updatePreferences(document) { $0.speedIndex = value } }
            ),
            pitchSelection: Binding(
                get: { library.latest(document).readerPreferences?.pitchIndex ?? defaultPitch },
                set: { value in library.updatePreferences(document) { $0.pitchIndex = value } }
            ),
            voiceSelection: Binding(
                get: { library.latest(document).readerPreferences?.voiceID ?? defaultVoiceID },
                set: { value in library.updatePreferences(document) { $0.voiceID = value } }
            ),
            readingStyleSelection: Binding(
                get: { library.latest(document).readerPreferences?.readingStyle ?? defaultReadingStyle },
                set: { value in library.updatePreferences(document) { $0.readingStyle = value } }
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
    @EnvironmentObject private var library: NativeReaderLibrary
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
                Button("Usar ajustes generales en esta obra") {
                    library.resetPreferences(document)
                }
                .accessibilityHint("Borra solamente las preferencias de audio y visuales de esta obra; conserva su contenido, posición y marcas.")
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
            NavigationLink("Motores externos") { NativeReaderExternalVoiceSettingsScreen() }
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
            NavigationLink("OCR y reconocimiento") { NativeReaderOCRSettingsScreen() }
            NavigationLink("Navegación y avances") {
                List {
                    Section("Desplazamiento") {
                        NativeAdjustableChoice(
                            title: "Unidad de avance",
                            choices: ["Bloque", "Párrafo", "Frase", "Página", "Encabezado",
                                       "Marcas", "Tiempo, un minuto (real en audio, estimado en TTS)"],
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
