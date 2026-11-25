import Foundation
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

enum NativeRTFConversionMarkup {
    static func xhtml(_ data: Data, title: String) throws -> Data? {
        try Task.checkCancellation()
        // RTFD has external attachments. This reader accepts only the plain RTF stream.
        guard data.starts(with: Data("{\\rtf".utf8)) else { return nil }
        let original = try NSAttributedString(data: data, options: [.documentType: NSAttributedString.DocumentType.rtf],
                                              documentAttributes: nil)
        let escape = NativeDocumentConversion.xml
        let text = original.string as NSString
        var body = ""
        var offset = 0
        while offset < text.length {
            try Task.checkCancellation()
            let paragraph = text.paragraphRange(for: NSRange(location: offset, length: 0))
            body += "<p>"
            original.enumerateAttributes(in: paragraph) { attributes, range, stop in
                if Task.isCancelled { stop.pointee = true; return }
                let value = text.substring(with: range).trimmingCharacters(in: .newlines)
                var rendered = escape(value)
                #if canImport(UIKit)
                if let font = attributes[.font] as? UIFont {
                    let traits = font.fontDescriptor.symbolicTraits
                    if traits.contains(.traitBold) { rendered = "<strong>\(rendered)</strong>" }
                    if traits.contains(.traitItalic) { rendered = "<em>\(rendered)</em>" }
                }
                #elseif canImport(AppKit)
                if let font = attributes[.font] as? NSFont {
                    let traits = font.fontDescriptor.symbolicTraits
                    if traits.contains(.bold) { rendered = "<strong>\(rendered)</strong>" }
                    if traits.contains(.italic) { rendered = "<em>\(rendered)</em>" }
                }
                #endif
                if let style = attributes[.underlineStyle] as? NSNumber, style.intValue != 0 {
                    rendered = "<u>\(rendered)</u>"
                }
                let link = (attributes[.link] as? URL)?.absoluteString ?? attributes[.link] as? String
                if let link { rendered = "<a href=\"\(escape(link))\">\(rendered)</a>" }
                body += rendered
            }
            body += "</p>"
            offset = NSMaxRange(paragraph)
        }
        try Task.checkCancellation()
        return Data("<html><head><title>\(escape(title))</title></head><body>\(body)</body></html>".utf8)
    }
}
