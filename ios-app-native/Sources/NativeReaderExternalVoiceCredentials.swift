import SwiftUI
import Security

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

struct NativeReaderExternalVoiceSettingsScreen: View {
    @State private var keyInput = ""
    @State private var hasGeminiKey = NativeVoiceCredentialStore.hasKey("gemini")
    @State private var message = ""
    @State private var confirmDeletion = false
    @State private var checking = false

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
                message = "Conexión correcta. La generación de audio todavía no está activada."
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
            Section("Phonon") {
                Text("Voces locales. No necesitan clave API.")
                Text("La aplicación Phonon para VoiceOver no supone automáticamente compatibilidad con el reproductor de TifloLector.")
                Link("Phonon para iPhone", destination: URL(string: "https://apps.apple.com/app/id6828988617")!)
                Link("Motor Phonon", destination: URL(string: "https://gradium.ai/phonon")!)
            }
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
                Button("Eliminar", role: .destructive) { confirmDeletion = true }
                    .disabled(!hasGeminiKey)
                Text("La clave se guarda solamente en este iPhone. Cada usuario gestiona sus cuotas y posibles costes con Google.")
                Text("La conexión y la reproducción de Gemini se habilitarán cuando su integración esté verificada.")
            }
            if !message.isEmpty {
                Section("Estado") {
                    Text(message).accessibilityAddTraits(.updatesFrequently)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Motores externos")
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
