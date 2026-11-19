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
                var end = index
                while end < characters.count && end - index < 6 && characters[end] == "#" {
                    end += 1
                }
                if end > index && end < characters.count &&
                    (characters[end] == " " || characters[end] == "\t") {
                    for marker in index..<end { characters[marker] = " " }
                }
            }
            index += 1
        }
        return String(characters)
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        view.font = UIFont.systemFont(ofSize: CGFloat(textSize),
            weight: strongText ? .bold : .regular)
        if context.coordinator.originalText != text {
            context.coordinator.originalText = text
            context.coordinator.visibleText = Self.maskMarkdownHeadings(text)
        }
        let visibleText = context.coordinator.visibleText
        let textChanged = view.text != visibleText
        if textChanged { view.text = visibleText }
        if textChanged || context.coordinator.requestedOffset != initialOffset {
            let offset = max(0, min(text.count, initialOffset))
            let utf16Offset = String(text.prefix(offset)).utf16.count
            context.coordinator.restoring = true
            view.selectedRange = NSRange(location: utf16Offset, length: 0)
            view.scrollRangeToVisible(view.selectedRange)
            context.coordinator.requestedOffset = offset
            context.coordinator.restoring = false
        }
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
