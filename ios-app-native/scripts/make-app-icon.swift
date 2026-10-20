import Foundation
import AppKit

// El origen de 512 px tiene esquinas y márgenes blancos alrededor de un
// fondo azul oscuro con esquinas redondeadas. iOS aplica por sí mismo la
// máscara de esquinas al icono: la imagen enviada debe cubrir todo el cuadrado.
// Eliminar sólo el blanco EXTERIOR conectado al borde, sin tocar las letras
// ni las ondas blancas del emblema, que están aisladas por el fondo azul.
guard CommandLine.arguments.count == 3 else {
    fatalError("Uso: swift make-app-icon.swift origen destino")
}
guard let logo = NSImage(contentsOfFile: CommandLine.arguments[1]) else {
    fatalError("Icono TifloAcosta no encontrado")
}

let dimension = 1024
let navy: (UInt8, UInt8, UInt8) = (13, 43, 69)
guard let canvas = CGContext(
    data: nil,
    width: dimension,
    height: dimension,
    bitsPerComponent: 8,
    bytesPerRow: dimension * 4,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue
        | CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fatalError("No se pudo crear el lienzo de icono RGBA")
}

let context = NSGraphicsContext(cgContext: canvas, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
canvas.interpolationQuality = .high
canvas.setShouldAntialias(true)
let area = NSRect(x: 0, y: 0, width: dimension, height: dimension)
NSColor(
    calibratedRed: CGFloat(navy.0) / 255,
    green: CGFloat(navy.1) / 255,
    blue: CGFloat(navy.2) / 255,
    alpha: 1
).setFill()
area.fill()
logo.draw(in: area, from: .zero, operation: .sourceOver, fraction: 1)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let pixels = canvas.data?.assumingMemoryBound(to: UInt8.self) else {
    fatalError("No se pueden inspeccionar los píxeles del icono")
}

// En el búfer explícitamente RGBA el azul corporativo suma 125. Los píxeles
// claros (incluidos los de suavizado) que se alcanzan desde el borde son
// únicamente el margen exterior; no hay que borrar el blanco del logotipo.
let pixelCount = dimension * dimension
var visited = [UInt8](repeating: 0, count: pixelCount)
var queue = [Int]()
queue.reserveCapacity(pixelCount / 4)

func isExteriorLight(_ index: Int) -> Bool {
    let offset = index * 4
    return Int(pixels[offset]) + Int(pixels[offset + 1])
        + Int(pixels[offset + 2]) > 150
}

func enqueueExterior(_ index: Int) {
    guard visited[index] == 0, isExteriorLight(index) else { return }
    visited[index] = 1
    queue.append(index)
}

for position in 0..<dimension {
    enqueueExterior(position)
    enqueueExterior((dimension - 1) * dimension + position)
    enqueueExterior(position * dimension)
    enqueueExterior(position * dimension + dimension - 1)
}

var cursor = 0
while cursor < queue.count {
    let index = queue[cursor]
    cursor += 1
    let x = index % dimension
    let y = index / dimension
    if x > 0 { enqueueExterior(index - 1) }
    if x + 1 < dimension { enqueueExterior(index + 1) }
    if y > 0 { enqueueExterior(index - dimension) }
    if y + 1 < dimension { enqueueExterior(index + dimension) }
}

// El relleno llega a las cuatro esquinas y al perímetro completo, sin
// recortar el símbolo central ni cambiar su escala.
for index in queue {
    let offset = index * 4
    pixels[offset] = navy.0
    pixels[offset + 1] = navy.1
    pixels[offset + 2] = navy.2
    pixels[offset + 3] = 255
}

// Barrera adicional contra una regresión del blanco exterior.
for position in 0..<dimension {
    let edgeIndices = [
        position, (dimension - 1) * dimension + position,
        position * dimension, position * dimension + dimension - 1
    ]
    for index in edgeIndices {
        let offset = index * 4
        guard pixels[offset] == navy.0,
              pixels[offset + 1] == navy.1,
              pixels[offset + 2] == navy.2 else {
            fatalError("El icono mantiene márgenes en el perímetro")
        }
    }
}

guard let image = canvas.makeImage() else {
    fatalError("No se pudo renderizar el icono")
}

// La imagen de App Store debe ser RGB sin transparencia. Conservar el
// método de exportación comprobado en el flujo de firma de TestFlight.
let raw = NSBitmapImageRep(cgImage: image)
guard let jpeg = raw.representation(using: .jpeg, properties: [.compressionFactor: 1.0]),
      let opaque = NSBitmapImageRep(data: jpeg),
      let png = opaque.representation(using: .png, properties: [:]),
      let exported = NSBitmapImageRep(data: png),
      exported.pixelsWide == dimension,
      exported.pixelsHigh == dimension,
      !exported.hasAlpha else {
    fatalError("No se pudo generar el icono de 1024x1024 RGB sin alfa")
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
print("AppIcon TifloAcosta: 1024x1024 RGB, sin márgenes blancos exteriores; píxeles corregidos: \(queue.count)")
