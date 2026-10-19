import SwiftUI

/// Página nativa del libro; mantiene los textos editoriales y enlaces
/// existentes de tifloacosta.com, sin insertar una pantalla HTML.
struct NativeBookScreen: View {
    private let coverURL = URL(string: "https://tifloacosta.com/book-cover.jpg")
    private let printURL = URL(string: "https://www.amazon.es/s?k=9798185909218&i=stripbooks")!
    private let kindleURL = URL(string: "https://www.amazon.es/s?k=La+vida+vista+desde+donde+estoy+Tony+Acosta&i=digital-text")!

    var body: some View {
        List {
            Section("La vida vista desde donde estoy") {
                HStack {
                    Spacer(minLength: 0)
                    AsyncImage(url: coverURL) { image in
                        image
                            .resizable()
                            .scaledToFit()
                    } placeholder: {
                        Image(systemName: "book.closed")
                            .resizable()
                            .scaledToFit()
                            .foregroundStyle(TifloVisual.secondaryText)
                    }
                    .frame(maxWidth: 190)
                    .frame(height: 290)
                    .accessibilityLabel("Portada del libro La vida vista desde donde estoy, de Tony Acosta")
                    Spacer(minLength: 0)
                }
                Text("La vida vista desde donde estoy")
                    .font(.title2.bold())
                    .foregroundStyle(TifloVisual.primaryText)
                    .accessibilityAddTraits(.isHeader)
                Text("Reflexiones desde una forma propia de estar en el mundo.")
                    .font(.headline)
                    .foregroundStyle(TifloVisual.secondaryText)
                LabeledContent("Autor", value: "Tony Acosta")
                LabeledContent("ISBN", value: "9798185909218")
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Sobre el libro") {
                Text("Una colección de textos sobre la infancia, la ceguera, la memoria, la amistad, la dignidad, los miedos, la vida sencilla y esas pequeñas cosas que a veces entendemos mejor cuando dejamos de correr.")
                Text("No es un manual ni unas memorias al uso. Es, sencillamente, mi manera de mirar algunas de las cosas que nos pasan a todos.")
            }
            .foregroundStyle(TifloVisual.primaryText)
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Ediciones disponibles") {
                Link("Buscar la edición impresa en Amazon", destination: printURL)
                    .accessibilityHint("Abre una búsqueda del libro en la web de Amazon.")
                    .accessibilityAction(named: Text("Compartir enlace")) {
                        NativeShare.present(url: printURL)
                    }

                Link("Buscar la edición Kindle en Amazon", destination: kindleURL)
                    .accessibilityHint("Abre una búsqueda de la edición digital en la web de Amazon.")
                    .accessibilityAction(named: Text("Compartir enlace")) {
                        NativeShare.present(url: kindleURL)
                    }

                Text("Las compras se realizan fuera de TifloAcosta. Los enlaces abren los resultados correspondientes en Amazon; no garantizan disponibilidad.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Mi libro")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Explicación específica de la aplicación nativa iOS: los procesos de
/// seguimiento exclusivos de la web no deben describirse como parte de iOS.
struct NativePrivacyAccessibilityScreen: View {
    private let privacyURL = URL(string: "https://tifloacosta.com/privacidad/")!
    private let contactURL = URL(string: "mailto:tifloacosta@gmail.com")!

    var body: some View {
        List {
            Section("Privacidad en iOS") {
                Text("Puedes consultar contenidos de TifloAcosta sin crear una cuenta en la aplicación.")
                Text("Los ajustes de la aplicación y los documentos que decidas importar a TifloLector se guardan en el dispositivo.")
                Text("La actualización de noticias, vídeos, podcasts y recursos necesita conexión a Internet. Si abres enlaces externos, se aplican las condiciones y políticas de sus respectivos servicios.")
                Link("Leer la política de privacidad publicada", destination: privacyURL)
                    .accessibilityHint("Abre la política de privacidad en el sitio web de TifloAcosta.")
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Accesibilidad") {
                Text("TifloAcosta para iOS utiliza pantallas nativas compatibles con VoiceOver y los tamaños de texto de iOS.")
                Text("Los selectores y las acciones disponibles en los contenidos se pueden utilizar con los gestos de VoiceOver.")
                Text("La interfaz respeta el modo claro u oscuro y el contraste del sistema. El aspecto también puede ajustarse desde Configuración.")
                Link("Comunicar una barrera de accesibilidad", destination: contactURL)
                    .accessibilityHint("Abre la aplicación de correo para enviar un aviso sobre accesibilidad.")
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Privacidad y accesibilidad")
        .navigationBarTitleDisplayMode(.inline)
    }
}
