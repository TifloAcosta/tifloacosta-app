import SwiftUI
import AVFoundation

/// The library has just one Ajustes entry. Individual choices are adjustable
/// via VoiceOver swipe up/down; there are no open/closed disclosure toggles.
struct NativeReaderSettingsScreen: View {
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @AppStorage("native-reading-text-size") private var textSize = 20.0
    @AppStorage("native-reading-line-spacing-index") private var spacing = 0
    @AppStorage("native-reading-strong-text") private var strongText = false
    @AppStorage("native-reader-navigation-unit") private var navigationUnit = 0
    @AppStorage("native-reader-sleep-index") private var sleepIndex = 0
    @State private var filterIndex = 0
    @State private var showVoiceHelp = false

    private var voices: [AVSpeechSynthesisVoice] {
        let all = AVSpeechSynthesisVoice.speechVoices().sorted {
            if $0.language != $1.language { return $0.language < $1.language }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
        switch filterIndex {
        case 1: return all.filter { $0.language.hasPrefix("es") }
        case 2: return all.filter { $0.language.hasPrefix("en") }
        default: return all
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
                guard let index = voices.firstIndex(where: { $0.identifier == voiceID }) else { return 0 }
                return index + 1
            },
            set: { value in
                voiceID = value == 0 || !voices.indices.contains(value - 1)
                    ? "" : voices[value - 1].identifier
            }
        )
    }

    var body: some View {
        List {
            Section("Audio y voz") {
                NativeAdjustableChoice(
                    title: "Velocidad de lectura",
                    choices: ["0,75 veces", "0,9 veces", "Normal", "1,25 veces", "1,5 veces"],
                    selectedIndex: $speedIndex
                )
                NativeAdjustableChoice(
                    title: "Mostrar voces",
                    choices: ["Todos los idiomas", "Español", "Inglés"],
                    selectedIndex: $filterIndex
                )
                .onChange(of: filterIndex) { _, _ in
                    if !voices.contains(where: { $0.identifier == voiceID }) { voiceID = "" }
                }
                NativeAdjustableChoice(
                    title: "Voz",
                    choices: voiceChoices,
                    selectedIndex: selectedVoiceIndex
                )
                Button("Buscar más voces") { showVoiceHelp = true }
                    .accessibilityHint("Muestra dónde descargar las voces adicionales de iOS.")
            }
            Section("Presentación visual") {
                NativeAdjustableChoice(
                    title: "Tamaño del texto",
                    choices: stride(from: 14, through: 40, by: 2).map { "\($0) puntos" },
                    selectedIndex: Binding(
                        get: { max(0, min(13, Int((textSize - 14) / 2))) },
                        set: { textSize = Double(14 + $0 * 2) }
                    )
                )
                NativeAdjustableChoice(
                    title: "Espacio entre líneas",
                    choices: ["Normal", "Cómodo", "Amplio"],
                    selectedIndex: $spacing
                )
                NativeAdjustableChoice(
                    title: "Texto reforzado",
                    choices: ["Desactivado", "Activado"],
                    selectedIndex: Binding(
                        get: { strongText ? 1 : 0 },
                        set: { strongText = $0 == 1 }
                    )
                )
            }
            Section("Lectura y reproducción") {
                NativeAdjustableChoice(
                    title: "Unidad de avance",
                    choices: ["Bloque", "Párrafo", "Frase"],
                    selectedIndex: $navigationUnit
                )
                NativeAdjustableChoice(
                    title: "Apagado automático",
                    choices: ["Desactivado", "5 minutos", "10 minutos", "15 minutos",
                              "30 minutos", "45 minutos", "60 minutos"],
                    selectedIndex: $sleepIndex
                )
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Ajustes de TifloLector")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Buscar más voces", isPresented: $showVoiceHelp) {
            Button("Entendido", role: .cancel) {}
        } message: {
            Text("Para instalar más voces abre Ajustes del iPhone, entra en Accesibilidad, Contenido leído, Voces. Descarga la voz deseada y vuelve a TifloLector. iOS no proporciona un enlace público fiable que abra directamente ese catálogo.")
        }
    }
}
