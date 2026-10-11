// Produce an opaque, high-resolution iOS AppIcon from the existing
// TifloAcosta web brand icon. No third-party raster dependencies.
import Foundation
import AppKit

guard CommandLine.arguments.count == 3 else {
    fatalError("Uso: swift make-app-icon.swift <origen.png> <destino.png>")
}
let sourcePath = CommandLine.arguments[1]
let destinationPath = CommandLine.arguments[2]
guard let source = NSImage(contentsOfFile: sourcePath) else {
    fatalError("No se encontró el icono corporativo TifloAcosta")
}

let dimension = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: dimension,
    pixelsHigh: dimension,
    bitsPerSample: 8,
    samplesPerPixel: 3,
    hasAlpha: false,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("No se pudo crear el icono iOS RGB")
}

let rectangle = NSRect(x: 0, y: 0, width: dimension, height: dimension)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
context.shouldAntialias = true

// Corporate navy replaces any transparent areas of the original icon.
// The final icon is opaque, as App Store Connect requires.
NSColor(calibratedRed: 13.0 / 255.0,
        green: 43.0 / 255.0,
        blue: 69.0 / 255.0,
        alpha: 1.0).setFill()
rectangle.fill()
source.draw(in: rectangle, from: .zero, operation: .sourceOver, fraction: 1.0)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let data = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("No se pudo exportar el icono iOS en PNG")
}
try data.write(to: URL(fileURLWithPath: destinationPath), options: .atomic)
print("AppIcon TifloAcosta: \(dimension)x\(dimension) RGB")
