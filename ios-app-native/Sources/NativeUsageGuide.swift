import SwiftUI

// Ayuda por sección: una pantalla para elegir y otra para leer exclusivamente
// la información elegida. No se superpone a la navegación de la aplicación.
private struct NativeGuideSection: Identifiable {
    let id: String
    let spanishTitle: String
    let englishTitle: String
    let spanishParagraphs: [String]
    let englishParagraphs: [String]

    func title(english: Bool) -> String { english ? englishTitle : spanishTitle }
    func paragraphs(english: Bool) -> [String] { english ? englishParagraphs : spanishParagraphs }
}

private enum NativeGuideContent {
    static let sections: [NativeGuideSection] = [
        NativeGuideSection(
            id: "1",
            spanishTitle: "Actualidad",
            englishTitle: "News",
            spanishParagraphs: [
                "En Actualidad puedes consultar noticias sobre tecnología y accesibilidad. Utiliza el control ajustable Categoría para elegir un apartado, o el campo Buscar noticias para localizar un tema concreto.",
                "Al principio también hay un control ajustable para escoger Podcasts, Canales de YouTube o Todos los formatos. Cuando seleccionas contenido multimedia, aparecen los elementos de ese tipo en vez del listado de noticias.",
                "Abre un título para leerlo. En los resultados de noticias puedes usar las acciones de accesibilidad para leer, guardar en TifloLector, compartir, abrir la fuente original o añadir a Favoritos. Si hay más resultados, utiliza Mostrar diez más."
            ],
            englishParagraphs: [
                "News provides technology and accessibility articles. Use the Category adjustable control to select a topic, or Search news to look for specific information.",
                "The adjustable multimedia control lets you choose Podcasts, YouTube channels, or All formats. Choosing a media option displays those items instead of the news list.",
                "Open an article to read it. Accessibility actions include reading, saving to TifloLector, sharing, opening the original source, or saving as a favorite. Use Show ten more when available."
            ]
        ),
        NativeGuideSection(
            id: "2",
            spanishTitle: "Recursos",
            englishTitle: "Resources",
            spanishParagraphs: [
                "En Recursos encontrarás guías y materiales agrupados por categorías. Sitúate en Categoría y desliza hacia arriba o abajo con VoiceOver para elegir un apartado. Hasta que selecciones uno, no se muestra un listado de recursos.",
                "Abre el título que te interese para consultar su contenido. Los títulos incluyen acciones de accesibilidad para leer, guardar en TifloLector, descargar o compartir, según la disponibilidad del recurso.",
                "Si cambias de categoría, se mostrará únicamente el contenido del nuevo apartado. Puedes regresar a la pantalla anterior con el botón Atrás."
            ],
            englishParagraphs: [
                "Resources contains guides and materials organized by category. Use the Category adjustable control; with VoiceOver, swipe up or down to choose a category. The resource list appears after you make a selection.",
                "Open a title to read it. Accessibility actions provide reading, saving to TifloLector, downloading, or sharing as supported by the resource.",
                "Selecting another category shows only its resources. Use Back to return."
            ]
        ),
        NativeGuideSection(
            id: "3",
            spanishTitle: "TifloLector",
            englishTitle: "TifloLector",
            spanishParagraphs: [
                "TifloLector es el lector y biblioteca personal. Pulsa Importar para elegir archivos desde Archivos o consultar las bibliotecas en línea disponibles. También puedes recibir contenido mediante Compartir desde otras aplicaciones.",
                "En Ajustes configuras las preferencias generales de lectura, voz y presentación. Los controles ajustables de Filtrar documentos y Ordenar sirven para encontrar las obras; también puedes organizarlas por carpetas.",
                "En Mi biblioteca, abre el título para leer o reproducir. Las acciones de accesibilidad de cada obra permiten consultar información, ajustar ese documento, reproducir, mover a carpeta, cambiar el título o eliminarlo.",
                "Dentro de la lectura encontrarás controles y opciones adaptados al documento: reproducción, navegación, progreso, marcas y ajustes de audio o visuales. Algunas funciones y formatos dependen del tipo de archivo y de su contenido. Las marcas guardadas se consultan desde Marcas."
            ],
            englishParagraphs: [
                "TifloLector is your personal reading library. Choose Import to pick a file from Files or browse available online libraries. You can also send content using Share from another app.",
                "Settings contains reading, speech, and display preferences. Use the adjustable Filter documents and Sort controls to locate items and organize them into folders.",
                "Open a title in My library to read or play it. Accessibility actions let you inspect a book, configure its own settings, play, move it to a folder, rename, or delete it.",
                "Inside a document, available controls include playback, navigation, progress, bookmarks, audio and visual options. Available features depend on the file and its contents. Saved bookmarks appear under Marks."
            ]
        ),
        NativeGuideSection(
            id: "4",
            spanishTitle: "Recibidos",
            englishTitle: "Received items",
            spanishParagraphs: [
                "Recibidos reúne los elementos enviados a TifloAcosta desde la opción Compartir de otras aplicaciones, cuando el sistema puede recibirlos.",
                "Busca el documento compartido en esta sección y utiliza la acción disponible para incorporarlo a TifloLector. Una vez importado, ábrelo desde Mi biblioteca para leerlo; Recibidos no sustituye al lector.",
                "Puedes actualizar la lista y gestionar los elementos recibidos. Si un archivo no se reconoce, comprueba su formato y vuelve a compartirlo."
            ],
            englishParagraphs: [
                "Received items contains files sent to TifloAcosta through another app's Share menu, when supported by the system.",
                "Find the received item and use its import action to add it to TifloLector. Then open My library to read it. Received items is not itself the document reader.",
                "You can refresh the list and manage incoming items. If a file is not recognized, check its format and share it again."
            ]
        ),
        NativeGuideSection(
            id: "5",
            spanishTitle: "Novedades",
            englishTitle: "What's new",
            spanishParagraphs: [
                "En Novedades aparecen las incorporaciones recientes de TifloAcosta, como nuevos recursos y vídeos.",
                "Abre un recurso para leerlo. En los títulos podrás encontrar acciones para leer, guardar, descargar, compartir o añadir a Favoritos, según el contenido.",
                "Cuando haya un vídeo podrás abrirlo o compartirlo. Esta sección sirve para conocer lo que se ha incorporado, sin recorrer todas las categorías."
            ],
            englishParagraphs: [
                "What's new displays recent additions to TifloAcosta, including resources and videos.",
                "Open a resource to read it. Depending on the item, accessibility actions include reading, saving, downloading, sharing or adding it to Favorites.",
                "Videos can be opened or shared. This section helps you find new material without browsing every category."
            ]
        ),
        NativeGuideSection(
            id: "6",
            spanishTitle: "Descargar desde un enlace",
            englishTitle: "Download from a link",
            spanishParagraphs: [
                "Utiliza esta sección para guardar un archivo desde un enlace HTTPS. Escribe la dirección o pulsa Pegar enlace si la tienes copiada en el portapapeles.",
                "Pulsa Analizar enlace antes de descargar. La aplicación intentará reconocer el tipo de archivo y comprobar el acceso. Si el servidor impide la comprobación previa, el resultado puede confirmarse solo al descargar.",
                "Cuando esté disponible, pulsa Descargar en TifloAcosta. El archivo aparecerá en Mis descargas. Sobre su título, un doble toque lo importa a TifloLector; también puedes compartirlo o eliminarlo.",
                "Enlaces privados o que requieren permisos especiales pueden no permitir la descarga directa, incluso si el archivo existe."
            ],
            englishParagraphs: [
                "Use this section to save a file from an HTTPS link. Enter the address or choose Paste link if it is on the clipboard.",
                "Select Analyze link before downloading. The app attempts to identify the file and verify access. Some servers only allow access checks during the actual download.",
                "Choose Download to TifloAcosta when available. Saved files appear under My downloads. Double-tap a title to import it into TifloLector; sharing and deletion are also available.",
                "Private links or links requiring special permissions may not allow direct downloading."
            ]
        ),
        NativeGuideSection(
            id: "7",
            spanishTitle: "Favoritos",
            englishTitle: "Favorites",
            spanishParagraphs: [
                "Favoritos guarda las noticias, recursos y vídeos que hayas marcado para encontrarlos de nuevo.",
                "Abre un título para consultar o reproducir ese contenido. Con las acciones de accesibilidad puedes quitarlo de Favoritos sin eliminar el contenido original.",
                "Si alguna entrada no está disponible en el catálogo actualizado, la aplicación conserva su referencia para intentar mostrarla cuando vuelva a estar disponible."
            ],
            englishParagraphs: [
                "Favorites keeps news, resources, and videos you have marked for quick access.",
                "Open a title to read or play it. Accessibility actions let you remove an item from Favorites without deleting the original content.",
                "If an item is missing from the current catalog, its saved reference is kept so it can appear again when the content returns."
            ]
        ),
        NativeGuideSection(
            id: "8",
            spanishTitle: "Vídeos",
            englishTitle: "Videos",
            spanishParagraphs: [
                "Vídeos incluye el buscador accesible de YouTube y la lista de vídeos del canal TifloAcosta. Escribe una búsqueda, ajusta Tipo de resultados si lo necesitas y pulsa Buscar en YouTube.",
                "Puedes filtrar por vídeos, canales, vídeos cortos, directos o contenido con subtítulos. Abre el resultado que te interese; cuando haya más resultados, utiliza Mostrar diez resultados más.",
                "Los vídeos se abren en el reproductor de TifloAcosta. En los títulos también hay acciones de accesibilidad para reproducir y, cuando proceda, abrir en YouTube, compartir o comentar.",
                "Para usar las funciones de cuenta que las requieran, como consultar tus suscripciones o interactuar con YouTube, inicia sesión con Google. Buscar y reproducir vídeos no exige iniciar sesión.",
                "El listado del canal TifloAcosta permite ordenar por fecha y mostrar más vídeos."
            ],
            englishParagraphs: [
                "Videos provides accessible YouTube search and a list of TifloAcosta channel videos. Enter search terms, select a Result type if needed, and choose Search YouTube.",
                "Search filters include videos, channels, short videos, live streams, and captioned content. Open a result; choose Show ten more results when available.",
                "Videos open in TifloAcosta's player. Title accessibility actions can provide playback, opening YouTube, sharing or commenting when supported.",
                "Sign in with Google for account features such as subscriptions and eligible YouTube interactions. Searching and watching do not require signing in.",
                "The TifloAcosta channel list can be sorted by date and expanded."
            ]
        ),
        NativeGuideSection(
            id: "9",
            spanishTitle: "Podcast",
            englishTitle: "Podcasts",
            spanishParagraphs: [
                "En Podcast aparecen los episodios del canal TifloAcosta. Inicialmente se muestran los más recientes y puedes pulsar Mostrar diez más para consultar otros.",
                "Toca dos veces un episodio para escucharlo dentro de la aplicación. El reproductor permite pausar, reanudar, retroceder y avanzar 30 segundos, y modificar la posición.",
                "Puedes compartir un episodio y actualizar la lista. También encontrarás enlaces a plataformas externas donde está disponible el podcast."
            ],
            englishParagraphs: [
                "Podcasts lists episodes of the TifloAcosta channel. Recent episodes are shown first; choose Show ten more to see additional entries.",
                "Double-tap an episode to listen inside the app. Playback controls include pause, resume, skip back or forward 30 seconds, and seek.",
                "You can share an episode, refresh the list, or use links to other podcast platforms."
            ]
        ),
        NativeGuideSection(
            id: "10",
            spanishTitle: "Contacto y redes",
            englishTitle: "Contact and social networks",
            spanishParagraphs: [
                "Esta sección reúne información sobre TifloAcosta y los medios para contactar, además de los enlaces a YouTube, Instagram, Facebook y la web oficial.",
                "En Mi libro puedes consultar información sobre La vida vista desde donde estoy. Los enlaces de contacto o redes abren el servicio correspondiente fuera de la aplicación.",
                "Con VoiceOver, abre el enlace mediante doble toque. Algunos enlaces también permiten usar la acción de accesibilidad Compartir enlace."
            ],
            englishParagraphs: [
                "This section contains information about TifloAcosta, contact options and links to YouTube, Instagram, Facebook and the official website.",
                "My book provides information about La vida vista desde donde estoy. Contact and social links open the corresponding external service.",
                "With VoiceOver, double-tap to open a link. Some links also support a Share link accessibility action."
            ]
        ),
        NativeGuideSection(
            id: "11",
            spanishTitle: "Privacidad y accesibilidad",
            englishTitle: "Privacy and accessibility",
            spanishParagraphs: [
                "En Privacidad y accesibilidad puedes consultar la información de privacidad de la aplicación y sus opciones de accesibilidad.",
                "Lee la información para saber cómo se gestionan los datos y qué recursos utiliza TifloAcosta. Algunos enlaces pueden abrir páginas externas con sus propias condiciones.",
                "Puedes volver al inicio con el botón Atrás."
            ],
            englishParagraphs: [
                "Privacy and accessibility provides information about the app's privacy and accessibility provisions.",
                "Read the information to understand how information is handled and which services TifloAcosta uses. External links may have their own terms.",
                "Use Back to return to the main screen."
            ]
        ),
        NativeGuideSection(
            id: "12",
            spanishTitle: "Configuración",
            englishTitle: "Settings",
            spanishParagraphs: [
                "En Configuración puedes elegir el idioma de la aplicación mediante un control ajustable. La preferencia se conserva.",
                "Abre Ajustes visuales solo cuando quieras cambiar la presentación. Dentro encontrarás contraste, tamaño de letra, espaciado entre líneas y texto reforzado. Puedes restablecer estos ajustes.",
                "En Aplicación se muestra la versión instalada y el enlace a la web oficial. Los ajustes particulares de lectura se gestionan desde Ajustes de TifloLector."
            ],
            englishParagraphs: [
                "In Settings you can choose the app language using an adjustable control. Your preference is saved.",
                "Expand Visual settings only when you want to change the interface. Available options include contrast, text size, line spacing and heavier text, with a reset option.",
                "The Application section shows the installed version and a link to the website. Document reading preferences are configured in TifloLector Settings."
            ]
        )
    ]
}

struct NativeUsageGuideScreen: View {
    @AppStorage("native-ios-language") private var languageIndex = 0
    private var english: Bool { languageIndex == 1 }

    var body: some View {
        List {
            ForEach(NativeGuideContent.sections) { section in
                NavigationLink {
                    NativeUsageGuideDetailScreen(section: section, english: english)
                } label: {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(TifloVisual.brandRed)
                            .frame(width: 4, height: 28)
                            .accessibilityHidden(true)
                        Text(section.title(english: english))
                            .font(.body)
                            .foregroundStyle(TifloVisual.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                    }
                    .padding(.vertical, 4)
                }
                .accessibilityLabel(section.title(english: english))
                .accessibilityHint(english ? "Double-tap to read the instructions for this section." : "Doble toque para leer la guía de esta sección.")
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle(english ? "User guide" : "Guía de uso")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeUsageGuideDetailScreen: View {
    let section: NativeGuideSection
    let english: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ForEach(Array(section.paragraphs(english: english).enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(.body)
                        .foregroundStyle(TifloVisual.primaryText)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
            .padding(20)
        }
        .tifloScreenSurface()
        .navigationTitle(section.title(english: english))
        .navigationBarTitleDisplayMode(.inline)
    }
}
