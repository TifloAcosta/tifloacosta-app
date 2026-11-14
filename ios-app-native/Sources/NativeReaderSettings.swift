import SwiftUI
import AVFoundation


/// Pausas añadidas entre fragmentos del sintetizador del sistema, en segundos.
/// El perfil Normal conserva la puntuación natural propia de cada voz.
enum NativeReaderPauseProfile {
    struct Segment {
        let text: String
        let delay: TimeInterval
    }

    static func duration(for sign: Character, settings: UserDefaults = .standard) -> TimeInterval {
        let style = settings.integer(forKey: "native-reading-pause-style")
        guard style != 0 else { return 0 }
        let key: String
        switch sign {
        case ",": key = "comma"
        case ";": key = "semicolon"
        case ":": key = "colon"
        case ".", "!", "?": key = "sentence"
        case "\n": key = "paragraph"
        default: return 0
        }
        let major: [String: Double] = [
            "comma": 0.18, "semicolon": 0.28, "colon": 0.28,
            "sentence": 0.48, "paragraph": 0.65
        ]
        let expressive: [String: Double] = [
            "comma": 0.32, "semicolon": 0.48, "colon": 0.48,
            "sentence": 0.80, "paragraph": 1.10
        ]
        if style == 1 { return major[key] ?? 0 }
        if style == 2 { return expressive[key] ?? 0 }
        let storageKey = "native-reading-pause-" + key
        // @AppStorage defaults are not necessarily present in UserDefaults
        // before the user first opens the controls.
        let defaultValues: [String: Double] = [
            "comma": 0.15, "semicolon": 0.25, "colon": 0.25,
            "sentence": 0.40, "paragraph": 0.60
        ]
        let configured = settings.object(forKey: storageKey) == nil
            ? (defaultValues[key] ?? 0) : settings.double(forKey: storageKey)
        return min(1.5, max(0, configured))
    }

    static func segments(_ text: String, settings: UserDefaults = .standard) -> [Segment] {
        var parts: [Segment] = []
        var buffer = ""
        for character in text {
            buffer.append(character)
            let delay = duration(for: character, settings: settings)
            // Preserve sentence boundaries even in Normal mode, so a live
            // speed, pitch or voice change applies to the next sentence.
            if delay > 0 || ",;:.!?\n".contains(character) {
                parts.append(Segment(text: buffer, delay: delay))
                buffer = ""
            }
        }
        if !buffer.isEmpty { parts.append(Segment(text: buffer, delay: 0)) }
        if parts.isEmpty { parts.append(Segment(text: text, delay: 0)) }
        return parts
    }
}

/// Las versiones anteriores guardaban índices 0–4 para 0,75; 0,90; 1; 1,25; 1,50.
/// Los nuevos índices se guardan como 100 + posición para no reinterpretar libros existentes.
enum NativeReaderSpeedOptions {
    static let rates: [Double] = (15...30).map { Double($0) / 20.0 }
    static let choices: [String] = rates.map { rate in
        abs(rate - 1.0) < 0.001 ? "Normal, 1,00 veces" :
            String(format: "%.2f veces", rate).replacingOccurrences(of: ".", with: ",")
    }
    private static let legacyRates: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]
    static func rate(for stored: Int) -> Double {
        if stored >= 100 {
            return rates[max(0, min(rates.count - 1, stored - 100))]
        }
        return legacyRates[max(0, min(legacyRates.count - 1, stored))]
    }
    static func choiceIndex(for stored: Int) -> Int {
        if stored >= 100 { return max(0, min(rates.count - 1, stored - 100)) }
        let old = rate(for: stored)
        return rates.firstIndex(where: { abs($0 - old) < 0.001 }) ?? 5
    }
    static func storedIndex(for choice: Int) -> Int {
        100 + max(0, min(rates.count - 1, choice))
    }
}

/// Controles ajustables con VoiceOver, sin introducir números mediante teclado.
struct NativeReaderPunctuationControls: View {
    @AppStorage("native-reading-pause-style") private var style = 0
    @AppStorage("native-reading-pause-comma") private var comma = 0.15
    @AppStorage("native-reading-pause-semicolon") private var semicolon = 0.25
    @AppStorage("native-reading-pause-colon") private var colon = 0.25
    @AppStorage("native-reading-pause-sentence") private var sentence = 0.4
    @AppStorage("native-reading-pause-paragraph") private var paragraph = 0.6

    private let choices = (0...30).map {
        String(format: "%.2f segundos", Double($0) * 0.05)
    }

