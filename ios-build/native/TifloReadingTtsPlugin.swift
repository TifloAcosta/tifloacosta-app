import Foundation
import AVFAudio
import Capacitor

/// Native iOS speech engine. Never uses WKWebView speechSynthesis/getVoices.
@objc(TifloReadingTtsPlugin)
public final class TifloReadingTtsPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate {
    public let identifier = "TifloReadingTtsPlugin"
    public let jsName = "TifloReadingTts"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "listTtsVoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openTtsVoiceInstaller", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginTtsSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendTtsUnits", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "commitTtsSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playTts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseTts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seekTts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTtsState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTts", returnType: CAPPluginReturnPromise)
    ]

    private let synthesizer = AVSpeechSynthesizer()
    private struct Unit {
        let blockIndex: Int
        let unitIndex: Int
        let text: String
    }
    private var units: [Unit] = []
    private var sessionId = ""
    private var bookId = ""
    private var voiceId = ""
    private var rate = 1.0
    private var startBlock = 0
    private var startUnit = 0
    private var cursor = 0
    private var prepared = false
    private var playing = false
    private var ended = false
    private var paused = false

    public override func load() {
        super.load()
        synthesizer.delegate = self
    }

    private func onMain(_ block: @escaping () -> Void) {
        DispatchQueue.main.async(execute: block)
    }

    private func emit(_ event: String) {
        notifyListeners(event, data: state())
    }

    private func state() -> [String: Any] {
        let current = units.indices.contains(cursor) ? units[cursor] : nil
        return [
            "sessionId": sessionId,
            "bookId": bookId,
            "blockIndex": current?.blockIndex ?? startBlock,
            "unitIndex": current?.unitIndex ?? startUnit,
            "prepared": prepared,
            "playing": playing,
            "ended": ended
        ]
    }

    @objc public func listTtsVoices(_ call: CAPPluginCall) {
        onMain {
            let voices: [[String: Any]] = AVSpeechSynthesisVoice.speechVoices()
                .sorted {
                    if $0.language != $1.language { return $0.language < $1.language }
                    return $0.name.localizedStandardCompare($1.name) == .orderedAscending
                }
                .map {
                    [
                        "id": $0.identifier,
                        "name": $0.name,
                        "locale": $0.language,
                        "quality": $0.quality.rawValue
                    ]
                }
            call.resolve(["voices": voices])
        }
    }

    @objc public func openTtsVoiceInstaller(_ call: CAPPluginCall) {
        // iOS does not provide a supported deep-link to its voice download screen.
        call.resolve(["opened": false, "destination": "none"])
    }

    @objc public func beginTtsSession(_ call: CAPPluginCall) {
        onMain {
            self.synthesizer.stopSpeaking(at: .immediate)
            self.units.removeAll()
            self.sessionId = call.getString("sessionId") ?? ""
            self.bookId = call.getString("bookId") ?? ""
            self.voiceId = call.getString("voiceId") ?? ""
            self.rate = max(0.5, min(2.0, call.getDouble("rate") ?? 1))
            self.startBlock = max(0, call.getInt("blockIndex") ?? 0)
            self.startUnit = max(0, call.getInt("unitIndex") ?? 0)
            self.cursor = 0
            self.prepared = false
            self.playing = false
            self.paused = false
            self.ended = false
            call.resolve(["prepared": !self.sessionId.isEmpty && !self.bookId.isEmpty])
        }
    }

    @objc public func appendTtsUnits(_ call: CAPPluginCall) {
        onMain {
            guard call.getString("sessionId") == self.sessionId, !self.sessionId.isEmpty,
                  !self.prepared else {
                call.reject("Invalid or already committed speech session")
                return
            }
            let input = call.getArray("units") as? [[String: Any]] ?? []
            for item in input {
                let value = (item["text"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if value.isEmpty { continue }
                self.units.append(Unit(
                    blockIndex: max(0, item["blockIndex"] as? Int ?? 0),
                    unitIndex: max(0, item["unitIndex"] as? Int ?? 0),
                    text: value
                ))
            }
            call.resolve(["appended": input.count])
        }
    }

    @objc public func commitTtsSession(_ call: CAPPluginCall) {
        onMain {
            guard call.getString("sessionId") == self.sessionId, !self.units.isEmpty else {
                call.resolve(["prepared": false])
                return
            }
            self.prepared = true
            self.cursor = self.units.firstIndex {
                $0.blockIndex == self.startBlock && $0.unitIndex == self.startUnit
            } ?? 0
            self.emit("ttsState")
            call.resolve(["prepared": true])
        }
    }

    private func startCurrentUnit() {
        guard prepared && units.indices.contains(cursor) else {
            playing = false
            paused = false
            ended = true
            emit("ttsEnded")
            emit("ttsState")
            return
        }
        let item = units[cursor]
        let utterance = AVSpeechUtterance(string: item.text)
        utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate,
                             max(AVSpeechUtteranceMinimumSpeechRate,
                                 AVSpeechUtteranceDefaultSpeechRate * Float(rate)))
        if !voiceId.isEmpty, let selected = AVSpeechSynthesisVoice(identifier: voiceId) {
            utterance.voice = selected
        }
        emit("ttsPosition")
        synthesizer.speak(utterance)
    }

    @objc public func playTts(_ call: CAPPluginCall) {
        onMain {
            guard self.prepared && !self.ended else {
                call.resolve(["accepted": false])
                return
            }
            if self.paused && self.synthesizer.isPaused {
                self.playing = self.synthesizer.continueSpeaking()
            } else if !self.playing {
                self.playing = true
                self.startCurrentUnit()
            }
            self.paused = false
            self.emit("ttsState")
            call.resolve(["accepted": self.playing])
        }
    }

    @objc public func pauseTts(_ call: CAPPluginCall) {
        onMain {
            if self.playing {
                self.paused = self.synthesizer.pauseSpeaking(at: .immediate)
            }
            self.playing = false
            self.emit("ttsState")
            call.resolve(["paused": self.prepared])
        }
    }

    @objc public func seekTts(_ call: CAPPluginCall) {
        onMain {
            guard self.prepared else {
                call.resolve(["accepted": false])
                return
            }
            let block = max(0, call.getInt("blockIndex") ?? 0)
            let unit = max(0, call.getInt("unitIndex") ?? 0)
            self.synthesizer.stopSpeaking(at: .immediate)
            self.cursor = self.units.firstIndex {
                $0.blockIndex == block && $0.unitIndex == unit
            } ?? self.cursor
            self.playing = false
            self.paused = false
            self.ended = false
            self.emit("ttsPosition")
            call.resolve(["accepted": true])
        }
    }

    @objc public func getTtsState(_ call: CAPPluginCall) {
        onMain { call.resolve(self.state()) }
    }

    @objc public func stopTts(_ call: CAPPluginCall) {
        onMain {
            self.synthesizer.stopSpeaking(at: .immediate)
            self.playing = false
            self.paused = false
            self.prepared = false
            self.ended = false
            self.emit("ttsState")
            call.resolve(["stopped": true])
        }
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                  didFinish utterance: AVSpeechUtterance) {
        guard playing else { return }
        cursor += 1
        startCurrentUnit()
    }

    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                  didCancel utterance: AVSpeechUtterance) {
        // Cancellation is deliberate when changing position or stopping playback.
    }
}
