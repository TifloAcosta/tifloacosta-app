import Foundation
import AppKit

// Use an RGBA Core Graphics canvas. Convert through opaque JPEG to an RGB PNG.
guard CommandLine.arguments.count == 3 else {fatalError("Uso: swift make-app-icon.swift origen destino")}
guard let logo = NSImage(contentsOfFile: CommandLine.arguments[1]) else {fatalError("Icono TifloAcosta no encontrado")}
let dimension = 1024
guard let canvas = CGContext(data: nil, width: dimension, height: dimension,
                              bitsPerComponent: 8, bytesPerRow: dimension * 4,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
else {fatalError("No se pudo crear el lienzo de icono")}
let context = NSGraphicsContext(cgContext: canvas, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
context.shouldAntialias = true
let area = NSRect(x:0, y:0, width: dimension, height: dimension)
NSColor(calibratedRed: 13.0 / 255.0, green: 43.0 / 255.0, blue: 69.0 / 255.0, alpha: 1).setFill()
area.fill()
logo.draw(in: area, from: .zero, operation: .sourceOver, fraction: 1)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
guard let image=canvas.makeImage() else {fatalError("No se pudo renderizar el icono")}
let raw=NSBitmapImageRep(cgImage:image)
guard let jpeg=raw.representation(using:.jpeg,properties:[.compressionFactor:1.0]),
      let opaque=NSBitmapImageRep(data:jpeg),
      let png=opaque.representation(using:.png,properties:[:])
else {fatalError("No se pudo convertir el icono a PNG RGB")}
try png.write(to:URL(fileURLWithPath:CommandLine.arguments[2]),options:.atomic)
print("AppIcon TifloAcosta: 1024x1024 RGB")
