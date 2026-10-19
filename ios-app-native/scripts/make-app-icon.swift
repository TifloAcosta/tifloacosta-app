import AppKit
import Foundation

guard CommandLine.arguments.count == 3,
      let source = NSImage(contentsOfFile: CommandLine.arguments[1]) else {
    fatalError("Falta el icono oficial de TifloAcosta")
}
let dimension = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: dimension, pixelsHigh: dimension,
    bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false,
    isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("No se pudo crear el icono opaco de 1024 píxeles")
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: dimension, height: dimension).fill()
source.draw(in: NSRect(x: 0, y: 0, width: dimension, height: dimension))
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
guard let data = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("No se pudo generar el icono PNG")
}
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