    private func selection(_ value: Binding<Double>) -> Binding<Int> {
        Binding(
            get: { max(0, min(30, Int((value.wrappedValue / 0.05).rounded()))) },
            set: { value.wrappedValue = Double($0) * 0.05 }
        )
    }

    var body: some View {
        NativeAdjustableChoice(
            title: "Pausas por puntuación",
            choices: ["Normal", "Mayor", "Expresiva", "Personalizadas"],
            selectedIndex: $style
        )
        if style == 3 {
            Text("Ajusta cada signo con deslizamientos arriba o abajo. Intervalos de 0 a 1,50 segundos, en pasos de 0,05.")
            NativeAdjustableChoice(title: "Pausa después de coma",
                                   choices: choices, selectedIndex: selection($comma))
            NativeAdjustableChoice(title: "Pausa después de punto y coma",
                                   choices: choices, selectedIndex: selection($semicolon))
            NativeAdjustableChoice(title: "Pausa después de dos puntos",
                                   choices: choices, selectedIndex: selection($colon))
            NativeAdjustableChoice(title: "Pausa después de punto, interrogación o exclamación",
                                   choices: choices, selectedIndex: selection($sentence))
            NativeAdjustableChoice(title: "Pausa después de salto de párrafo",
                                   choices: choices, selectedIndex: selection($paragraph))
        }
        Text("Las pausas se aplican a la lectura con voces del sistema. La duración natural depende de la voz. No modifican los audiolibros grabados ni garantizan los mismos tiempos en Gemini o Phonon.")
            .font(.footnote)
    }
}

/// Reusable VoiceOver-adjustable controls. A document can supply independent
/// bindings; the general settings keep using the existing AppStorage keys.
struct NativeReaderAudioControls: View {
    @AppStorage("native-reading-speed-index") private var generalSpeed = 2
    @AppStorage("native-reading-pitch-index") private var generalPitch = 2
    @AppStorage("native-reading-voice-id") private var generalVoiceID = ""
    @AppStorage("native-reader-reading-engine") private var readingEngine = 0
    @AppStorage("native-reader-gemini-voice") private var geminiVoice = "Kore"
    @AppStorage("native-reader-phonon-voice") private var phononVoice = ""
    let speedSelection: Binding<Int>?
    let readingEngineSelection: Binding<Int>?
    let geminiVoiceSelection: Binding<String>?
    let phononVoiceSelection: Binding<String>?
    let pitchSelection: Binding<Int>?
    let voiceSelection: Binding<String>?
    let allowVoiceDownloads: Bool
    @State private var filterIndex = 0
    @State private var systemVoices: [AVSpeechSynthesisVoice] = []
    @State private var showVoiceHelp = false
    @State private var personalVoiceStatus = AVSpeechSynthesizer.personalVoiceAuthorizationStatus

    init(speedSelection: Binding<Int>? = nil, pitchSelection: Binding<Int>? = nil,
         voiceSelection: Binding<String>? = nil,
         readingEngineSelection: Binding<Int>? = nil,
         geminiVoiceSelection: Binding<String>? = nil,
         phononVoiceSelection: Binding<String>? = nil,
         allowVoiceDownloads: Bool = true) {
        self.speedSelection = speedSelection
        self.pitchSelection = pitchSelection
        self.voiceSelection = voiceSelection
        self.readingEngineSelection = readingEngineSelection
        self.geminiVoiceSelection = geminiVoiceSelection
        self.phononVoiceSelection = phononVoiceSelection
        self.allowVoiceDownloads = allowVoiceDownloads
    }

    private var selectedVoiceID: String { voiceSelection?.wrappedValue ?? generalVoiceID }
    private var chosenEngine: Int { readingEngineSelection?.wrappedValue ?? readingEngine }
    private var chosenGeminiVoice: String { geminiVoiceSelection?.wrappedValue ?? geminiVoice }
    private var speedChoiceBinding: Binding<Int> {
        let storage = speedSelection ?? $generalSpeed
        return Binding(
            get: { NativeReaderSpeedOptions.choiceIndex(for: storage.wrappedValue) },
            set: { storage.wrappedValue = NativeReaderSpeedOptions.storedIndex(for: $0) }
        )
    }

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

