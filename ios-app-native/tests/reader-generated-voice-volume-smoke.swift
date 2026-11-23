import Foundation

@main
struct GeneratedVoiceVolumeSmoke {
    static func main() {
        let suite = "tiflo-reader-volume-test-\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else { fatalError("No preferences") }
        defer { defaults.removePersistentDomain(forName: suite) }
        precondition(NativeReaderGeneratedVoiceVolume.gain(engine: 1, voice: "Kore", defaults: defaults) == 1)
        NativeReaderGeneratedVoiceVolume.setLevel(5, engine: 1, voice: "Kore", defaults: defaults)
        precondition(NativeReaderGeneratedVoiceVolume.gain(engine: 1, voice: "Kore", defaults: defaults) == 0.25)
        precondition(NativeReaderGeneratedVoiceVolume.gain(engine: 2, voice: "Kore", defaults: defaults) == 1)
        precondition(NativeReaderGeneratedVoiceVolume.gain(engine: 1, voice: "Aoede", defaults: defaults) == 1)
        NativeReaderGeneratedVoiceVolume.setLevel(25, engine: 2, voice: "", defaults: defaults)
        precondition(NativeReaderGeneratedVoiceVolume.level(engine: 2, voice: "", defaults: defaults) == 20)
        NativeReaderGeneratedVoiceVolume.setLevel(-9, engine: 2, voice: "", defaults: defaults)
        precondition(NativeReaderGeneratedVoiceVolume.level(engine: 2, voice: "", defaults: defaults) == 0)
        precondition(NativeReaderGeneratedVoiceVolume.gain(engine: 0, voice: "system", defaults: defaults) == 1)
        print("Individual Gemini/Phonon voice volumes: all checks passed.")
    }
}
