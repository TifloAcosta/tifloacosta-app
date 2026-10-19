import SwiftUI
import UIKit

/// Identidad visual de TifloAcosta, compartida por todas las pantallas SwiftUI.
/// El diseño responsive es global; cada pantalla adapta sus controles al espacio disponible.
/// Mantener sincronizados los colores de marca con styles.css y mobile/src/styles.css.
/// El rojo corporativo sobre blanco es legible; como texto sobre fondo oscuro NO lo es.
enum TifloVisual {
    static let brandRed = Color(red: 166.0 / 255.0, green: 27.0 / 255.0, blue: 27.0 / 255.0) // #A61B1B
    static let brandDeepRed = Color(red: 127.0 / 255.0, green: 20.0 / 255.0, blue: 20.0 / 255.0) // #7F1414
    static let brandMarkHighlight = Color(red: 229.0 / 255.0, green: 57.0 / 255.0, blue: 53.0 / 255.0)
    static let onBrand = Color.white

    /// Paleta corporativa por defecto y perfiles de alto contraste, iguales
    /// que en la web. Los colores se resuelven con los rasgos nativos de iOS.
    static let canvas = adaptive(light: 0xFFFFFF, dark: 0x0B0B0B,
                                 contrastLight: 0xFFFFFF, contrastDark: 0x000000)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x151010,
                                  contrastLight: 0xFFFFFF, contrastDark: 0x000000)
    static let surfaceRaised = adaptive(light: 0xFFF4F4, dark: 0x201414,
                                        contrastLight: 0xFFFFFF, contrastDark: 0x000000)
    static let primaryText = adaptive(light: 0x111111, dark: 0xFFFFFF,
                                      contrastLight: 0x000000, contrastDark: 0xFFFFFF)
    static let secondaryText = adaptive(light: 0x4A3A3A, dark: 0xD7CACA,
                                        contrastLight: 0x202020, contrastDark: 0xF0F0F0)
    static let border = adaptive(light: 0xD9B8B8, dark: 0x806969,
                                 contrastLight: 0x000000, contrastDark: 0xFFFFFF)

    /// El rojo oscuro es apto para enlaces en claro. Sobre negro se usa blanco.
    static let actionTint = adaptive(light: 0xA61B1B, dark: 0xFF9D9D,
                                     contrastLight: 0x8B1717, contrastDark: 0xFFFFFF)

    /// Los controles de selección se distinguen como elementos accionables,
    /// sin introducir saturación ni sacrificar el contraste reforzado.
    static let selectorSurface = adaptive(light: 0xFFF0F0, dark: 0x302020,
                                          contrastLight: 0xFFFFFF, contrastDark: 0x000000)
    static let selectorBorder = adaptive(light: 0xB14545, dark: 0xF7B0B0,
                                         contrastLight: 0x000000, contrastDark: 0xFFFFFF)

    static let cornerRadius: CGFloat = 14
    static let controlCornerRadius: CGFloat = 12
    static let controlMinimumHeight: CGFloat = 44
    static let sectionSpacing: CGFloat = 16

    private static func adaptive(
        light: UInt32, dark: UInt32,
        contrastLight: UInt32, contrastDark: UInt32
    ) -> Color {
        Color(uiColor: UIColor { traits in
            let setting = UserDefaults.standard.integer(forKey: "native-ios-color-scheme")
            let highContrast = setting == 1 || setting == 2
            let hex: UInt32
            if traits.userInterfaceStyle == .dark {
                hex = highContrast ? contrastDark : dark
            } else {
                hex = highContrast ? contrastLight : light
            }
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255.0,
                green: CGFloat((hex >> 8) & 0xFF) / 255.0,
                blue: CGFloat(hex & 0xFF) / 255.0,
                alpha: 1
            )
        })
    }
}

/// Preferencias globales de la app, con Dynamic Type leído en la jerarquía
/// de vistas (y no en App) para no perder la escala de Accesibilidad de iOS.
private struct TifloReadableContent: ViewModifier {
    @Environment(\.dynamicTypeSize) private var systemTextSize
    @AppStorage("native-ios-text-size") private var textSizeIndex = 0
    @AppStorage("native-ios-line-spacing") private var lineSpacingIndex = 0
    @AppStorage("native-ios-strong-text") private var strongText = false

    private var effectiveTextSize: DynamicTypeSize {
        let minimum: DynamicTypeSize
        switch textSizeIndex {
        case 1: minimum = .xxLarge
        case 2: minimum = .accessibility1
        case 3: minimum = .accessibility3
        default: return systemTextSize
        }
        return max(systemTextSize, minimum)
    }

    func body(content: Content) -> some View {
        content
            .dynamicTypeSize(effectiveTextSize)
            .lineSpacing(lineSpacingIndex == 1 ? 6 : lineSpacingIndex == 2 ? 12 : 0)
            .fontWeight(strongText ? .semibold : nil)
    }
}

extension View {
    func tifloVisualPreferences() -> some View {
        modifier(TifloReadableContent())
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
            .listRowSeparatorTint(TifloVisual.border)
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
