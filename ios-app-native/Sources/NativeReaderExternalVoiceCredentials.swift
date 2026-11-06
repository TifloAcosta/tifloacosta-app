import SwiftUI
import Security
import UniformTypeIdentifiers

/// API credentials are device-local and never included in exported reader libraries.
/// Each provider gets its own Keychain item, accessible only when the device is unlocked.
enum NativeVoiceCredentialStore {
    private static let service = "com.tifloacosta.reader.external-voices"

    static func hasKey(_ provider: String) -> Bool {
        guard let key = try? get(provider) else { return false }
        return !key.isEmpty
    }

    static func get(_ provider: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            throw CredentialError.storage
        }
        return value
    }

    static func save(_ key: String, provider: String) throws {
        let value = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, let data = value.data(using: .utf8) else {
            throw CredentialError.empty
        }
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider
        ]
        let updates: [String: Any] = [kSecValueData as String: data,
                                       kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let status = SecItemUpdate(base as CFDictionary, updates as CFDictionary)
        if status == errSecItemNotFound {
            var newItem = base
            updates.forEach { newItem[$0.key] = $0.value }
            guard SecItemAdd(newItem as CFDictionary, nil) == errSecSuccess else {
                throw CredentialError.storage
            }
        } else if status != errSecSuccess {
            throw CredentialError.storage
        }
    }

    static func delete(_ provider: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider
        ]
        let result = SecItemDelete(query as CFDictionary)
        guard result == errSecSuccess || result == errSecItemNotFound else {
            throw CredentialError.storage
        }
    }

    enum CredentialError: LocalizedError {
        case empty, storage
        var errorDescription: String? {
            switch self {
            case .empty: return "Pega una clave antes de guardar."
            case .storage: return "No se pudo acceder al almacén seguro."
            }
        }
    }
}

