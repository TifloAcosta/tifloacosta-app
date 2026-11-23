import Foundation

/// Independent output gain per generated voice. System voices use their
/// existing AVSpeechUtterance profiles, never this store.
enum NativeReaderGeneratedVoiceVolume {
    static func key(engine: Int, voice: String) -> String? {
        guard engine == 1 || engine == 2 else { return nil }
        return "native-reader-generated-voice-volume-\(engine)-\(voice)"
    }

    static func level(engine: Int, voice: String,
                      defaults: UserDefaults = .standard) -> Int {
        guard let storageKey = key(engine: engine, voice: voice) else { return 20 }
        let value = defaults.object(forKey: storageKey) as? Int ?? 20
        return max(0, min(20, value))
    }

    static func gain(engine: Int, voice: String,
                     defaults: UserDefaults = .standard) -> Float {
        Float(level(engine: engine, voice: voice, defaults: defaults)) / 20
    }

    static func setLevel(_ value: Int, engine: Int, voice: String,
                         defaults: UserDefaults = .standard) {
        guard let storageKey = key(engine: engine, voice: voice) else { return }
        defaults.set(max(0, min(20, value)), forKey: storageKey)
    }
}
