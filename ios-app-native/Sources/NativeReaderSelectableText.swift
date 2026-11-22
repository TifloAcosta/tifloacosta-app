import SwiftUI
import UIKit

/// Read-only native editor so VoiceOver can select and copy arbitrary text.
/// The selection is independent of TifloLector's saved reading cursor.
struct NativeReaderSelectableText: UIViewRepresentable {
    let text: String
    let requestedOffset: Int

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = true
        view.dataDetectorTypes = [.link]
        view.backgroundColor = .clear
        view.font = .preferredFont(forTextStyle: .body)
        view.adjustsFontForContentSizeCategory = true
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        // A state refresh must not erase the range the user is selecting.
        let accessibleText = NativeReaderHeadingDisplay.mask(in: text)
        guard view.text != accessibleText else { return }
        view.text = accessibleText
        let validOffset = max(0, min(text.count, requestedOffset))
        let utf16Offset = String(text.prefix(validOffset)).utf16.count
        view.selectedRange = NSRange(location: utf16Offset, length: 0)
    }
}
