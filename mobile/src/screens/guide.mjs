import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

// The guide describes controls that exist in the mobile app. Keep it in sync with the screens.
export const GUIDE = {
  es: {
    introduction: 'Esta guía explica qué puedes hacer en TifloAcosta y cómo utilizar cada sección. Abre el capítulo que te interese; los demás permanecerán cerrados. Puedes navegar por los encabezamientos con VoiceOver o TalkBack.',
    sections: [
      ['Primeros pasos', [
        'La pantalla de inicio reúne el buscador y las secciones de la aplicación. Esta guía aparece antes de ellas, para que puedas consultarla en cualquier momento.',
        'Activa un botón con doble toque si utilizas VoiceOver o TalkBack. Al entrar en una sección, utiliza su botón Volver para regresar al lugar desde el que la abriste.',
        'Los capítulos de esta guía son desplegables: activa su título para mostrar u ocultar las explicaciones.'
      ]],
      ['Buscar en TifloAcosta', [
        'El buscador general localiza contenido del catálogo: recursos, vídeos y noticias. No es un asistente de conversación ni busca automáticamente dentro de tus documentos personales.',
        'Escribe una palabra o frase relacionada con lo que buscas, por ejemplo «VoiceOver», «WhatsApp», «Android» o «braille». Después activa Buscar.',
        'Si una búsqueda devuelve demasiados resultados, utiliza expresiones más concretas, como «VoiceOver iPhone» en lugar de «iPhone». Si no aparecen resultados, prueba con una palabra más corta o con otro término.',
        'Los resultados se agrupan por tipo. Activa el título para abrir el contenido y utiliza el botón de regreso para volver.'
      ]],
      ['Actualidad', [
        'Consulta noticias recientes sobre accesibilidad y tecnología. Los contenidos incluyen título, fuente y fecha cuando están disponibles.',
        'Abre una noticia para leerla en modo accesible cuando se pueda preparar correctamente o continúa en su fuente original.',
        'Puedes guardar artículos en Favoritos para encontrarlos después. Las noticias y sus fechas dependen de las fuentes disponibles y de la última sincronización.'
      ]],
      ['Novedades de TifloAcosta', [
        'Esta sección muestra las publicaciones y recursos señalados como nuevos por TifloAcosta, ordenados por fecha editorial. No es la misma lista que Actualidad.',
        'La fecha de la última publicación no es necesariamente la fecha de la última conexión. Si no se han publicado recursos nuevos, la lista puede mantenerse igual aunque se actualice correctamente.',
        'Utiliza «Actualizar novedades» para solicitar una nueva comprobación. Si falla la conexión, la aplicación puede conservar la última lista recibida.'
      ]],
      ['Recursos y biblioteca de contenidos', [
        'Encuentra guías, documentos y materiales del catálogo, organizados por categorías. Activa el título o el botón de apertura de cada recurso.',
        'Cuando esté disponible, utiliza Guardar documento o Compartir para conservar o enviar un material. No confundas este catálogo con tu biblioteca personal de TifloLector.'
      ]],
      ['TifloLector: importar y organizar documentos', [
        'Entra en TifloLector para leer documentos propios, buscar títulos, continuar una lectura interrumpida y organizar la biblioteca.',
        'Elige Importar para añadir archivos admitidos por la instalación. Según el formato y el dispositivo, algunas funciones pueden no estar disponibles o requerir procesamiento adicional.',
        'La cola de lectura sirve para ordenar próximos documentos. También puedes consultar el estado de lectura, el porcentaje completado y la página de tu biblioteca.',
        'Los documentos que guardas en la biblioteca permanecen en el almacenamiento de la aplicación en el dispositivo. No supongas que están sincronizados automáticamente con otros teléfonos.'
      ]],
      ['TifloLector: abrir, escuchar y desplazarte', [
        'Activa el título de un documento para abrirlo en la última posición conservada. La apertura no debería iniciar la voz automáticamente: utiliza Reproducir cuando quieras escuchar.',
        'Los controles Anterior y Siguiente trabajan con la unidad de navegación seleccionada. Puedes elegir frase, párrafo, encabezamiento u otras unidades cuando el documento las contiene.',
        'Utiliza Ir a posición para saltar por porcentajes. En los PDF puede aparecer navegación por página. El lector muestra información sobre el progreso.',
        'Durante la reproducción puedes pausar y modificar opciones sin salir del documento. La disponibilidad de gestos especiales depende del lector de pantalla y del control empleado.'
      ]],
      ['TifloLector: voces y ajustes', [
        'Abre Ajustes de lectura para encontrar las opciones agrupadas. Audio y voz permite escoger voz y modificar parámetros de habla. Presentación visual permite cambiar tamaño, tipografía, espacios, tema y contraste.',
        'Dentro de General puedes establecer una unidad de avance predeterminada. Cada documento también puede conservar sus ajustes particulares.',
        'Para instalar nuevas voces en iPhone puede ser necesario utilizar Ajustes de iOS, Accesibilidad y el apartado correspondiente a voces del sistema. Regresa a la aplicación para actualizar la lista.',
        'Los controles permanecen organizados en menús plegables para evitar que ocupen toda la pantalla de lectura.'
      ]],
      ['TifloLector: acciones sobre cada archivo', [
        'En Mi biblioteca, el título sirve para abrir el documento. El botón «Acciones de [título]» permite trabajar con ese archivo sin necesidad de abrirlo antes.',
        'Desde ese menú puedes consultar información y progreso, abrir en una posición determinada, cambiar voz o apariencia, añadir o quitar de la cola, cambiar el título o estado y eliminarlo.',
        'Eliminar requiere confirmación. Los cambios de ajustes de un documento no tienen por qué cambiar los valores generales.',
        'El menú de acciones es un control accesible convencional. La selección de acciones mediante gestos verticales personalizados de VoiceOver es una mejora independiente, todavía no disponible como tal.'
      ]],
      ['TifloLector: buscar, marcar, traducir y reconocer texto', [
        'Dentro del documento, Buscar localiza expresiones. Puedes examinar resultados sin perder la posición actual y decidir si quieres continuar desde uno de ellos.',
        'Marcas permite guardar y recuperar posiciones importantes. La traducción puede crear una versión traducida para leerla cuando el servicio compatible está disponible.',
        'El reconocimiento OCR sirve para intentar recuperar texto de documentos o páginas escaneadas cuando el motor adecuado está disponible. Su precisión depende de la imagen.',
        'Si una traducción u OCR no se puede completar, no se debe presentar como si el resultado se hubiera guardado correctamente.'
      ]],
      ['Descargas', [
        'Utiliza Descargar desde un enlace para pegar una dirección de Internet y comprobar si contiene archivos descargables. La dirección debe comenzar por https:// o http://.',
        'La aplicación puede mostrar archivos encontrados, botones para guardar o una explicación si el sitio exige identificación, rechaza el análisis o no contiene descargas reconocibles.',
        'La búsqueda de sonidos es una herramienta distinta, con términos y categorías propios.'
      ]],
      ['Favoritos', [
        'Guarda recursos, noticias o vídeos mediante Añadir a favoritos cuando aparezca esa opción. Después entra en Favoritos para recuperarlos o quitarlos.'
      ]],
      ['Vídeos y YouTube accesible', [
        'La sección Vídeos permite explorar publicaciones propias y buscar vídeos públicos de YouTube por palabras.',
        'Cuando está disponible, utiliza el reproductor de TifloAcosta para acceder a los controles de reproducción con el lector de pantalla.',
        'La búsqueda pública no requiere iniciar sesión en Google. Las funciones personales de YouTube, como comentar o suscribirse, pueden necesitar autorización y no deben confundirse con los controles básicos de reproducción.'
      ]],
      ['Podcast', [
        'Consulta los episodios, elige uno y utiliza el reproductor integrado. Incluye reproducir, pausar, saltar hacia delante o atrás y consultar la posición.',
        'También pueden aparecer enlaces a servicios externos; al abrirlos saldrás al servicio correspondiente.'
      ]],
      ['Mi libro', [
        'Accede a la información y a los enlaces disponibles de «La vida vista desde donde estoy». Esta sección es independiente de la biblioteca de documentos personales.'
      ]],
      ['Contacto, privacidad y configuración', [
        'Contacto y redes reúne los canales para comunicarte con TifloAcosta. Privacidad y accesibilidad explica el tratamiento de datos y las consideraciones de accesibilidad.',
        'Configuración contiene preferencias generales de la aplicación, como idioma y presentación, cuando están disponibles. Los ajustes de un documento se gestionan desde TifloLector.',
        'Esta guía se irá ampliando conforme las funciones se incorporen y se comprueben en iOS y Android.'
      ]]
    ]
  },
  en: {
    introduction: 'This guide explains what TifloAcosta can do and how to use its sections. Expand the chapter you need; the other chapters stay closed. You can navigate by headings with VoiceOver or TalkBack.',
    sections: [
      ['Getting started', ['The home screen contains search and the app sections. This guide is placed before them.', 'With VoiceOver or TalkBack, double-tap to activate a button. Use Back to return to the section you left.', 'Activate any chapter heading to expand or collapse its instructions.']],
      ['Search TifloAcosta', ['Global search finds catalog resources, videos and news; it is not a conversational assistant or a search inside your personal documents.', 'Enter a keyword or phrase such as “VoiceOver”, “WhatsApp”, “Android” or “braille”, then choose Search.', 'Try more specific terms if there are too many results, or fewer words if there are none. Results are grouped by content type. Activate a result title to open it.']],
      ['News', ['Read recent accessibility and technology news, including dates and sources when available.', 'Open an article in accessible reading mode when supported, or continue at its original source.', 'You can save items to Favorites. Results depend on source feeds and synchronization.']],
      ['What is new', ['This section lists TifloAcosta resources explicitly marked as new, sorted by their editorial publication dates. It is distinct from the News feed.', 'The newest publication date is not the last refresh date. The list may remain unchanged even when a refresh succeeds.', 'Use Refresh what is new to check again. If the connection fails, the previously saved list may remain available.']],
      ['Resources', ['Explore guides and documents from the catalog by category. Open an entry or use its save and share actions when available.', 'This content catalog is separate from your personal TifloLector library.']],
      ['TifloLector: import and library', ['Import supported personal files, search your library by title, and resume reading.', 'Formats and advanced processing depend on the device. The reading queue and progress indicators help organize your library.', 'Documents stored by this app are local to the device; do not assume automatic synchronization with another device.']],
      ['TifloLector: reading and navigation', ['Activate a document title to reopen it at its saved position, then choose Play when you want speech.', 'Previous and Next move according to the selected navigation unit: sentence, paragraph, heading or another supported unit.', 'Use Go to position for percentage jumps, or PDF page navigation when available. You can pause and adjust settings during playback.']],
      ['TifloLector: voices and settings', ['Reading settings group Audio and voice, Visual presentation and General preferences.', 'Choose a system voice, adjust speech, font, contrast and spacing, and set a default navigation mode. Individual documents can override default settings.', 'On iPhone, installing system voices may require opening iOS Accessibility settings, then returning to refresh the list.']],
      ['TifloLector: document actions', ['Activate a title to open the document, or choose “Actions for [title]” to access its options without opening it.', 'View reading progress and file information, open at a given position, change audio or visual options, queue the book, rename it, change its status or delete it with confirmation.', 'Custom VoiceOver swipe-up and swipe-down actions are a separate improvement and are not implemented by this button.']],
      ['TifloLector: find, bookmarks, translation and OCR', ['Search inside a document and preview results without losing your original position; choose when to continue from a result.', 'Bookmarks save important positions. Translation can provide a translated reading version when a compatible service is available.', 'OCR can attempt to recover text from scans when supported; results vary with image quality. Unavailable actions should not be reported as successful.']],
      ['Downloads', ['Paste an http:// or https:// link into Download from a link to look for downloadable files.', 'A source may require external sign-in or reject automatic analysis. Sound search is a separate tool with its own keywords and categories.']],
      ['Favorites', ['Save and revisit resources, news or videos using Add to favorites when the option is offered. Remove items from the Favorites section.']],
      ['Videos and accessible YouTube', ['Explore TifloAcosta videos or search public YouTube videos by keyword. Use the built-in accessible player when available.', 'Public search does not require Google sign-in. Personal actions such as commenting or subscribing may require authorization and are separate from playback controls.']],
      ['Podcast', ['Choose an episode and play it using accessible pause, forward/back and position controls.', 'External listening services may also be linked.']],
      ['My book', ['Find information and available links for “La vida vista desde donde estoy”, separate from your personal document library.']],
      ['Contact, privacy and settings', ['Contact and social links provide ways to reach TifloAcosta. Privacy and accessibility explains data handling.', 'Settings holds general app preferences where available; per-document settings belong inside TifloLector.', 'The guide will be expanded as features are verified across iOS and Android.']]
    ]
  }
};

export function renderGuide({ root, router, preferences, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: preferences?.lang === 'en' ? 'TifloAcosta user guide' : 'Guía de uso de TifloAcosta', backLabel: t('nav.back') });
  const copy = GUIDE[preferences?.lang === 'en' ? 'en' : 'es'];
  addParagraph(root, copy.introduction, 'home-intro');
  const chapters = document.createElement('div');
  chapters.className = 'guide-chapters section-stack';
  chapters.setAttribute('aria-label', preferences?.lang === 'en' ? 'Guide chapters' : 'Capítulos de la guía');
  for (const [headingText, paragraphs] of copy.sections) {
    const chapter = document.createElement('details');
    chapter.className = 'reading-settings-disclosure guide-chapter';
    const summary = document.createElement('summary');
    const heading = document.createElement('h2');
    heading.textContent = headingText;
    summary.append(heading);
    chapter.append(summary);
    for (const paragraph of paragraphs) addParagraph(chapter, paragraph);
    chapters.append(chapter);
  }
  root.append(chapters);
}
