import Foundation
import AppKit

// 1024x1024 opaque iPhone home-screen icon. Preserve the original brand artwork,
// but remove EXCESSIVE internal margins before scaling it into Apple's square.
// The system, not the asset, applies the final rounded-square mask.
guard CommandLine.arguments.count == 3 else {
    fatalError("Uso: swift make-app-icon.swift origen destino")
}
guard let logo = NSImage(contentsOfFile: CommandLine.arguments[1]),
      let bitmap = NSBitmapImageRep(contentsOfFile: CommandLine.arguments[1]) else {
    fatalError("Icono TifloAcosta no encontrado")
}
let dimension = 1024
let originalWidth = bitmap.pixelsWide
let originalHeight = bitmap.pixelsHigh
guard originalWidth >= 64, originalHeight >= 64 else {
    fatalError("Imagen de icono insuficiente")
}

struct Sample {
    let r: CGFloat
    let g: CGFloat
    let b: CGFloat
    let a: CGFloat
}
func sample(_ x: Int, _ y: Int) -> Sample {
    let safeX = max(0, min(originalWidth - 1, x))
    let safeY = max(0, min(originalHeight - 1, y))
    let color = bitmap.colorAt(x: safeX, y: safeY)?
        .usingColorSpace(.deviceRGB) ?? NSColor.clear
    return Sample(r: color.redComponent, g: color.greenComponent,
                  b: color.blueComponent, a: color.alphaComponent)
}
func difference(_ a: Sample, _ b: Sample) -> CGFloat {
    let dr = a.r - b.r
    let dg = a.g - b.g
    let db = a.b - b.b
    return sqrt(dr * dr + dg * dg + db * db)
}
let corners = [
    sample(2, 2), sample(originalWidth - 3, 2),
    sample(2, originalHeight - 3),
    sample(originalWidth - 3, originalHeight - 3)
]
let transparentBackground = corners.allSatisfy { $0.a < 0.22 }
let opaqueBackground = corners.allSatisfy { $0.a > 0.98 }
let uniformBackground = opaqueBackground &&
    corners.allSatisfy { difference($0, corners[0]) < 0.10 }
let background = uniformBackground
    ? Sample(r: corners.map(\.r).reduce(0, +) / 4,
             g: corners.map(\.g).reduce(0, +) / 4,
             b: corners.map(\.b).reduce(0, +) / 4,
             a: 1)
    : Sample(r: 13 / 255, g: 43 / 255, b: 69 / 255, a: 1)

var minX = originalWidth, minY = originalHeight, maxX = -1, maxY = -1
if transparentBackground || uniformBackground {
    // Ignore slight antialiasing/compression variations in the background.
    // If the four corners are not consistent, refuse to crop the artwork.
    for y in stride(from: 0, to: originalHeight, by: 2) {
        for x in stride(from: 0, to: originalWidth, by: 2) {
            let pixel = sample(x, y)
            let content = transparentBackground
                ? pixel.a > 0.25
                : pixel.a > 0.25 && difference(pixel, background) > 0.24
            if content {
                minX = min(minX, x)
                minY = min(minY, y)
                maxX = max(maxX, x)
                maxY = max(maxY, y)
            }
        }
    }
}

// The content should occupy about 84% of the icon's side, leaving a
// balanced 8% margin all around to avoid iOS's rounded-corner clipping.
// Preserve aspect ratio and preserve the whole artwork: never stretch.
var visibleRect = NSRect(x: 0, y: 0, width: originalWidth, height: originalHeight)
if maxX >= minX && maxY >= minY &&
   abs(originalWidth - originalHeight) < 3 {
    let contentSide = CGFloat(max(maxX - minX + 2, maxY - minY + 2))
    let occupancy = contentSide / CGFloat(originalWidth)
    if occupancy < 0.78 && occupancy > 0.16 {
        let cropSide = min(CGFloat(originalWidth), ceil(contentSide / 0.84))
        let centerX = CGFloat(minX + maxX) / 2
        let centerY = CGFloat(minY + maxY) / 2
        let cropX = max(0, min(CGFloat(originalWidth) - cropSide,
                               centerX - cropSide / 2))
        let cropY = max(0, min(CGFloat(originalHeight) - cropSide,
                               centerY - cropSide / 2))
        // NSBitmapImageRep samples from the top; NSImage.draw uses the
        // unflipped AppKit source rect, whose vertical origin is the bottom.
        visibleRect = NSRect(x: cropX,
                             y: CGFloat(originalHeight) - cropY - cropSide,
                             width: cropSide, height: cropSide)
        print("AppIcon: contenido original \\(Int(occupancy * 100))%, " +
              "ajustado proporcionalmente para ocupar ~84%")
    } else {
        print("AppIcon: contenido original \\(Int(occupancy * 100))%; no se amplía")
    }
} else {
    print("AppIcon: fondo no uniforme o insignia no aislable; se respeta el origen")
}

guard let canvas = CGContext(data: nil, width: dimension, height: dimension,
                              bitsPerComponent: 8, bytesPerRow: dimension * 4,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("No se pudo crear el lienzo de icono")
}
let context = NSGraphicsContext(cgContext: canvas, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
context.shouldAntialias = true
let area = NSRect(x: 0, y: 0, width: dimension, height: dimension)
NSColor(calibratedRed: background.r, green: background.g,
        blue: background.b, alpha: 1).setFill()
area.fill()
logo.draw(in: area, from: visibleRect, operation: .sourceOver, fraction: 1)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let image = canvas.makeImage() else {
    fatalError("No se pudo renderizar el icono")
}
// Apple App Store icon requires an opaque 1024x1024 RGB PNG, no alpha channel.
let raw = NSBitmapImageRep(cgImage: image)
guard let jpeg = raw.representation(using: .jpeg, properties: [.compressionFactor: 1.0]),
      let opaque = NSBitmapImageRep(data: jpeg),
      let png = opaque.representation(using: .png, properties: [:]) else {
    fatalError("No se pudo convertir el icono a PNG RGB")
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
print("AppIcon TifloAcosta: 1024x1024 RGB, identidad preservada")
