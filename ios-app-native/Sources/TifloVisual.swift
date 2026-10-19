import SwiftUI
import UIKit

/// Identidad visual de TifloAcosta, compartida por todas las pantallas SwiftUI.
/// Mantener sincronizados los colores de marca con styles.css y mobile/src/styles.css.
/// El rojo corporativo sobre blanco es legible; como texto sobre fondo oscuro NO lo es.
enum TifloVisual {
    static let brandRed = Color(red: 166.0 / 255.0, green: 27.0 / 255.0, blue: 27.0 / 255.0) // #A61B1B
    static let brandDeepRed = Color(red: 127.0 / 255.0, green: 20.0 / 255.0, blue: 20.0 / 255.0) // #7F1414
    static let brandMarkHighlight = Color(red: 229.0 / 255.0, green: 57.0 / 255.0, blue: 53.0 / 255.0)
    static let onBrand = Color.white

    /// Colores semánticos con resolución nativa de modo claro/oscuro.
    static let canvas = adaptive(light: 0xFFFFFF, dark: 0x0B0B0B)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x151010)
    static let surfaceRaised = adaptive(light: 0xFFF4F4, dark: 0x201414)
    static let primaryText = adaptive(light: 0x111111, dark: 0xFFFFFF)
    static let secondaryText = adaptive(light: 0x4A3A3A, dark: 0xD7CACA)
    static let border = adaptive(light: 0xD9B8B8, dark: 0x806969)

    /// Para enlaces, indicadores y controles SIN fondo rojo.
    /// En modo oscuro el rojo #A61B1B no contrasta como texto sobre negro/granate.
    static let actionTint = adaptive(light: 0xA61B1B, dark: 0xFF9D9D)

    static let cornerRadius: CGFloat = 14
    static let controlCornerRadius: CGFloat = 12
    static let controlMinimumHeight: CGFloat = 44
    static let sectionSpacing: CGFloat = 16

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255.0,
                green: CGFloat((hex >> 8) & 0xFF) / 255.0,
                blue: CGFloat(hex & 0xFF) / 255.0,
                alpha: 1
            )
        })
    }
}

/// Un mismo fondo y color de acciones en Recursos, Inicio, Descargas,
/// Actualidad, Vídeos, Podcasts, TifloLector y pantallas interiores.
/// No introduce nodos, gestos, rotors ni cambios en el orden de VoiceOver.
private struct TifloScreenSurface: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background(TifloVisual.canvas)
            .tint(TifloVisual.actionTint)
            .toolbarBackground(TifloVisual.brandDeepRed, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

extension View {
    func tifloScreenSurface() -> some View {
        modifier(TifloScreenSurface())
    }
}

/// Acción secundaria: gris/granate muy oscuro y texto legible, nunca rojo
/// apagado sobre botón granate como ocurría en Recursos (IMG_1079).
struct TifloSecondaryActionStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .fixedSize(horizontal: false, vertical: true)
            .multilineTextAlignment(.leading)
            .foregroundStyle(TifloVisual.primaryText)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(minHeight: TifloVisual.controlMinimumHeight, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius)
                    .fill(TifloVisual.surfaceRaised)
            )
            .overlay(
                RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius)
                    .strokeBorder(TifloVisual.border, lineWidth: 1)
            )
            .opacity(!isEnabled ? 0.52 : configuration.isPressed ? 0.78 : 1)
    }
}
