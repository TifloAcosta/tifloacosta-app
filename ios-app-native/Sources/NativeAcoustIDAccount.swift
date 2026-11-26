import SwiftUI

struct NativeAcoustIDAccount: View {
    @AppStorage("mi-musica-acoustid-auto") private var automatic = false
    @State private var key = ""
    @State private var linked = false
    @State private var approval: NativeMusicRecognition.LinkResponse.User.Link?
    @State private var operation: Task<Void, Never>?
    @State private var message: LocalizedStringKey?

    var body: some View {
        Form {
            if let client = NativeMusicRecognition.clientKey {
                Section("Cuenta AcoustID") {
                    Text(linked ? "Cuenta vinculada" : "Cuenta sin vincular")
                    Button("Solicitar código de vinculación") { beginLink(client) }
                        .disabled(operation != nil)
                    if let approval {
                        Text("Código: \(approval.code)")
                            .textSelection(.enabled)
                        Link("Autorizar en AcoustID", destination: approval.url)
                    }
                    if operation != nil {
                        Button("Cancelar vinculación") { operation?.cancel() }
                    }
                    if linked {
                        Button("Desvincular de este iPhone", role: .destructive) { unlink() }
                            .disabled(operation != nil)
                        Toggle("Identificar al importar con AcoustID", isOn: $automatic)
                    }
                    if let message { Text(MusicLocalized.message(message)).accessibilityAddTraits(.updatesFrequently) }
                }
                Section("Clave personal de AcoustID") {
                    SecureField("Clave personal de AcoustID", text: $key)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    PasteButton(payloadType: String.self) { values in key = values.first ?? "" }
                    Button("Validar y guardar clave") { saveManual(client) }
                        .disabled(operation != nil || key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    Link("Abrir la página de mi clave", destination: URL(string: "https://acoustid.org/api-key")!)
                }
                Text("AcoustID recibe la huella acústica y la duración. El audio se queda en el dispositivo.")
            } else {
                Text("Falta configurar el identificador público de TifloAcosta en AcoustID.")
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Cuenta AcoustID")
        .onAppear { linked = (try? NativeAcoustIDKeychain.read(.active)) != nil }
        .onDisappear { operation?.cancel(); key = "" }
    }

    private func beginLink(_ client: String) {
        operation = Task {
            defer { operation = nil; approval = nil }
            message = nil
            do {
                let payload = try await NativeMusicRecognition.shared.requestLink(client: client)
                try Task.checkCancellation()
                let expires = ISO8601DateFormatter().date(from: payload.link.expires)
                guard let expires, expires > Date() else { throw URLError(.badServerResponse) }
                try NativeAcoustIDKeychain.save(payload.apikey, in: .pending)
                defer { try? NativeAcoustIDKeychain.remove(.pending) }
                approval = payload.link
                message = "Esperando autorización en AcoustID."
                while Date() < expires {
                    try await Task.sleep(for: .seconds(4))
                    guard Date() < expires else { break }
                    let state = try await NativeMusicRecognition.shared.linkStatus(client: client, user: payload.apikey)
                    try Task.checkCancellation()
                    switch state {
                    case .pending: continue
                    case .approved:
                        try NativeAcoustIDKeychain.save(payload.apikey, in: .active)
                        linked = true
                        message = "Cuenta vinculada"
                        return
                    case .declined, .expired, .revoked, .unknown:
                        message = "El código ya no permite vincular la cuenta."
                        return
                    }
                }
                message = "El código ya no permite vincular la cuenta."
            } catch is CancellationError {
                message = nil
            } catch {
                message = "No se pudo vincular la cuenta de AcoustID."
            }
        }
    }

    private func saveManual(_ client: String) {
        let candidate = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty, candidate.utf8.count <= 256,
              candidate.utf8.allSatisfy({ (33...126).contains($0) }) else {
            message = "La clave personal de AcoustID no es válida."
            return
        }
        operation = Task {
            defer { operation = nil }
            do {
                guard try await NativeMusicRecognition.shared.linkStatus(client: client, user: candidate) == .approved else {
                    message = "La clave personal de AcoustID no es válida."
                    return
                }
                try Task.checkCancellation()
                try NativeAcoustIDKeychain.save(candidate, in: .active)
                linked = true
                key = ""
                message = "Cuenta vinculada"
            } catch is CancellationError {
                return
            } catch {
                message = "No se pudo vincular la cuenta de AcoustID."
            }
        }
    }

    private func unlink() {
        do {
            try NativeAcoustIDKeychain.remove(.active)
            try NativeAcoustIDKeychain.remove(.pending)
            automatic = false
            linked = false
            message = nil
        } catch {
            message = "No se pudo desvincular la cuenta de AcoustID."
        }
    }
}
