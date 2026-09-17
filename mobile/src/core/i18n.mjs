const DICTIONARIES = {
  es: {
    app: { title: 'TifloAcosta' },
    nav: { back: 'Volver' },
    home: {
      actualidad: 'Actualidad', search: 'Buscar', library: 'Biblioteca', favorites: 'Favoritos', videos: 'Vídeos',
      book: 'Mi libro', podcast: 'Podcast', contact: 'Contacto', settings: 'Configuración'
    },
    screen: {
      actualidad: 'Actualidad', search: 'Buscar', library: 'Biblioteca', favorites: 'Favoritos', videos: 'Vídeos',
      book: 'Mi libro', podcast: 'Podcast', contact: 'Contacto', settings: 'Configuración'
    },
    common: { empty: 'No hay contenido disponible en este momento.', open: 'Abrir' },
    search: {
      label: 'Título o palabra clave', placeholder: 'Por ejemplo: VoiceOver, Android, WhatsApp…', submit: 'Buscar',
      results: '{count} resultados', none: 'No se encontraron resultados.', resultsRegion: 'Resultados de búsqueda'
    },
    actualidad: { empty: 'No hay noticias disponibles en este momento.', original: 'Abrir fuente original' },
    library: { empty: 'No hay recursos disponibles en este momento.', open: 'Abrir documento' },
    videos: { empty: 'No hay vídeos disponibles en este momento.', open: 'Abrir vídeo' },
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
    placeholder: { favorites: 'Los favoritos se incorporarán en la siguiente fase.' }
  },
  en: {
    app: { title: 'TifloAcosta' },
    nav: { back: 'Back' },
    home: {
      actualidad: 'News', search: 'Search', library: 'Library', favorites: 'Favorites', videos: 'Videos',
      book: 'My book', podcast: 'Podcast', contact: 'Contact', settings: 'Settings'
    },
    screen: {
      actualidad: 'News', search: 'Search', library: 'Library', favorites: 'Favorites', videos: 'Videos',
      book: 'My book', podcast: 'Podcast', contact: 'Contact', settings: 'Settings'
    },
    common: { empty: 'No content is available right now.', open: 'Open' },
    search: {
      label: 'Title or keyword', placeholder: 'For example: VoiceOver, Android, WhatsApp…', submit: 'Search',
      results: '{count} results', none: 'No results found.', resultsRegion: 'Search results'
    },
    actualidad: { empty: 'There are no news items available right now.', original: 'Open original source' },
    library: { empty: 'There are no resources available right now.', open: 'Open document' },
    videos: { empty: 'There are no videos available right now.', open: 'Open video' },
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
    placeholder: { favorites: 'Favorites will be added in the next phase.' }
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
