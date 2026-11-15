import Foundation

/// Preferences are keyed by the stable iOS voice identifier, never by its
/// translated display name. A saved profile does not replace document data.
struct NativeReaderVoiceProfile: Codable {
    let speedIndex: Int
    let pitchIndex: Int
    let volumeIndex: Int
    let pauseStyle: Int
    let comma: Double
    let semicolon: Double
    let colon: Double
    let sentence: Double
    let paragraph: Double
}

enum NativeReaderVoiceProfiles {
    private static let storageKey = "native-reader-system-voice-profiles"

    static func capture(speedIndex: Int, pitchIndex: Int, volumeIndex: Int,
                        defaults: UserDefaults = .standard) -> NativeReaderVoiceProfile {
        func pause(_ key: String, fallback: Double) -> Double {
            defaults.object(forKey: key) == nil ? fallback : defaults.double(forKey: key)
        }
        return NativeReaderVoiceProfile(
            speedIndex: speedIndex, pitchIndex: pitchIndex, volumeIndex: volumeIndex,
            pauseStyle: defaults.integer(forKey: "native-reading-pause-style"),
            comma: pause("native-reading-pause-comma", fallback: 0.15),
            semicolon: pause("native-reading-pause-semicolon", fallback: 0.25),
            colon: pause("native-reading-pause-colon", fallback: 0.25),
            sentence: pause("native-reading-pause-sentence", fallback: 0.40),
            paragraph: pause("native-reading-pause-paragraph", fallback: 0.60)
        )
    }

    static func load(for voiceID: String, defaults: UserDefaults = .standard) -> NativeReaderVoiceProfile? {
        guard !voiceID.isEmpty,
              let data = defaults.data(forKey: storageKey),
              let profiles = try? JSONDecoder().decode([String: NativeReaderVoiceProfile].self, from: data)
        else { return nil }
        return profiles[voiceID]
    }

    @discardableResult static func save(_ profile: NativeReaderVoiceProfile, for voiceID: String,
                                        defaults: UserDefaults = .standard) -> Bool {
        guard !voiceID.isEmpty else { return false }
        var profiles = (defaults.data(forKey: storageKey)
            .flatMap { try? JSONDecoder().decode([String: NativeReaderVoiceProfile].self, from: $0) }) ?? [:]
        profiles[voiceID] = profile
        guard let data = try? JSONEncoder().encode(profiles) else { return false }
        defaults.set(data, forKey: storageKey)
        return true
    }

    static func applyPauses(_ profile: NativeReaderVoiceProfile, defaults: UserDefaults = .standard) {
        defaults.set(profile.pauseStyle, forKey: "native-reading-pause-style")
        defaults.set(profile.comma, forKey: "native-reading-pause-comma")
        defaults.set(profile.semicolon, forKey: "native-reading-pause-semicolon")
        defaults.set(profile.colon, forKey: "native-reading-pause-colon")
        defaults.set(profile.sentence, forKey: "native-reading-pause-sentence")
        defaults.set(profile.paragraph, forKey: "native-reading-pause-paragraph")
    }
}
