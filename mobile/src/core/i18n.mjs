const DICTIONARIES = {
  es: {
    app: { title: 'TifloAcosta' },
    nav: { back: 'Volver' },
    home: {
      actualidad: 'Actualidad', search: 'Buscar', library: 'Biblioteca', downloads: 'Descargas', favorites: 'Favoritos', videos: 'Vídeos',
      book: 'Mi libro', podcast: 'Podcast', contact: 'Contacto', settings: 'Configuración'
    },
    screen: {
      actualidad: 'Actualidad', search: 'Buscar', library: 'Biblioteca', downloads: 'Descargas', favorites: 'Favoritos', videos: 'Vídeos',
      book: 'Mi libro', podcast: 'Podcast', contact: 'Contacto', settings: 'Configuración', share: 'Compartido con TifloAcosta'
    },
    common: { empty: 'No hay contenido disponible en este momento.', open: 'Abrir', share: 'Compartir' },
    search: {
      label: 'Título o palabra clave', placeholder: 'Por ejemplo: VoiceOver, Android, WhatsApp…', submit: 'Buscar',
      results: '{count} resultados', none: 'No se encontraron resultados.', resultsRegion: 'Resultados de búsqueda'
    },
    downloads: { intro: 'Elige qué quieres hacer.', link: 'Descargar desde un enlace', sounds: 'Buscar sonidos' },
    downloadsLink: {
      intro: 'Pega un enlace público o compartido y TifloAcosta intentará localizar los archivos descargables disponibles.',
      label: 'Pega aquí el enlace', placeholder: 'https://…', analyze: 'Analizar enlace', analyzing: 'Analizando enlace…',
      invalid: 'El enlace no es válido. Utiliza una dirección que empiece por http:// o https://.',
      resultsHeading: 'Archivos encontrados', filesFound: 'archivos encontrados.', save: 'Guardar', saved: 'Archivo guardado.',
      unknownSize: 'Tamaño desconocido', unknownType: 'Tipo no identificado', source: 'Procedencia',
      authenticationRequired: 'Este recurso necesita identificación en el servicio externo.',
      blocked: 'Este sitio ha rechazado el análisis automático de TifloAcosta.',
      externalNotice: 'Puedes continuar en el servicio externo. TifloAcosta no recibe ni guarda tus credenciales.',
      openExternal: 'Abrir sitio externo', retry: 'Reintentar análisis', timeout: 'El análisis tardó demasiado y se detuvo.',
      unreachable: 'No se pudo acceder a la página indicada.', noFiles: 'No se encontraron archivos descargables en ese enlace.',
      unsupported: 'Este enlace no puede analizarse automáticamente.', unavailable: 'El análisis avanzado no está disponible temporalmente.',
      saveFailed: 'No se pudo guardar el archivo.', defaultFilename: 'archivo'
    },
    soundSearch: {
      intro: 'Busca por palabra, elige una categoría o combina ambas opciones.',
      query: 'Buscar por palabra o frase', queryPlaceholder: 'Por ejemplo: campana, teléfono antiguo, pájaros…',
      category: 'Categoría', allCategories: 'Todas las categorías', search: 'Buscar sonidos', searching: 'Buscando sonidos…',
      needCriteria: 'Escribe algo para buscar o elige una categoría.', results: 'Resultados', noResults: 'No se encontraron sonidos con esos criterios.',
      unavailable: 'La búsqueda interna no está disponible ahora mismo. Puedes seguir usando los otros bancos de sonidos.',
      duration: 'Duración', format: 'Formato', size: 'Tamaño', license: 'Licencia', author: 'Autor', source: 'Banco',
      listen: 'Escuchar', openOriginal: 'Abrir original', externalHeading: 'Explorar otros bancos de sonidos',
      externalIntro: 'También puedes abrir estos bancos externos y continuar buscando allí.', openBank: 'Abrir'
    },
    share: {
      receivedYoutube: 'Has compartido un vídeo de YouTube.',
      receivedWeb: 'Has compartido una página web.',
      receivedDownload: 'Has compartido un enlace que TifloAcosta puede analizar para descargar.',
      receivedText: 'Has compartido texto.',
      play: 'Reproducir en TifloAcosta', read: 'Leer en modo accesible', downloads: 'Analizar descargas', search: 'Buscar en TifloAcosta',
      multiFound: 'Se han encontrado {count} enlaces.', chooseLink: 'Elige cuál quieres abrir.',
      preparing: 'Preparando lectura…', loadingHeading: 'Preparando contenido', retry: 'Reintentar', cancel: 'Cancelar y volver',
      backPage: 'Volver a la página anterior', backLinks: 'Volver a la lista de enlaces',
      unreliable: 'No hemos podido preparar una versión fiable de esta página.',
      timeout: 'La página tardó demasiado en responder.', unreachable: 'No hemos podido acceder a esta página.',
      unsupportedType: 'Este enlace no contiene una página que podamos preparar para lectura.',
      tooLarge: 'La página es demasiado grande para prepararla de forma segura.',
      tooManyRedirects: 'El enlace ha realizado demasiadas redirecciones.', httpError: 'La página ha respondido con un error.',
      invalid: 'El enlace no es válido.', source: 'Fuente', errorHeading: 'No hemos podido preparar el contenido',
      linkLabel: 'Enlace {number}', youtubeUnavailable: 'No hemos podido preparar este vídeo en el reproductor de TifloAcosta.'
    },
    favorites: { add: 'Añadir a favoritos', remove: 'Quitar de favoritos', empty: 'Todavía no has añadido ningún favorito.' },
    actualidad: { empty: 'No hay noticias disponibles en este momento.', original: 'Abrir fuente original' },
    library: { empty: 'No hay recursos disponibles en este momento.', open: 'Abrir documento', download: 'Guardar documento' },
    videos: {
      empty: 'No hay vídeos disponibles en este momento.', open: 'Abrir vídeo', play: 'Abrir reproductor',
      playerHeading: 'Reproductor de vídeo', controlsLabel: 'Controles accesibles del vídeo',
      rewindOneMinute: 'Retroceder 1 minuto', playControl: 'Reproducir', pauseControl: 'Pausar', forwardOneMinute: 'Avanzar 1 minuto',
      preparing: 'Preparando los controles accesibles del reproductor…',
      ready: 'Controles accesibles listos. Cada pulsación permite avanzar o retroceder 1 minuto.',
      unavailable: 'No se pudieron activar los controles accesibles adicionales. Puedes abrir el vídeo en YouTube.',
      closePlayer: 'Cerrar reproductor y volver a los vídeos', openYouTube: 'Abrir este vídeo en YouTube'
    },
    book: {
      title: 'La vida vista desde donde estoy', subtitle: 'Reflexiones desde una forma propia de estar en el mundo.',
      description: 'Una colección de textos sobre la infancia, la ceguera, la memoria, la amistad, la dignidad, los miedos, la vida sencilla y esas pequeñas cosas que a veces entendemos mejor cuando dejamos de correr.',
      description2: 'No es un manual ni unas memorias al uso. Es, sencillamente, mi manera de mirar algunas de las cosas que nos pasan a todos.',
      print: 'Comprar en Amazon', kindle: 'Comprar la edición Kindle'
    },
    podcast: { spotify: 'Spotify', apple: 'Apple Podcasts', ivoox: 'iVoox', podimo: 'Podimo', radio: 'radio.es' },
    contact: { whatsapp: 'WhatsApp', email: 'Correo electrónico', instagram: 'Instagram', facebook: 'Facebook — Canal TifloAcosta' },
    settings: {
      language: 'Idioma', spanish: 'Español', english: 'Inglés', textSize: 'Tamaño del texto', normal: 'Predeterminado',
      large: 'Grande', xlarge: 'Muy grande', max: 'Máximo', theme: 'Color y contraste', auto: 'Seguir el sistema',
      light: 'Alto contraste claro', dark: 'Alto contraste oscuro', spacing: 'Espaciado', comfortable: 'Cómodo', wide: 'Amplio',
      bold: 'Usar texto reforzado', reset: 'Restablecer ajustes'
    },
    notifications: {
      title: 'Notificaciones', explanation: 'Las notificaciones solo se activarán si tú lo decides. TifloAcosta no pedirá permiso al abrir la app.',
      activate: 'Activar notificaciones', openSettings: 'Abrir ajustes del sistema', unavailable: 'Las notificaciones nativas todavía no están disponibles en esta versión.',
      notRequested: 'Las notificaciones están desactivadas.', denied: 'El permiso de notificaciones está bloqueado. Puedes revisarlo en los ajustes del sistema.',
      authorized: 'Las notificaciones están autorizadas.'
    }
  },
  en: {
    app: { title: 'TifloAcosta' },
    nav: { back: 'Back' },
    home: {
      actualidad: 'News', search: 'Search', library: 'Library', downloads: 'Downloads', favorites: 'Favorites', videos: 'Videos',
      book: 'My book', podcast: 'Podcast', contact: 'Contact', settings: 'Settings'
    },
    screen: {
      actualidad: 'News', search: 'Search', library: 'Library', downloads: 'Downloads', favorites: 'Favorites', videos: 'Videos',
      book: 'My book', podcast: 'Podcast', contact: 'Contact', settings: 'Settings', share: 'Shared with TifloAcosta'
    },
    common: { empty: 'No content is available right now.', open: 'Open', share: 'Share' },
    search: {
      label: 'Title or keyword', placeholder: 'For example: VoiceOver, Android, WhatsApp…', submit: 'Search',
      results: '{count} results', none: 'No results found.', resultsRegion: 'Search results'
    },
    downloads: { intro: 'Choose what you want to do.', link: 'Download from a link', sounds: 'Search sounds' },
    downloadsLink: {
      intro: 'Paste a public or shared link and TifloAcosta will try to locate the downloadable files that are available.',
      label: 'Paste the link here', placeholder: 'https://…', analyze: 'Analyze link', analyzing: 'Analyzing link…',
      invalid: 'The link is not valid. Use an address beginning with http:// or https://.',
      resultsHeading: 'Files found', filesFound: 'files found.', save: 'Save', saved: 'File saved.',
      unknownSize: 'Size unknown', unknownType: 'Type not identified', source: 'Source',
      authenticationRequired: 'This resource requires sign-in on the external service.',
      blocked: 'This site refused TifloAcosta automated analysis.',
      externalNotice: 'You can continue on the external service. TifloAcosta does not receive or store your credentials.',
      openExternal: 'Open external site', retry: 'Retry analysis', timeout: 'The analysis took too long and was stopped.',
      unreachable: 'The specified page could not be reached.', noFiles: 'No downloadable files were found at that link.',
      unsupported: 'This link cannot be analyzed automatically.', unavailable: 'Advanced analysis is temporarily unavailable.',
      saveFailed: 'The file could not be saved.', defaultFilename: 'file'
    },
    soundSearch: {
      intro: 'Search by word, choose a category, or combine both options.',
      query: 'Search by word or phrase', queryPlaceholder: 'For example: bell, old telephone, birds…',
      category: 'Category', allCategories: 'All categories', search: 'Search sounds', searching: 'Searching sounds…',
      needCriteria: 'Enter something to search for or choose a category.', results: 'Results', noResults: 'No sounds were found for those criteria.',
      unavailable: 'Internal search is not available right now. You can still use the other sound banks.',
      duration: 'Duration', format: 'Format', size: 'Size', license: 'License', author: 'Author', source: 'Bank',
      listen: 'Listen', openOriginal: 'Open original', externalHeading: 'Explore other sound banks',
      externalIntro: 'You can also open these external banks and continue searching there.', openBank: 'Open'
    },
    share: {
      receivedYoutube: 'You shared a YouTube video.',
      receivedWeb: 'You shared a web page.',
      receivedDownload: 'You shared a link that TifloAcosta can analyze for downloads.',
      receivedText: 'You shared text.',
      play: 'Play in TifloAcosta', read: 'Read in accessible mode', downloads: 'Analyze downloads', search: 'Search in TifloAcosta',
      multiFound: '{count} links were found.', chooseLink: 'Choose the one you want to open.',
      preparing: 'Preparing reading…', loadingHeading: 'Preparing content', retry: 'Try again', cancel: 'Cancel and return',
      backPage: 'Return to the previous page', backLinks: 'Return to the link list',
      unreliable: 'We could not prepare a reliable version of this page.',
      timeout: 'The page took too long to respond.', unreachable: 'We could not reach this page.',
      unsupportedType: 'This link does not contain a page that can be prepared for reading.',
      tooLarge: 'The page is too large to prepare safely.',
      tooManyRedirects: 'The link went through too many redirects.', httpError: 'The page returned an error.',
      invalid: 'The link is not valid.', source: 'Source', errorHeading: 'We could not prepare the content',
      linkLabel: 'Link {number}', youtubeUnavailable: 'We could not prepare this video in the TifloAcosta player.'
    },
    favorites: { add: 'Add to favorites', remove: 'Remove from favorites', empty: 'You have not added any favorites yet.' },
    actualidad: { empty: 'There are no news items available right now.', original: 'Open original source' },
    library: { empty: 'There are no resources available right now.', open: 'Open document', download: 'Save document' },
    videos: {
      empty: 'There are no videos available right now.', open: 'Open video', play: 'Open player',
      playerHeading: 'Video player', controlsLabel: 'Accessible video controls', rewindOneMinute: 'Rewind 1 minute',
      playControl: 'Play', pauseControl: 'Pause', forwardOneMinute: 'Forward 1 minute',
      preparing: 'Preparing the accessible player controls…',
      ready: 'Accessible controls are ready. Each press moves forward or back 1 minute.',
      unavailable: 'The additional accessible controls could not be activated. You can open the video on YouTube.',
      closePlayer: 'Close player and return to videos', openYouTube: 'Open this video on YouTube'
    },
    book: {
      title: 'Life Seen from Where I Stand', subtitle: 'Reflections from my own way of being in the world.',
      description: 'A collection of reflections on childhood, blindness, memory, friendship, dignity, fears, simple living, and the small things we sometimes understand better when we stop rushing.',
      description2: 'It is neither a manual nor conventional memoir. It is simply my way of looking at some of the things that happen to all of us.',
      print: 'Buy on Amazon', kindle: 'Buy the Kindle edition'
    },
    podcast: { spotify: 'Spotify', apple: 'Apple Podcasts', ivoox: 'iVoox', podimo: 'Podimo', radio: 'radio.es' },
    contact: { whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram', facebook: 'Facebook — TifloAcosta Channel' },
    settings: {
      language: 'Language', spanish: 'Spanish', english: 'English', textSize: 'Text size', normal: 'Default',
      large: 'Large', xlarge: 'Very large', max: 'Maximum', theme: 'Color and contrast', auto: 'Follow system',
      light: 'High contrast light', dark: 'High contrast dark', spacing: 'Spacing', comfortable: 'Comfortable', wide: 'Wide',
      bold: 'Use bolder text', reset: 'Reset settings'
    },
    notifications: {
      title: 'Notifications', explanation: 'Notifications are enabled only if you choose to turn them on. TifloAcosta will not ask for permission when the app opens.',
      activate: 'Enable notifications', openSettings: 'Open system settings', unavailable: 'Native notifications are not available in this version yet.',
      notRequested: 'Notifications are turned off.', denied: 'Notification permission is blocked. You can review it in system settings.',
      authorized: 'Notifications are authorized.'
    }
  }
};

function readPath(object, path) {
  return String(path || '').split('.').reduce((value, key) => value && value[key], object);
}

export function text(lang, key) {
  const language = lang === 'en' ? 'en' : 'es';
  return readPath(DICTIONARIES[language], key) || readPath(DICTIONARIES.es, key) || key;
}

export { DICTIONARIES };
