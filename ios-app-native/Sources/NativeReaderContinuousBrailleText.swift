import SwiftUI
import UIKit

/// A single accessible reading surface for a refreshable braille display.
/// SwiftUI's separate 1800-character text nodes require an extra navigation
/// action after every chunk; UITextView allows the user to pan through the
/// entire document without changing elements at those artificial boundaries.
struct NativeReaderContinuousBrailleText: UIViewRepresentable {
    let text: String
    let initialOffset: Int
    let textSize: Double
    let strongText: Bool
    let onPositionChange: (Int) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = true
        view.dataDetectorTypes = [.link]
        view.backgroundColor = .clear
        view.delegate = context.coordinator
        view.adjustsFontForContentSizeCategory = true
        view.accessibilityLabel = nil // Let VoiceOver and braille read actual text.
        return view
    }

    /// Replace heading-only Markdown # with same-length spaces: VoiceOver
    /// does not announce "hash" and saved character offsets remain stable.
    private static func maskMarkdownHeadings(_ original: String) -> String {
        var characters = Array(original)
        var index = 0
        while index < characters.count {
            if index == 0 || characters[index - 1] == "\n" {
                // Markdown also permits up to three indentation spaces
                // before a heading. Keep every character offset unchanged.
                var markerStart = index
                while markerStart < characters.count && markerStart - index < 3 &&
                      (characters[markerStart] == " " || characters[markerStart] == "\t") {
                    markerStart += 1
                }
                var end = markerStart
                while end < characters.count && end - markerStart < 6 &&
                      characters[end] == "#" {
                    end += 1
                }
                if end > markerStart && end < characters.count &&
                    (characters[end] == " " || characters[end] == "\t") {
                    for marker in markerStart..<end { characters[marker] = " " }
                }
            }
            index += 1
        }
        return String(characters)
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        // Assigning fonts on every SwiftUI state refresh can invalidate a long
        // UITextView layout and move the braille viewport unexpectedly.
        let requestedFont = UIFont.systemFont(ofSize: CGFloat(textSize),
            weight: strongText ? .bold : .regular)
        if view.font != requestedFont { view.font = requestedFont }
        if context.coordinator.originalText != text {
            context.coordinator.originalText = text
            context.coordinator.visibleText = Self.maskMarkdownHeadings(text)
        }
        let visibleText = context.coordinator.visibleText
        let textChanged = view.text != visibleText
        let explicitPositionChange = context.coordinator.requestedOffset != initialOffset
        guard textChanged || explicitPositionChange else { return }

        // NSTextView selection callbacks are also triggered by replacing text.
        // Suppress programmatic callbacks across the complete update, rather than
        // accidentally persisting an intermediate selection at the start/end.
        context.coordinator.restoring = true
        defer { context.coordinator.restoring = false }
        if textChanged { view.text = visibleText }
        let offset = max(0, min(text.count, initialOffset))
        let utf16Offset = String(text.prefix(offset)).utf16.count
        let restoredRange = NSRange(location: utf16Offset, length: 0)
        let movedSelection = view.selectedRange != restoredRange
        if movedSelection { view.selectedRange = restoredRange }
        // Scroll only for a newly loaded document or a genuine explicit seek.
        if textChanged || movedSelection {
            view.scrollRangeToVisible(restoredRange)
        }
        context.coordinator.requestedOffset = offset
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: NativeReaderContinuousBrailleText
        var restoring = false
        var requestedOffset = -1
        var originalText = ""
        var visibleText = ""

        init(_ parent: NativeReaderContinuousBrailleText) { self.parent = parent }

        func textViewDidChangeSelection(_ view: UITextView) {
            guard !restoring, !view.text.isEmpty else { return }
            let utf16Offset = max(0, min((view.text as NSString).length, view.selectedRange.location))
            let prefix = (view.text as NSString).substring(to: utf16Offset)
            let characterOffset = prefix.count
            guard characterOffset != requestedOffset else { return }
            requestedOffset = characterOffset
            parent.onPositionChange(characterOffset)
        }
    }
}
