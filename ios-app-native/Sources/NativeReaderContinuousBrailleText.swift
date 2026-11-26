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

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        // Assigning fonts on every SwiftUI state refresh can invalidate a long
        // UITextView layout and move the braille viewport unexpectedly.
        let requestedFont = UIFont.systemFont(ofSize: CGFloat(textSize),
            weight: strongText ? .bold : .regular)
        let fontChanged = view.font != requestedFont
        let previousSelection = view.selectedRange
        let textChanged = context.coordinator.originalText != text
        if textChanged {
            context.coordinator.originalText = text
            context.coordinator.visibleText = NativeReaderHeadingDisplay.mask(in: text)
            context.coordinator.offsets = NativeReaderTextOffsets(context.coordinator.visibleText)
        }
        let explicitPositionChange = context.coordinator.requestedOffset != initialOffset
        guard textChanged || explicitPositionChange || fontChanged else { return }

        // UITextView selection callbacks are also triggered by replacing text.
        // Suppress programmatic callbacks across the complete update, rather than
        // accidentally persisting an intermediate selection at the start/end.
        context.coordinator.restoring = true
        defer { context.coordinator.restoring = false }
        if textChanged { view.text = context.coordinator.visibleText }
        if view.font != requestedFont { view.font = requestedFont }
        // A typography-only update must preserve the user's actual selection.
        if !textChanged && !explicitPositionChange {
            if view.selectedRange != previousSelection { view.selectedRange = previousSelection }
            view.scrollRangeToVisible(previousSelection)
            return
        }
        let offset = max(0, min(context.coordinator.offsets.length, initialOffset))
        let utf16Offset = context.coordinator.offsets.utf16Offset(for: offset)
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
        var offsets = NativeReaderTextOffsets("")

        init(_ parent: NativeReaderContinuousBrailleText) { self.parent = parent }

        func textViewDidChangeSelection(_ view: UITextView) {
            guard !restoring, !view.text.isEmpty else { return }
            let characterOffset = offsets.characterOffset(forUTF16: view.selectedRange.location)
            guard characterOffset != requestedOffset else { return }
            requestedOffset = characterOffset
            parent.onPositionChange(characterOffset)
        }
    }
}
