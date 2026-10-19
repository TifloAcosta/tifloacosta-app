import SwiftUI
import AVFoundation

/// Reusable VoiceOver-adjustable controls for the library and the open document.
/// Opening Audio or Visual shows real settings, never an "open/closed" disclosure.
struct NativeReaderAudioControls: View {
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @State private var filterIndex = 0
    @State private var systemVoices: [AVSpeechSynthesisVoice] = []
    @State private var showVoiceHelp = false

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
                guard let index = voices.firstIndex(where: { $0.identifier == voiceID }) else {
                    return 0
                }
                return index + 1
            },
            set: { index in
                voiceID = index > 0 && voices.indices.contains(index - 1)
                    ? voices[index - 1].identifier : ""
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
            selectedIndex: $speedIndex
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
        Button("Buscar más voces") { showVoiceHelp = true }
            .accessibilityHint("Indica dónde descargar voces adicionales de iOS.")
        .onAppear(perform: refreshVoices)
        .alert("Buscar más voces", isPresented: $showVoiceHelp) {
            Button("Entendido", role: .cancel) {}
        } message: {
            Text("Abre Ajustes del iPhone, Accesibilidad, Contenido leído, Voces. Descarga las voces deseadas y vuelve al lector. Después entra de nuevo en Audio para actualizar la lista.")
        }
    }
}

struct NativeReaderVisualControls: View {
    @AppStorage("native-reading-text-size") private var textSize = 20.0
    @AppStorage("native-reading-line-spacing-index") private var spacing = 0
    @AppStorage("native-reading-strong-text") private var strongText = false

    var body: some View {
        NativeAdjustableChoice(
            title: "Tamaño de letra",
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
}

struct NativeReaderAudioSettingsScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Audio y voces del sistema") {
                    NativeReaderAudioControls()
                }
            }
            .tifloScreenSurface()
            .navigationTitle("Ajustes de audio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cerrar") { dismiss() } }
        }
    }
}

struct NativeReaderVisualSettingsScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Presentación del documento") {
                    NativeReaderVisualControls()
                }
            }
            .tifloScreenSurface()
            .navigationTitle("Ajustes visuales")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Cerrar") { dismiss() } }
        }
    }
}

struct NativeReaderSettingsScreen: View {
    @AppStorage("native-reader-navigation-unit") private var navigationUnit = 0

    var body: some View {
        List {
            Section("Audio y voz") {
                NativeReaderAudioControls()
            }
            Section("Presentación visual") {
                NativeReaderVisualControls()
            }
            Section("Navegación") {
                NativeAdjustableChoice(
                    title: "Unidad de avance",
                    choices: ["Bloque", "Párrafo", "Frase"],
                    selectedIndex: $navigationUnit
                )
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Ajustes de TifloLector")
        .navigationBarTitleDisplayMode(.inline)
    }
}
