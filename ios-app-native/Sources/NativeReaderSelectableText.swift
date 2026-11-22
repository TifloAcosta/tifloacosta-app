import SwiftUI
import UIKit

/// A selectable, read-only text surface independent of the saved reading cursor.
/// The explicit copy button uses the exact UTF-16 range selected by VoiceOver.
struct NativeReaderSelectableText: UIViewRepresentable {
    let text: String
    let requestedOffset: Int
    @Binding var selectedText: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = true
        view.dataDetectorTypes = [.link]
        view.backgroundColor = .clear
        view.font = .preferredFont(forTextStyle: .body)
        view.adjustsFontForContentSizeCategory = true
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        // State updates must not destroy the range currently selected by the user.
        let accessibleText = NativeReaderHeadingDisplay.mask(in: text)
        guard view.text != accessibleText else { return }
        context.coordinator.settingInitialSelection = true
        view.text = accessibleText
        let validOffset = max(0, min(text.count, requestedOffset))
        let utf16Offset = String(text.prefix(validOffset)).utf16.count
        view.selectedRange = NSRange(location: utf16Offset, length: 0)
        context.coordinator.settingInitialSelection = false
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: NativeReaderSelectableText
        var settingInitialSelection = false

        init(_ parent: NativeReaderSelectableText) { self.parent = parent }

        func textViewDidChangeSelection(_ textView: UITextView) {
            guard !settingInitialSelection else { return }
            let contents = textView.text as NSString
            let range = textView.selectedRange
            guard range.location != NSNotFound,
                  range.length > 0,
                  range.location <= contents.length,
                  range.length <= contents.length - range.location else {
                if !parent.selectedText.isEmpty { parent.selectedText = "" }
                return
            }
            let exact = contents.substring(with: range)
            if parent.selectedText != exact { parent.selectedText = exact }
        }
    }
}
