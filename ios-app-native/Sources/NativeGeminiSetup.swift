import SwiftUI
import SafariServices
import Security
import UIKit

/// Credentials are held locally in the device Keychain, not in app preferences.
enum NativeGeminiKeychain {
    private static let service = "com.tifloacosta.app.reader.gemini"
    private static let account = "user-api-key"

    private static var selector: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    static func load() -> String? {
        var query = selector
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess,
              let data = value as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ key: String) -> Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let data = Data(trimmed.utf8)
        var entry = selector
        entry[kSecValueData as String] = data
        entry[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let result = SecItemAdd(entry as CFDictionary, nil)
        if result == errSecSuccess { return true }
        guard result == errSecDuplicateItem else { return false }
        return SecItemUpdate(selector as CFDictionary,
                             [kSecValueData as String: data] as CFDictionary) == errSecSuccess
    }

    static func delete() -> Bool {
        let result = SecItemDelete(selector as CFDictionary)
        return result == errSecSuccess || result == errSecItemNotFound
    }
}

private struct NativeGeminiKeyBrowser: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let url = URL(string: "https://aistudio.google.com/api-keys")!
        let browser = SFSafariViewController(url: url)
        browser.dismissButtonStyle = .close
        return browser
    }

    func updateUIViewController(_ browser: SFSafariViewController, context: Context) {}
}

struct NativeGeminiSetupScreen: View {
    @State private var key = ""
    @State private var saved = false
    @State private var showBrowser = false
    @State private var showDeleteConfirmation = false
    @State private var checking = false
    @State private var status = ""
    @AccessibilityFocusState private var focusAPIKey: Bool
    @FocusState private var editingAPIKey: Bool

    private func announce(_ message: String) {
        status = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func returnToKeyField() {
        // Wait for the Safari sheet to finish dismissing before moving VoiceOver.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            editingAPIKey = true
            focusAPIKey = true
            UIAccessibility.post(notification: .announcement,
                                 argument: "De vuelta en TifloLector. Clave API de Gemini. Puedes pegar la clave copiada.")
        }
    }

    private func pasteKey() {
        guard let copied = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !copied.isEmpty else {
            announce("No hay una clave de texto copiada. Vuelve a Google, cópiala y regresa aquí.")
            return
        }
        key = copied
        announce("Clave pegada. Pulsa Guardar clave para conservarla en este iPhone.")
    }

    private func verifyKey() async {
        guard let secret = NativeGeminiKeychain.load() else {
            announce("Todavía no hay una clave guardada. Pégala y pulsa Guardar clave.")
            return
        }
        checking = true
        defer { checking = false }
        do {
            var request = URLRequest(url: URL(string: "https://generativelanguage.googleapis.com/v1beta/models")!)
            request.setValue(secret, forHTTPHeaderField: "x-goog-api-key")
            request.timeoutInterval = 20
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                announce("No se ha podido comprobar la conexión con Google.")
                return
            }
            switch http.statusCode {
            case 200:
                announce("Clave aceptada por Google. La configuración de la clave está lista.")
            case 401, 403:
                announce("Google ha rechazado la clave o sus permisos. Comprueba que hayas copiado la clave completa.")
            case 429:
                announce("Google indica que se ha alcanzado el límite de solicitudes o cuota.")
            default:
                announce("Google no ha confirmado la clave. Código de respuesta \(http.statusCode). Inténtalo más tarde.")
            }
        } catch {
            announce("No se ha podido conectar con Google. Comprueba Internet e inténtalo de nuevo.")
        }
    }

    var body: some View {
        List {
            Section("Preparar Gemini") {
                Text("Gemini utiliza una clave de tu cuenta de Google. La creación puede exigir iniciar sesión y aceptar condiciones. El uso del servicio puede consumir cuota y generar costes.")
                Text("Paso 1. Pulsa Crear clave. Cuando Google te muestre la clave, cópiala. Después pulsa Cerrar en el navegador para volver directamente a este formulario.")
                Button("Crear clave en Google") { showBrowser = true }
                    .accessibilityHint("Abre Google AI Studio en un navegador integrado. Usa Cerrar para regresar al campo de la clave.")
                Text("Paso 2. Al regresar, pulsa Pegar clave copiada. No necesitas escribirla.")
                SecureField("Clave API de Gemini", text: $key)
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($editingAPIKey)
                    .accessibilityFocused($focusAPIKey)
                    .accessibilityLabel("Clave API de Gemini")
                Button("Pegar clave copiada") { pasteKey() }
                Button("Guardar clave") {
                    if NativeGeminiKeychain.save(key) {
                        key = ""
                        saved = true
                        announce("Clave guardada de forma segura en este iPhone.")
                    } else {
                        announce("No se ha podido guardar la clave. Comprueba que el campo no esté vacío.")
                    }
                }
                .disabled(key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Text(saved ? "Hay una clave guardada en este dispositivo." : "No hay clave guardada.")
                Button(checking ? "Comprobando conexión" : "Comprobar conexión") {
                    Task { await verifyKey() }
                }
                .disabled(!saved || checking)
                if !status.isEmpty { Text(status).accessibilityAddTraits(.updatesFrequently) }
                Button("Eliminar clave guardada", role: .destructive) {
                    showDeleteConfirmation = true
                }
                .disabled(!saved)
            }
            Section("Motor de lectura") {
                Text("Esta pantalla prepara y verifica la clave. Hasta que esté integrado el motor Gemini, TifloLector seguirá leyendo con las voces del iPhone.")
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Configurar Gemini")
        .sheet(isPresented: $showBrowser, onDismiss: { returnToKeyField() }) {
            NativeGeminiKeyBrowser()
                .ignoresSafeArea()
        }
        .confirmationDialog("¿Eliminar la clave de Gemini?", isPresented: $showDeleteConfirmation) {
            Button("Eliminar clave", role: .destructive) {
                if NativeGeminiKeychain.delete() {
                    saved = false
                    key = ""
                    announce("Clave de Gemini eliminada.")
                } else {
                    announce("No se ha podido eliminar la clave.")
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .onAppear { saved = NativeGeminiKeychain.load() != nil }
    }
}
