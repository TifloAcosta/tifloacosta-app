const COPY = {
  es: {
    appName: 'TifloAcosta',
    back: 'Volver',
    share: 'Compartir',
    saveFile: 'Guardar archivo',
    empty: 'No hay contenido disponible en este momento.',
    home: {
      actualidad: 'Actualidad',
      search: 'Buscar',
      library: 'Biblioteca',
      favorites: 'Favoritos',
      videos: 'Vídeos',
      book: 'Libro',
      podcast: 'Podcast',
      contact: 'Contacto y redes',
      settings: 'Configuración',
      latestNews: 'Últimas noticias',
      viewAllNews: 'Ver toda la actualidad'
    },
    screen: {
      actualidad: { title: 'Actualidad', empty: 'Todavía no hay noticias disponibles.' },
      search: { title: 'Buscar' },
      library: { title: 'Biblioteca', empty: 'No hay documentos disponibles en este idioma.' },
      favorites: { title: 'Favoritos' },
      videos: { title: 'Vídeos', empty: 'No hay vídeos disponibles.' },
      book: { title: 'Libro' },
      podcast: { title: 'Podcast' },
      contact: { title: 'Contacto y redes' },
      settings: { title: 'Configuración' }
    },
    book: {
      title: 'La vida vista desde donde estoy',
      subtitle: 'Reflexiones desde una forma propia de estar en el mundo.',
      description: 'Una colección de textos sobre la infancia, la ceguera, la memoria, la amistad, la dignidad, los miedos, la vida sencilla y esas pequeñas cosas que a veces entendemos mejor cuando dejamos de correr.',
      amazon: 'Comprar en Amazon',
      kindle: 'Comprar la edición Kindle'
    },
    search: {
      label: 'Buscar en TifloAcosta',
      button: 'Buscar',
      noResults: 'No se encontraron resultados.',
      results: count => `${count} resultado${count === 1 ? '' : 's'}.`,
      groupResource: 'Biblioteca',
      groupNews: 'Actualidad',
      groupVideo: 'Vídeos'
    },
    contact: {
      whatsapp: 'WhatsApp',
      email: 'Correo electrónico',
      instagram: 'Instagram',
      facebookChannel: 'Facebook — Canal TifloAcosta',
      facebookTony: 'Facebook — Tony Acosta'
    },
    favorites: {
      add: 'Añadir a favoritos',
      remove: 'Quitar de favoritos',
      empty: 'Todavía no tienes favoritos guardados.',
      groupResource: 'Biblioteca',
      groupNews: 'Actualidad',
      groupVideo: 'Vídeos'
    },
    settings: {
      language: 'Idioma',
      spanish: 'Español',
      english: 'Inglés',
      textSize: 'Tamaño del texto',
      normal: 'Predeterminado',
      large: 'Grande',
      xlarge: 'Muy grande',
      max: 'Máximo',
      theme: 'Contraste',
      auto: 'Seguir el sistema',
      light: 'Alto contraste claro',
      dark: 'Alto contraste oscuro',
      spacing: 'Espaciado entre líneas',
      comfortable: 'Cómodo',
      wide: 'Amplio',
      bold: 'Usar texto reforzado',
      notificationsTitle: 'Notificaciones',
      notificationsDescription: 'Si quieres recibir avisos cuando haya algo importante en TifloAcosta, puedes activarlos aquí. La app no te pedirá permiso sin que tú lo decidas.',
      notificationsActivate: 'Activar notificaciones',
      notificationsGranted: 'Las notificaciones están activadas.',
      notificationsDenied: 'Las notificaciones están desactivadas en los ajustes del sistema.',
      notificationsUnavailable: 'No se pudo comprobar el estado de las notificaciones.'
    }
  },
  en: {
    appName: 'TifloAcosta',
    back: 'Back',
    share: 'Share',
    saveFile: 'Save file',
    empty: 'No content is available right now.',
    home: {
      actualidad: 'News',
      search: 'Search',
      library: 'Library',
      favorites: 'Favorites',
      videos: 'Videos',
      book: 'Book',
      podcast: 'Podcast',
      contact: 'Contact and social media',
      settings: 'Settings',
      latestNews: 'Latest news',
      viewAllNews: 'View all news'
    },
    screen: {
      actualidad: { title: 'News', empty: 'There are no news items available yet.' },
      search: { title: 'Search' },
      library: { title: 'Library', empty: 'There are no documents available in this language.' },
      favorites: { title: 'Favorites' },
      videos: { title: 'Videos', empty: 'There are no videos available.' },
      book: { title: 'Book' },
      podcast: { title: 'Podcast' },
      contact: { title: 'Contact and social media' },
      settings: { title: 'Settings' }
    },
    book: {
      title: 'La vida vista desde donde estoy',
      subtitle: 'Reflections from my own way of being in the world.',
      description: 'A collection of reflections on childhood, blindness, memory, friendship, dignity, fears, ordinary life and the small things we sometimes understand better when we stop rushing.',
      amazon: 'Buy on Amazon',
      kindle: 'Buy the Kindle edition'
    },
    search: {
      label: 'Search TifloAcosta',
      button: 'Search',
      noResults: 'No results found.',
      results: count => `${count} result${count === 1 ? '' : 's'}.`,
      groupResource: 'Library',
      groupNews: 'News',
      groupVideo: 'Videos'
    },
    contact: {
      whatsapp: 'WhatsApp',
      email: 'Email',
      instagram: 'Instagram',
      facebookChannel: 'Facebook — TifloAcosta Channel',
      facebookTony: 'Facebook — Tony Acosta'
    },
    favorites: {
      add: 'Add to favorites',
      remove: 'Remove from favorites',
      empty: 'You do not have any saved favorites yet.',
      groupResource: 'Library',
      groupNews: 'News',
      groupVideo: 'Videos'
    },
    settings: {
      language: 'Language',
      spanish: 'Spanish',
      english: 'English',
      textSize: 'Text size',
      normal: 'Default',
      large: 'Large',
      xlarge: 'Very large',
      max: 'Maximum',
      theme: 'Contrast',
      auto: 'Follow system',
      light: 'High-contrast light',
      dark: 'High-contrast dark',
      spacing: 'Line spacing',
      comfortable: 'Comfortable',
      wide: 'Wide',
      bold: 'Use reinforced text',
      notificationsTitle: 'Notifications',
      notificationsDescription: 'If you want alerts when something important happens in TifloAcosta, you can enable them here. The app will not ask for permission unless you choose to.',
      notificationsActivate: 'Enable notifications',
      notificationsGranted: 'Notifications are enabled.',
      notificationsDenied: 'Notifications are disabled in system settings.',
      notificationsUnavailable: 'The notification status could not be checked.'
    }
  }
};

export function text(lang, path) {
  const selected = COPY[lang] || COPY.es;
  return path.split('.').reduce((value, key) => value?.[key], selected) ?? '';
}

export function formatText(lang, path, ...args) {
  const value = text(lang, path);
  return typeof value === 'function' ? value(...args) : value;
}

export { COPY };
