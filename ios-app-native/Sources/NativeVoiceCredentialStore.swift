import Foundation

/// Adapter for the recovered Gemini synthesis backend. The accessible setup
/// screen remains the sole owner of the same device-local Keychain entry.
enum NativeVoiceCredentialStore {
    static func get(_ provider: String) throws -> String? {
        guard provider == "gemini" else { return nil }
        return NativeGeminiKeychain.load()
    }
}