/// The overview exposes exactly one accessible navigation element per motor.
struct NativeReaderExternalVoiceSettingsScreen: View {
    var body: some View {
        List {
            NavigationLink("Phonon") {
                NativeReaderExternalVoiceDetailScreen(provider: .phonon)
            }
            NavigationLink("Gemini") {
                NativeReaderExternalVoiceDetailScreen(provider: .gemini)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Motores externos")
    }
}

/// Settings, previews, download controls and credential management only load
/// after explicitly opening the selected motor.
struct NativeReaderExternalVoiceDetailScreen: View {
    enum Provider {
        case phonon
        case gemini
    }
    let provider: Provider

    @State private var keyInput = ""
    @State private var hasGeminiKey = NativeVoiceCredentialStore.hasKey("gemini")
    @State private var message = ""
    @State private var confirmDeletion = false
    @State private var checking = false
    @State private var phononInstalled = NativePhononModelStore.isInstalled
    @State private var phononBusy = false
    @State private var phononMessage = ""
    @State private var phononTask: Task<Void, Never>?
    @State private var showPhononRemoval = false
    @StateObject private var phononPreview = NativePhononPreview()
    @AppStorage("native-reader-phonon-voice") private var phononVoice = ""
    @State private var phononVoices: [String] = []
    @State private var phononLoadingVoices = false
    @State private var showPhononImporter = false
    @State private var phononLicenseAcknowledged = false
    @AppStorage("native-reader-phonon-language") private var phononLanguage = "en"
    @StateObject private var geminiPreview = NativeGeminiPreview()
    @AppStorage("native-reader-gemini-voice") private var geminiVoice = "Kore"

    private func loadPhononVoices() async {
        guard NativePhononRuntime.isUsable else { return }
        phononLoadingVoices = true
        defer { phononLoadingVoices = false }
        do {
            let options = try await NativePhononRuntime.voices()
            phononVoices = options
            if !options.contains(phononVoice), let first = options.first {
                phononVoice = first
            }
        } catch {
            phononMessage = error.localizedDescription
        }
    }

    private func checkGeminiConnection() async {
        guard !checking else { return }
        checking = true
        defer { checking = false }
        do {
            guard let key = try NativeVoiceCredentialStore.get("gemini") else {
                message = "No hay ninguna clave guardada."
                return
            }
            var request = URLRequest(url: URL(string:
                "https://generativelanguage.googleapis.com/v1beta/models")!)
            request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
            request.timeoutInterval = 15
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                message = "No se recibió respuesta del proveedor."
                return
            }
            switch http.statusCode {
            case 200..<300:
                message = "Conexión correcta. Puedes utilizar Gemini para leer documentos y exportar audio."
            case 401, 403:
                message = "Clave rechazada o sin permisos. Revisa Google AI Studio."
            case 429:
                message = "Límite de solicitudes alcanzado. Revisa tu cuota."
            default:
                message = "Google respondió con error \(http.statusCode)."
            }
        } catch {
            message = "No se pudo comprobar la conexión. Revisa Internet e inténtalo de nuevo."
        }
    }

    var body: some View {
        List {
            if provider == .phonon {
                Section("Phonon") {
                Text("Voces locales. No necesitan clave API.")
                Text("La aplicación Phonon para VoiceOver no supone automáticamente compatibilidad con el reproductor de TifloLector.")
                Link("Phonon para iPhone", destination: URL(string: "https://apps.apple.com/app/id6828988617")!)
                Link("Motor Phonon", destination: URL(string: "https://gradium.ai/phonon")!)
                Link("Modelos Phonon", destination: URL(string: "https://huggingface.co/gradium")!)
                Text("El modelo Core ML debe estar exportado para iPhone y contener bundle.json. Un checkpoint Android o un ZIP de voz aislada no sirve para iOS.")
                if #available(iOS 18, *) {
                    Text(phononInstalled ? "Modelo inglés instalado" : "Modelo inglés sin instalar")
                    Button("Descargar modelo Phonon inglés") {
                        guard !phononBusy else { return }
                        phononBusy = true
                        phononMessage = "Descargando y comprobando el modelo de voz."
                        phononTask = Task {
                            do {
                                try await NativePhononModelStore.downloadAndInstall()
                                guard !Task.isCancelled else { return }
                                phononInstalled = NativePhononModelStore.isInstalled
                                phononMessage = "Modelo inglés instalado correctamente."
                                await loadPhononVoices()
                            } catch is CancellationError {
                                phononMessage = "Descarga cancelada."
                            } catch {
                                phononMessage = error.localizedDescription
                            }
                            phononBusy = false
                        }
                    }
                    .disabled(phononBusy)
                    if phononBusy {
                        Button("Cancelar descarga") {
                            phononTask?.cancel()
                            phononBusy = false
                        }
                    }
                    if phononInstalled {
                        Button("Eliminar modelo", role: .destructive) {
                            showPhononRemoval = true
                        }
                    }
                    if !phononMessage.isEmpty {
                        Text(phononMessage)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                    Text("Phonon 31m es gratuito, funciona sin Internet después de instalarse y habla inglés. La biblioteca nativa debe estar incluida en la compilación.")
                    Toggle("Respeto las licencias del modelo y sus voces", isOn: $phononLicenseAcknowledged)
                    Button("Importar modelo Core ML ZIP") {
                        showPhononImporter = true
                    }
                    .disabled(!phononLicenseAcknowledged || phononBusy)
                    Picker("Idioma Phonon", selection: $phononLanguage) {
                        Text("English").tag("en")
                        Text("Español").tag("es")
                        Text("Français").tag("fr")
                        Text("Deutsch").tag("de")
                        Text("Português").tag("pt")
                    }
                    .onChange(of: phononLanguage) { _, _ in
                        NativePhononRuntime.unload()
                        phononVoices = []
                        if NativePhononRuntime.isUsable {
                            Task { await loadPhononVoices() }
                        }
                    }
                    Text("Para otros idiomas, importa un modelo Core ML compatible y comprueba sus condiciones de uso. Los modelos Phonon 40m y multilingües tienen licencia CC BY-NC.")

                    if NativePhononRuntime.isUsable {
                        if !phononVoices.isEmpty {
                            Picker("Voz Phonon", selection: $phononVoice) {
                                ForEach(phononVoices, id: \.self) { name in
                                    Text(name).tag(name)
                                }
                            }
                            Button("Escuchar Phonon") { phononPreview.listen(voice: phononVoice) }
                                .disabled(phononPreview.busy)
                            if phononPreview.busy || phononPreview.playing {
                                Button("Detener muestra") { phononPreview.stop() }
                            }
                        } else if phononLoadingVoices {
                            Text("Cargando voces Phonon.")
                        }
                        if !phononPreview.message.isEmpty {
                            Text(phononPreview.message)
                                .accessibilityAddTraits(.updatesFrequently)
                        }
                    }
                } else {
                    Text("Phonon nativo requiere iOS 18 o posterior.")
                }
            }
            }
            if provider == .gemini {
                Section("Gemini") {
                Text(hasGeminiKey ? "Clave guardada" : "Sin clave")
                    .accessibilityAddTraits(.updatesFrequently)
                Link("Crear clave", destination: URL(string: "https://aistudio.google.com/api-keys")!)
                SecureField("Pegar clave", text: $keyInput)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .privacySensitive()
                Button("Guardar") {
                    do {
                        try NativeVoiceCredentialStore.save(keyInput, provider: "gemini")
                        keyInput = ""
                        hasGeminiKey = true
                        message = "Clave guardada en el dispositivo."
                    } catch {
                        message = error.localizedDescription
                    }
                }
                .disabled(keyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Comprobar") {
                    Task { await checkGeminiConnection() }
                }
                .disabled(!hasGeminiKey || checking)
                Picker("Voz Gemini", selection: $geminiVoice) {
                    ForEach(NativeGeminiSpeech.voices, id: \.self) { name in
                        Text(name).tag(name)
                    }
                }
                Button("Escuchar muestra") {
                    geminiPreview.listen(
                        "Hola. Esta es una prueba de voz Gemini en TifloLector.",
                        voice: geminiVoice)
                }
                .disabled(!hasGeminiKey || geminiPreview.busy)
                if geminiPreview.playing {
                    Button("Detener") { geminiPreview.stop() }
                }
                if !geminiPreview.message.isEmpty {
                    Text(geminiPreview.message)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                Button("Eliminar", role: .destructive) { confirmDeletion = true }
                    .disabled(!hasGeminiKey)
                Text("La clave se guarda solamente en este iPhone. Cada usuario gestiona sus cuotas y posibles costes con Google.")
                Text("La prueba y la lectura de documentos con Gemini generan audio real y pueden consumir cuota. Elige Gemini en Motor para leer o exportar.")
            }
            }
            if provider == .gemini && !message.isEmpty {
                Section("Estado") {
                    Text(message).accessibilityAddTraits(.updatesFrequently)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(provider == .phonon ? "Phonon" : "Gemini")
        .fileImporter(
            isPresented: $showPhononImporter,
            allowedContentTypes: [.zip],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first, !phononBusy else { return }
                phononBusy = true
                phononMessage = "Verificando el modelo Core ML."
                let granted = url.startAccessingSecurityScopedResource()
                phononTask = Task {
                    defer {
                        if granted { url.stopAccessingSecurityScopedResource() }
                        phononBusy = false
                    }
                    do {
                        try await Task.detached(priority: .userInitiated) {
                            try NativePhononModelStore.installUserBundle(zipURL: url)
                        }.value
                        NativePhononRuntime.unload()
                        phononInstalled = NativePhononModelStore.isInstalled
                        phononVoices = []
                        phononMessage = "Modelo Phonon importado."
                        await loadPhononVoices()
                    } catch {
                        phononMessage = error.localizedDescription
                    }
                }
            case .failure(let error):
                phononMessage = error.localizedDescription
            }
        }
        .onAppear {
            if provider == .phonon && NativePhononRuntime.isUsable && phononVoices.isEmpty {
                Task { await loadPhononVoices() }
            }
        }
        .onDisappear {
            geminiPreview.stop()
            phononPreview.stop()
            phononTask?.cancel()
        }
        .confirmationDialog("Eliminar modelo Phonon", isPresented: $showPhononRemoval,
                            titleVisibility: .visible) {
            Button("Eliminar modelo", role: .destructive) {
                do {
                    try NativePhononModelStore.remove()
                    phononInstalled = false
                    phononMessage = "Modelo Phonon eliminado."
                } catch {
                    phononMessage = error.localizedDescription
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .confirmationDialog("Eliminar clave", isPresented: $confirmDeletion,
                            titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) {
                do {
                    try NativeVoiceCredentialStore.delete("gemini")
                    hasGeminiKey = false
                    message = "Clave eliminada."
                } catch {
                    message = error.localizedDescription
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
    }
}