    private func refreshVoices() {
        systemVoices = AVSpeechSynthesisVoice.speechVoices().sorted {
            if $0.language != $1.language { return $0.language < $1.language }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    var body: some View {
        NativeAdjustableChoice(
            title: readingEngineSelection == nil ? "Motor de lectura predeterminado" : "Motor de lectura de esta obra",
            choices: ["Voces del sistema", "Gemini", "Phonon"],
            selectedIndex: readingEngineSelection ?? $readingEngine
        )
        if chosenEngine == 1 {
            if NativeVoiceCredentialStore.hasKey("gemini") {
                NativeAdjustableChoice(
                    title: geminiVoiceSelection == nil ? "Voz Gemini predeterminada" : "Voz Gemini de esta obra",
                    choices: NativeGeminiSpeech.voices,
                    selectedIndex: Binding(
                        get: { NativeGeminiSpeech.voices.firstIndex(of: chosenGeminiVoice) ?? 0 },
                        set: { (geminiVoiceSelection ?? $geminiVoice).wrappedValue = NativeGeminiSpeech.voices[$0] }
                    )
                )
                Text("La voz seleccionada se utilizará según el ámbito de estos ajustes. La conexión de Gemini se configura en Motores externos.")
                    .font(.footnote)
            } else {
                Text("Gemini necesita una clave API guardada en Motores externos antes de reproducir.")
                    .font(.footnote)
            }
        } else if chosenEngine == 2 {
            Text("La disponibilidad de Phonon depende de tener instalado un motor compatible dentro de TifloLector.")
                .font(.footnote)
        }
        NativeAdjustableChoice(
            title: "Velocidad de voz",
            choices: NativeReaderSpeedOptions.choices,
            selectedIndex: speedChoiceBinding
        )
        NativeAdjustableChoice(
            title: "Tono de lectura",
            choices: ["Más grave", "Grave", "Normal", "Agudo", "Más agudo"],
            selectedIndex: pitchSelection ?? $generalPitch
        )
        NativeReaderPunctuationControls()
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
    @AppStorage("native-reader-reading-engine") private var defaultReadingEngine = 0
    @AppStorage("native-reader-gemini-voice") private var defaultGeminiVoice = "Kore"
    @AppStorage("native-reader-phonon-voice") private var defaultPhononVoice = ""

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
            readingEngineSelection: Binding(
                get: { library.latest(document).readerPreferences?.readingEngineIndex ?? defaultReadingEngine },
                set: { value in library.updatePreferences(document) { $0.readingEngineIndex = value } }
            ),
            geminiVoiceSelection: Binding(
                get: { library.latest(document).readerPreferences?.geminiVoiceID ?? defaultGeminiVoice },
                set: { value in library.updatePreferences(document) { $0.geminiVoiceID = value } }
            ),
            phononVoiceSelection: Binding(
                get: { library.latest(document).readerPreferences?.phononVoiceID ?? defaultPhononVoice },
                set: { value in library.updatePreferences(document) { $0.phononVoiceID = value } }
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
            NavigationLink("Creación rápida de marcas") { NativeQuickBookmarkHelpScreen() }
            NavigationLink("Motores externos") { NativeReaderExternalVoiceSettingsScreen() }
                .accessibilityHint("Configura las voces, la clave API de Gemini y Phonon.")
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
            NavigationLink("Lectura con línea braille") {
                List {
                    Section("Lectura continua") {
                        Text("TifloLector conserva los párrafos y la posición para navegar con VoiceOver y una línea braille. Puedes utilizar braille y voz al mismo tiempo.")
                        Text("Los controles de reproducción y ajustes aparecen antes del texto. Al leer manualmente no se inicia la voz ni se desplaza el foco por cuenta de TifloLector.")
                    }
                    Section("Preferencias de VoiceOver") {
                        Text("Para configurar tu línea: Ajustes del iPhone, Accesibilidad, VoiceOver, Braille.")
                        Text("Duración del avance automático: ajusta el ritmo de avance de la línea si tu dispositivo lo admite.")
                        Text("Cambio de página automático: permite continuar al desplazarte cuando la presentación lo admite.")
                        Text("Estas opciones pertenecen a VoiceOver; TifloLector no modifica sus valores.")
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Lectura con línea braille")
            }
            NavigationLink("Ajustes visuales") { NativeReaderVisualSettingsScreen() }
            NavigationLink("OCR y reconocimiento") { NativeReaderOCRSettingsScreen() }
            NavigationLink("Navegación y avances") {
                List {
                    Section("Desplazamiento") {
                        NativeAdjustableChoice(
                            title: "Unidad de avance",
                            choices: ["Bloque", "Párrafo", "Frase", "Página", "Encabezado"],
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
