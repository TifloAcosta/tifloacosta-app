import SwiftUI
import AVFoundation
import UniformTypeIdentifiers
import FluidAudio

/// Isolated Spanish-language preview. Until real-device testing, this engine
/// never replaces the user's selected reader voice or generates a full book.
@MainActor
private final class NativePocketTtsTrial: ObservableObject {
    @Published var busy = false
    @Published var message = "La primera prueba descarga el modelo español. Puede tardar y ocupar espacio."
    @Published var playing = false

    private var manager: PocketTtsManager?
    private var audioPlayer: AVAudioPlayer?
    private var clonedVoiceFile: URL?

    func listen(_ text: String) {
        guard !busy else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            message = "Escribe un texto en español para escucharlo."
            return
        }
        busy = true
        message = "Preparando la voz española…"
        Task {
            do {
                let tts = try await preparedManager()
                let audio: Data
                if let voiceFile = clonedVoiceFile {
                    let voice = try await tts.loadClonedVoice(from: voiceFile)
                    audio = try await tts.synthesize(text: trimmed, voiceData: voice)
                } else {
                    audio = try await tts.synthesize(text: trimmed, voice: "lola")
                }
                stop()
                audioPlayer = try AVAudioPlayer(data: audio)
                audioPlayer?.prepareToPlay()
                playing = audioPlayer?.play() ?? false
                message = playing ? "Reproduciendo muestra en español." : "No se pudo iniciar la reproducción."
            } catch {
                message = "La prueba de voz no se pudo completar: \(error.localizedDescription)"
            }
            busy = false
        }
    }

    func importClonedVoice(from externalURL: URL) {
        guard !busy else { return }
        busy = true
        message = "Preparando la voz personal…"
        Task {
            do {
                let access = externalURL.startAccessingSecurityScopedResource()
                defer { if access { externalURL.stopAccessingSecurityScopedResource() } }
                let local = FileManager.default.temporaryDirectory
                    .appendingPathComponent("pocket-voice-\(UUID().uuidString)")
                    .appendingPathExtension(externalURL.pathExtension)
                try FileManager.default.copyItem(at: externalURL, to: local)
                defer { try? FileManager.default.removeItem(at: local) }
                let tts = try await preparedManager()
                let voice = try await tts.cloneVoice(from: local)
                let saved = FileManager.default.temporaryDirectory
                    .appendingPathComponent("pocket-voice-\(UUID().uuidString).bin")
                try await tts.saveClonedVoice(voice, to: saved)
                if let previous = clonedVoiceFile { try? FileManager.default.removeItem(at: previous) }
                clonedVoiceFile = saved
                message = "Voz personal preparada para esta sesión. Pulsa Escuchar muestra."
            } catch {
                message = "No se pudo preparar la voz personal: \(error.localizedDescription)"
            }
            busy = false
        }
    }

    private func preparedManager() async throws -> PocketTtsManager {
        if let manager { return manager }
        let created = PocketTtsManager(language: .spanish)
        try await created.initialize()
        manager = created
        return created
    }

    func stop() {
        audioPlayer?.stop()
        audioPlayer = nil
        playing = false
    }

    func cleanUp() {
        stop()
        if let file = clonedVoiceFile { try? FileManager.default.removeItem(at: file) }
        clonedVoiceFile = nil
    }
}

struct NativePocketTtsTrialScreen: View {
    @StateObject private var trial = NativePocketTtsTrial()
    @State private var sampleText = "Hola, soy Lola. Esta es una prueba de Pocket TTS en español con TifloLector."
    @State private var consentToClone = false
    @State private var showVoiceImporter = false

    var body: some View {
        Form {
            Section("Prueba de Pocket TTS") {
                Text("Motor experimental local en español. La voz inicial es Lola. No modifica la voz predeterminada de tus libros.")
                TextEditor(text: $sampleText)
                    .frame(minHeight: 100)
                    .accessibilityLabel("Texto de la muestra en español")
                Button("Escuchar muestra") { trial.listen(sampleText) }
                    .disabled(trial.busy || sampleText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if trial.playing {
                    Button("Detener muestra") { trial.stop() }
                }
            }
            Section("Probar mi propia voz") {
                Text("Solo importa una grabación de tu propia voz o de alguien que te haya dado permiso expreso. Se procesa en el iPhone y la muestra se descarta al salir de esta pantalla.")
                Toggle("Tengo permiso para utilizar esta voz", isOn: $consentToClone)
                Button("Importar grabación para crear mi voz") { showVoiceImporter = true }
                    .disabled(trial.busy || !consentToClone)
                Text("Prueba con una grabación de entre 1 y 20 segundos, con una sola voz y sin música.")
            }
            Section("Estado") {
                Text(trial.message)
                    .accessibilityAddTraits(.updatesFrequently)
                if trial.busy { ProgressView("Generando voz…") }
            }
        }
        .navigationTitle("Pocket TTS en español")
        .fileImporter(isPresented: $showVoiceImporter, allowedContentTypes: [.audio]) { result in
            if case .success(let url) = result { trial.importClonedVoice(from: url) }
        }
        .onDisappear { trial.cleanUp() }
    }
}
