import SwiftUI
import Security

/// Credentials stay on this device, separate from other cloud providers.
enum NativeAudiocinematecaCredentials {
    struct Account: Codable {
        let username: String
        let password: String
    }

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.tifloacosta.app.audiocinemateca",
         kSecAttrAccount as String: "personal-account"]
    }

    static func load() -> Account? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Account.self, from: data)
    }

    static func save(_ account: Account) throws {
        let data = try JSONEncoder().encode(account)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            attributes.forEach { item[$0.key] = $0.value }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    static func remove() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }
}

struct NativeAudiocinematecaAccountScreen: View {
    @State private var username = ""
    @State private var password = ""
    @State private var saved = false
    @State private var status = ""
    @State private var confirmRemove = false

    var body: some View {
        Form {
            Section("Cuenta de Audiocinemateca") {
                if saved {
                    Text("Credenciales guardadas en este dispositivo. Acceso al catálogo pendiente de validación.")
                    Button("Olvidar credenciales", role: .destructive) {
                        confirmRemove = true
                    }
                } else {
                    TextField("Nombre de usuario", text: $username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityLabel(Text("Nombre de usuario"))
                    SecureField("Contraseña", text: $password)
                        .textContentType(.password)
                        .accessibilityLabel(Text("Contraseña"))
                    Button("Guardar credenciales") {
                        do {
                            try NativeAudiocinematecaCredentials.save(.init(username: username, password: password))
                            password = ""
                            username = ""
                            saved = true
                            status = MusicLocalized.message("Credenciales guardadas de forma segura.")
                        } catch {
                            status = MusicLocalized.message("No se pudieron guardar las credenciales.")
                        }
                    }
                    .disabled(username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || username.contains(":") || password.isEmpty)
                }
                if !status.isEmpty {
                    Text(status).accessibilityAddTraits(.updatesFrequently)
                }
            }
            Section("¿Todavía no tienes cuenta?") {
                Link("Crear cuenta gratuita", destination: URL(string: "https://audiocinemateca.com/usuario/register")!)
                Text("Completa el formulario oficial y espera el correo de aprobación. Después vuelve aquí con tu nombre de usuario y contraseña.")
            }
            Section("Ayuda con la cuenta") {
                Link("Recuperar contraseña", destination: URL(string: "https://audiocinemateca.com/usuario/password")!)
                Link("Guía oficial de cuentas", destination: URL(string: "https://audiocinemateca.com/ayuda")!)
                Link("Contactar con Audiocinemateca", destination: URL(string: "https://audiocinemateca.com/contact")!)
                Link("Abrir Audiocinemateca en la web", destination: URL(string: "https://audiocinemateca.com/usuario")!)
                Text("Si utilizas autenticación en dos pasos, conserva esa protección y accede desde la web oficial.")
            }
        }
        .navigationTitle("Audiocinemateca")
        .onAppear { saved = NativeAudiocinematecaCredentials.load() != nil }
        .onDisappear { password = "" }
        .confirmationDialog("¿Olvidar las credenciales guardadas?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("Olvidar credenciales", role: .destructive) {
                do {
                    try NativeAudiocinematecaCredentials.remove()
                    if NativeCinemaAudioPlayer.shared.currentCloudReference?.hasPrefix("audiocinemateca:") == true {
                        NativeCinemaAudioPlayer.shared.pauseAndSave(library: NativeCinemaLocalLibrary.shared)
                    }
                    try? NativeAudiocinematecaCache.clear()
                    saved = false
                    status = MusicLocalized.message("Credenciales retiradas de este dispositivo.")
                } catch {
                    status = MusicLocalized.message("No se pudieron retirar las credenciales.")
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Tu cuenta de Audiocinemateca seguirá existiendo.")
        }
    }
}
