import Foundation
import SwiftUI

// Enlaces comprobados en la sección «Contacto y redes» de tifloacosta.com.
// Cada elemento es un enlace nativo identificable por VoiceOver.
private struct NativeContactLink: Identifiable {
    let title: String
    let address: String

    var id: String { address }
    var url: URL? { URL(string: address) }
}

struct NativeContactScreen: View {
    private let direct = [
        NativeContactLink(title: "Contactar por WhatsApp", address: "https://wa.me/34603516398"),
        NativeContactLink(title: "Enviar correo electrónico", address: "mailto:tifloacosta@gmail.com")
    ]

    private let social = [
        NativeContactLink(title: "Canal TifloAcosta en YouTube", address: "https://www.youtube.com/@tifloacosta"),
        NativeContactLink(title: "Instagram", address: "https://www.instagram.com/tifloacosta/"),
        NativeContactLink(title: "Facebook — Canal TifloAcosta", address: "https://www.facebook.com/profile.php?id=61586738581998"),
        NativeContactLink(title: "Facebook — Tony Acosta", address: "https://facebook.com/tony.acostaacosta")
    ]

    private func contactRow(_ item: NativeContactLink) -> some View {
        Group {
            if let url = item.url {
                Link(destination: url) {
                    HStack(alignment: .center, spacing: 12) {
                        Text(LocalizedStringKey(item.title))
                            .foregroundStyle(TifloVisual.primaryText)
                        Spacer(minLength: 8)
                        Image(systemName: "arrow.up.right")
                            .foregroundStyle(TifloVisual.actionTint)
                            .accessibilityHidden(true)
                    }
                    .frame(minHeight: 44)
                }
                .accessibilityLabel(Text(LocalizedStringKey(item.title)))
                .accessibilityHint("Doble toque para abrir el enlace externo.")
                .accessibilityAction(named: Text("Compartir enlace")) {
                    NativeShare.present(url: url)
                }
            }
        }
    }

    var body: some View {
        List {
            Section("Sobre TifloAcosta") {
                Text("Tony Acosta es el autor del libro y la persona que presenta los contenidos y vías de contacto de TifloAcosta reunidos en esta aplicación.")
                    .foregroundStyle(TifloVisual.primaryText)
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Contacto directo") {
                ForEach(direct) { item in
                    contactRow(item)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Redes sociales") {
                ForEach(social) { item in
                    contactRow(item)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Web oficial") {
                contactRow(NativeContactLink(
                    title: "Visitar tifloacosta.com",
                    address: "https://tifloacosta.com"
                ))
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Text("Los enlaces abren servicios externos, sujetos a sus propias condiciones y prácticas de privacidad.")
                .font(.footnote)
                .foregroundStyle(TifloVisual.secondaryText)
                .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Contacto y redes")
        .navigationBarTitleDisplayMode(.inline)
    }
}
