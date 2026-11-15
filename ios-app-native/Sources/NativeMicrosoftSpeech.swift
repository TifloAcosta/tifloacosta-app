import Foundation
import Security
import SwiftUI
import AVFoundation

/// User-owned Azure Speech credentials stay in Keychain, never UserDefaults.
enum NativeMicrosoftSpeechKeychain {
    private static let account = "azure-speech-subscription-key"
    private static let service = "com.tifloacosta.reader.microsoft-speech"

    static func load() -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    @discardableResult static func save(_ value: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        if value.isEmpty {
            return SecItemDelete(query as CFDictionary) == errSecSuccess
        }
        guard let data = value.data(using: .utf8) else { return false }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        if status == errSecDuplicateItem {
            return SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary) == errSecSuccess
        }
        return status == errSecSuccess
    }
}

struct NativeAzureVoice: Decodable, Identifiable {
    let ShortName: String
    let DisplayName: String
    let Locale: String
    var id: String { ShortName }
}

enum NativeAzureSpeechError: LocalizedError {
    case configuration, invalidResponse(Int), emptyAudio

    var errorDescription: String? {
        switch self {
        case .configuration: return "Comprueba la clave y la región de Azure Speech."
        case .invalidResponse(let status): return "Azure Speech ha respondido con el código \(status)."
        case .emptyAudio: return "El servicio no ha devuelto audio."
        }
    }
}

enum NativeAzureSpeechService {
    /// A small segment suitable for network TTS. Prefer a sentence boundary.
    static func nextChunk(_ text: String, limit: Int = 1100) -> String {
        let prefix = String(text.prefix(max(1, limit)))
        guard text.count > prefix.count else { return prefix }
        let characters = Array(prefix)
        if let boundary = characters.indices.reversed().first(where: {
            $0 >= characters.count / 2 && ".!?\n".contains(characters[$0])
        }) {
            return String(characters[...boundary])
        }
        if let boundary = characters.indices.reversed().first(where: {
            $0 >= characters.count / 2 && characters[$0].isWhitespace
        }) {
            return String(characters[...boundary])
        }
        return prefix
    }
    static func isConfigured(region: String, voice: String) -> Bool {
        !NativeMicrosoftSpeechKeychain.load().isEmpty && !voice.isEmpty &&
            (try? validatedRegion(region)) != nil
    }
    static func validatedRegion(_ region: String) throws -> String {
        let clean = region.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !clean.isEmpty, clean.range(of: "^[a-z0-9-]+$", options: .regularExpression) != nil else {
            throw NativeAzureSpeechError.configuration
        }
        return clean
    }

    static func voices(key: String, region: String) async throws -> [NativeAzureVoice] {
        let region = try validatedRegion(region)
        guard !key.isEmpty,
              let url = URL(string: "https://\(region).tts.speech.microsoft.com/cognitiveservices/voices/list")
        else { throw NativeAzureSpeechError.configuration }
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue(key, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw NativeAzureSpeechError.emptyAudio }
        guard response.statusCode == 200 else { throw NativeAzureSpeechError.invalidResponse(response.statusCode) }
        return try JSONDecoder().decode([NativeAzureVoice].self, from: data)
    }

    static func synthesize(_ text: String, voice: String, key: String, region: String) async throws -> Data {
        let region = try validatedRegion(region)
        guard !key.isEmpty, !voice.isEmpty,
              let url = URL(string: "https://\(region).tts.speech.microsoft.com/cognitiveservices/v1")
        else { throw NativeAzureSpeechError.configuration }
        let safeText = text.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
        let safeVoice = voice.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
        let xml = "<speak version=\"1.0\" xml:lang=\"es-ES\"><voice name=\"\(safeVoice)\">\(safeText)</voice></speak>"
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.httpMethod = "POST"
        request.httpBody = Data(xml.utf8)
        request.setValue(key, forHTTPHeaderField: "Ocp-Apim-Subscription-Key")
        request.setValue("application/ssml+xml", forHTTPHeaderField: "Content-Type")
        request.setValue("audio-16khz-128kbitrate-mono-mp3", forHTTPHeaderField: "X-Microsoft-OutputFormat")
        request.setValue("TifloAcosta", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw NativeAzureSpeechError.emptyAudio }
        guard response.statusCode == 200 else { throw NativeAzureSpeechError.invalidResponse(response.statusCode) }
        guard !data.isEmpty else { throw NativeAzureSpeechError.emptyAudio }
        return data
    }
}

struct NativeSpeechProviderChoice: View {
    @AppStorage("native-reading-speech-provider") private var provider = 0

    var body: some View {
        NativeAdjustableChoice(
            title: "Motor de voz",
            choices: ["Voces de iOS", "Microsoft Azure Speech"],
            selectedIndex: $provider
        )
        Text("Azure necesita conexión a Internet, una clave propia y una voz elegida. Puede tener costes según el plan de Microsoft. Las voces del iPhone siguen disponibles sin conexión.")
            .font(.footnote)
    }
}

struct NativeAzureSpeechSettings: View {
    @AppStorage("native-azure-speech-region") private var region = "westeurope"
    @AppStorage("native-azure-speech-voice") private var selectedVoice = ""
    @State private var key = ""
    @State private var voices: [NativeAzureVoice] = []
    @State private var status = ""
    @State private var isLoading = false
    @State private var previewPlayer: AVAudioPlayer?

    var body: some View {
        Group {
            SecureField("Clave de Azure Speech", text: $key)
                .textContentType(.password)
                .autocorrectionDisabled()
            TextField("Región de Azure, por ejemplo westeurope", text: $region)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            Button("Guardar clave en el iPhone") {
                let saved = NativeMicrosoftSpeechKeychain.save(key.trimmingCharacters(in: .whitespacesAndNewlines))
                status = saved ? "Clave guardada en el llavero del dispositivo." : "No se ha podido guardar la clave."
            }
            Button("Consultar voces disponibles") {
                isLoading = true
                Task {
                    do {
                        voices = try await NativeAzureSpeechService.voices(key: key, region: region)
                            .filter { $0.Locale.lowercased().hasPrefix("es") }
                        status = "Se encontraron \(voices.count) voces en español."
                    } catch { status = error.localizedDescription }
                    isLoading = false
                }
            }
            .disabled(isLoading || key.isEmpty)
            if !voices.isEmpty {
                Picker("Voz de Azure", selection: $selectedVoice) {
                    Text("Selecciona una voz").tag("")
                    ForEach(voices) { voice in
                        Text("\(voice.DisplayName), \(voice.Locale)").tag(voice.ShortName)
                    }
                }
            }
            Button("Escuchar muestra de Azure") {
                isLoading = true
                Task {
                    do {
                        let data = try await NativeAzureSpeechService.synthesize(
                            "Hola, soy una voz de prueba de TifloLector.",
                            voice: selectedVoice, key: key, region: region
                        )
                        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                        previewPlayer = try AVAudioPlayer(data: data)
                        previewPlayer?.play()
                        status = "Reproduciendo muestra."
                    } catch { status = error.localizedDescription }
                    isLoading = false
                }
            }
            .disabled(isLoading || selectedVoice.isEmpty || key.isEmpty)
            Text(status).font(.footnote).accessibilityAddTraits(.updatesFrequently)
            Text("Servicio de Microsoft con cuenta propia. Puede tener límites o costes según tu plan. Esta pantalla permite comprobar la conexión y escuchar una muestra; todavía no cambia el motor de lectura de documentos.")
                .font(.footnote)
        }
        .onAppear { key = NativeMicrosoftSpeechKeychain.load() }
    }
}
