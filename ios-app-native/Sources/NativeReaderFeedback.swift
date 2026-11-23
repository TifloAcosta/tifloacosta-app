import AVFoundation
import SwiftUI
import UIKit

/// Short, original WAV cues. No external assets, undocumented system sound IDs,
/// new audio session categories or changes to VoiceOver volume are required.
@MainActor
enum NativeReaderFeedback {
    enum Outcome {
        case saved
        case duplicate
        case error
        case imported
    }

    private static let soundsKey = "native-reader-sounds-enabled"
    private static let speechKey = "native-reader-spoken-feedback-enabled"
    private static let hapticsKey = "native-reader-haptics-enabled"
    // Keep the player alive until the short sample finishes.
    private static var soundPlayer: AVAudioPlayer?

    static var spokenAnnouncementsEnabled: Bool {
        UserDefaults.standard.object(forKey: speechKey) as? Bool ?? true
    }

    static func confirm(_ outcome: Outcome) {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: hapticsKey) as? Bool ?? true {
            let notification: UINotificationFeedbackGenerator.FeedbackType
            switch outcome {
            case .saved, .imported: notification = .success
            case .duplicate: notification = .warning
            case .error: notification = .error
            }
            UINotificationFeedbackGenerator().notificationOccurred(notification)
        }
        guard defaults.object(forKey: soundsKey) as? Bool ?? true else { return }
        guard let player = try? AVAudioPlayer(data: cueData(for: outcome)) else { return }
        // Do not steal the reading session or interrupt VoiceOver/AVSpeechSynthesizer.
        // AVAudioPlayer can coexist with the app's current spoken-audio session.
        soundPlayer?.stop()
        soundPlayer = player
        player.volume = 0.35
        player.prepareToPlay()
        _ = player.play()
    }

    private static func append16(_ value: UInt16, to data: inout Data) {
        data.append(UInt8(truncatingIfNeeded: value))
        data.append(UInt8(truncatingIfNeeded: value >> 8))
    }

    private static func append32(_ value: UInt32, to data: inout Data) {
        append16(UInt16(truncatingIfNeeded: value), to: &data)
        append16(UInt16(truncatingIfNeeded: value >> 16), to: &data)
    }

    /// 16-bit mono PCM at a low level, with short fade-in/out to avoid clicks.
    /// Rising notes = saved; one middle note = duplicate; falling = error.
    private static func cueData(for outcome: Outcome) -> Data {
        let notes: [(frequency: Double, duration: Double)]
        switch outcome {
        case .saved: notes = [(640, 0.085), (860, 0.095)]
        case .duplicate: notes = [(420, 0.13)]
        case .error: notes = [(410, 0.095), (285, 0.14)]
        case .imported: notes = [(560, 0.07), (720, 0.07), (920, 0.09)]
        }

        let rate = 22_050.0
        var samples: [Int16] = []
        for (index, note) in notes.enumerated() {
            if index > 0 { samples.append(contentsOf: repeatElement(0, count: 440)) }
            let count = max(1, Int(rate * note.duration))
            for frame in 0..<count {
                let envelope = min(1.0, Double(frame) / 140,
                                   Double(count - frame - 1) / 200)
                let value = sin(2 * Double.pi * note.frequency * Double(frame) / rate)
                    * max(0, envelope) * 0.28 * Double(Int16.max)
                samples.append(Int16(value.rounded()))
            }
        }

        let audioBytes = UInt32(samples.count * MemoryLayout<Int16>.size)
        var wav = Data()
        wav.append(contentsOf: Array("RIFF".utf8))
        append32(36 + audioBytes, to: &wav)
        wav.append(contentsOf: Array("WAVEfmt ".utf8))
        append32(16, to: &wav)
        append16(1, to: &wav)         // PCM
        append16(1, to: &wav)         // Mono
        append32(UInt32(rate), to: &wav)
        append32(UInt32(rate) * 2, to: &wav)
        append16(2, to: &wav)         // Block alignment
        append16(16, to: &wav)        // Bits per sample
        wav.append(contentsOf: Array("data".utf8))
        append32(audioBytes, to: &wav)
        for sample in samples {
            append16(UInt16(bitPattern: sample), to: &wav)
        }
        return wav
    }
}

struct NativeReaderFeedbackControls: View {
    @AppStorage("native-reader-sounds-enabled") private var soundsEnabled = true
    @AppStorage("native-reader-spoken-feedback-enabled") private var spokenEnabled = true
    @AppStorage("native-reader-haptics-enabled") private var hapticsEnabled = true

    var body: some View {
        Toggle("Sonidos de TifloLector", isOn: $soundsEnabled)
        Toggle("Avisos hablados", isOn: $spokenEnabled)
        Toggle("Vibración en avisos", isOn: $hapticsEnabled)
    }
}
