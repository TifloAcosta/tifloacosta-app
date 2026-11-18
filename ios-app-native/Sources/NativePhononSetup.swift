import SwiftUI
import UIKit

/// This screen is safe on iOS 17: the iOS 18-only engine is never referenced
/// unless its optional module is actually part of the current build.
struct NativePhononSetupScreen: View {
    @StateObject private var preview = NativePhononPreview()
    @State private var installed = NativePhononModelStore.isInstalled
    @State private var installing = false
    @State private var status = ""
    @State private var voiceNames: [String] = []
    @State private var selectedVoice = ""
    @State private var confirmRemoval = false
    @State private var installTask: Task<Void, Never>?

    private func announce(_ message: String) {
        status = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func install() {
        guard NativePhononRuntime.isIncluded, !installing else { return }
        installing = true
        announce("Descargando e instalando el modelo Phonon en inglés. Puede tardar varios minutos.")
        installTask = Task {
            do {
                try await NativePhononModelStore.downloadAndInstall()
                try Task.checkCancellation()
                installed = NativePhononModelStore.isInstalled
                announce(installed ? "Modelo Phonon instalado correctamente." :
                    "La instalación ha terminado, pero el modelo no está disponible.")
                if installed { await loadVoices() }
            } catch is CancellationError {
                announce("Instalación cancelada.")
            } catch {
                announce("No se pudo instalar Phonon: \(error.localizedDescription)")
            }
            installing = false
            installTask = nil
        }
    }

    private func loadVoices() async {
        guard NativePhononRuntime.isUsable else { return }
        do {
            voiceNames = try await NativePhononRuntime.voices()
            if !voiceNames.contains(selectedVoice) { selectedVoice = voiceNames.first ?? "" }
        } catch {
            announce("No se pudieron cargar las voces Phonon: \(error.localizedDescription)")
        }
    }

    var body: some View {
        List {
            Section("Disponibilidad") {
                if #unavailable(iOS 18.0) {
                    Text("Phonon necesita iOS 18 o posterior. Puedes seguir leyendo con las voces del iPhone o con Gemini.")
                } else if !NativePhononRuntime.isIncluded {
                    Text("Este iPhone tiene una versión de iOS compatible, pero esta compilación todavía no incluye la biblioteca de Phonon. Las voces del iPhone y Gemini siguen disponibles.")
                } else if installed {
                    Text("Modelo Phonon instalado. Puedes utilizarlo sin introducir una clave API.")
                } else {
                    Text("Phonon está disponible para este dispositivo, pero necesitas instalar su modelo de voz.")
                }
                Text("Phonon funciona en el dispositivo y no necesita una cuenta ni una clave API.")
            }
            if NativePhononRuntime.isIncluded {
                Section("Modelo de voz") {
                    Text("Modelo oficial Phonon 31m: inglés. Otros idiomas necesitan modelos compatibles y condiciones de licencia propias.")
                    if !installed {
                        Button(installing ? "Instalando modelo Phonon" : "Instalar modelo Phonon en inglés") {
                            install()
                        }
                        .disabled(installing)
                    } else {
                        if !voiceNames.isEmpty {
                            Picker("Voz Phonon", selection: $selectedVoice) {
                                ForEach(voiceNames, id: \.self) { voice in
                                    Text(voice).tag(voice)
                                }
                            }
                        }
                        Button("Escuchar muestra Phonon") { preview.listen(voice: selectedVoice) }
                            .disabled(preview.busy)
                        if preview.playing {
                            Button("Detener muestra") { preview.stop() }
                        }
                        Button("Eliminar modelo Phonon", role: .destructive) {
                            confirmRemoval = true
                        }
                    }
                    if installing {
                        ProgressView("Instalando Phonon")
                        Button("Cancelar instalación", role: .cancel) {
                            installTask?.cancel()
                        }
                    }
                }
            }
            if !status.isEmpty {
                Section("Estado") { Text(status).accessibilityAddTraits(.updatesFrequently) }
            }
            if !preview.message.isEmpty {
                Section("Muestra de voz") {
                    Text(preview.message).accessibilityAddTraits(.updatesFrequently)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Phonon")
        .confirmationDialog("¿Eliminar el modelo Phonon?", isPresented: $confirmRemoval) {
            Button("Eliminar modelo Phonon", role: .destructive) {
                preview.stop()
                NativePhononRuntime.unload()
                do {
                    try NativePhononModelStore.remove()
                    installed = false
                    voiceNames = []
                    announce("Modelo Phonon eliminado.")
                } catch {
                    announce("No se pudo eliminar el modelo: \(error.localizedDescription)")
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .task { if installed { await loadVoices() } }
        .onDisappear { preview.stop() }
    }
}
