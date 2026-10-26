import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

// Las explicaciones describen la navegación real de Android; no son una
// transcripción de controles iOS ni requieren permisos o servicios nuevos.
export const USAGE_GUIDE_SECTIONS = [
  {
    id: 'actualidad',
    title: { es: 'Actualidad', en: 'News' },
    paragraphs: {
      es: [
        'En Actualidad encontrarás noticias de tecnología y accesibilidad. Recorre los títulos con TalkBack y abre la noticia que quieras leer.',
        'La fuente y la fecha, cuando estén disponibles, ayudan a identificar cada noticia. Puedes guardar noticias en Favoritos y volver al inicio con Volver. Las opciones de búsqueda y categorías pueden variar según la versión instalada.'
      ],
      en: [
        'News contains technology and accessibility articles. Explore titles with TalkBack and open the article you want to read.',
        'When available, the source and publication date identify each article. You can save news to Favorites and use Back to return. Search and category options may vary by installed version.'
      ]
    }
  },
  {
    id: 'recursos',
    title: { es: 'Recursos', en: 'Resources' },
    paragraphs: {
      es: [
        'La Biblioteca reúne recursos y materiales organizados por categorías. Abre el selector Categoría, elige un apartado y recorre sus títulos con TalkBack.',
        'Según el tipo de recurso puedes abrirlo para leer, descargarlo, compartirlo o guardarlo entre tus favoritos. Cambiar de categoría no elimina ningún recurso.'
      ],
      en: [
        'Library contains resources and materials grouped by category. Open the Category selector, choose a group and explore titles with TalkBack.',
        'Depending on the item, you can open it to read, download, share or add it to Favorites. Switching categories does not delete any content.'
      ]
    }
  },
  {
    id: 'tiflolector',
    title: { es: 'TifloLector', en: 'TifloLector' },
    paragraphs: {
      es: [
        'TifloLector es tu biblioteca personal de lectura. Pulsa Importar para elegir documentos o comparte un archivo desde otra aplicación con TifloAcosta. Los documentos importados se gestionan en Mi biblioteca.',
        'Utiliza los filtros por estado y formato y las opciones de ordenación para encontrar tus libros. Puedes continuar una lectura, gestionar la cola, consultar información, cambiar títulos o eliminar un documento.',
        'Al abrir un archivo encontrarás los controles de lectura, navegación, progreso, marcas, voz y otros ajustes que admita su formato. La lectura en segundo plano, el OCR y la traducción tienen requisitos distintos según el documento y el dispositivo.'
      ],
      en: [
        'TifloLector is your personal reading library. Use Import to choose a document, or share a file from another app to TifloAcosta. Imported documents appear in My library.',
        'Use status and format filters and sorting to find a book. You can resume reading, manage the queue, inspect document details, rename or delete an item.',
        'Open a file for playback, navigation, progress, bookmarks, voice and other settings supported by that format. Background reading, OCR and translation depend on the document and device.'
      ]
    }
  },
  {
    id: 'compartir',
    title: { es: 'Compartir e importar', en: 'Sharing and importing' },
    paragraphs: {
      es: [
        'Desde otra aplicación de Android, abre el menú Compartir y elige TifloAcosta cuando esté disponible. También puedes seleccionar archivos mediante Importar desde TifloLector.',
        'Los documentos recibidos se incorporan al recorrido de importación de Android. No necesitas buscar una pantalla de Recibidos como la que puede aparecer en iPhone.',
        'Si un archivo no aparece, comprueba que se haya compartido el documento, no solo su nombre o un enlace privado. Algunos formatos requieren un proceso adicional.'
      ],
      en: [
        'In another Android app, open Share and select TifloAcosta when offered. You can also choose files from TifloLector using Import.',
        'Received documents follow Android’s import flow. You do not need to find a separate Received items screen like the one available on iPhone.',
        'If a file does not arrive, check whether the actual document was shared rather than only its name or a private link. Some file types need additional processing.'
      ]
    }
  },
  {
    id: 'novedades',
    title: { es: 'Novedades', en: 'New content' },
    paragraphs: {
      es: [
        'Novedades reúne incorporaciones recientes del catálogo de TifloAcosta. Abre el título que te interese para consultar el material.',
        'Si prefieres explorar todo lo disponible, entra en Biblioteca, Actualidad o Vídeos. Novedades es un acceso rápido, no sustituye esas secciones.'
      ],
      en: [
        'New content lists recent additions to the TifloAcosta catalog. Open a title to explore an item.',
        'To browse more, use Library, News or Videos. New content is a shortcut and does not replace those sections.'
      ]
    }
  },
  {
    id: 'descargas',
    title: { es: 'Descargas y enlaces', en: 'Downloads and links' },
    paragraphs: {
      es: [
        'En Descargas puedes abrir las herramientas disponibles para analizar un enlace o localizar sonidos. Para descargar un archivo desde Internet, entra en Descargar desde un enlace e introduce su dirección.',
        'Comprueba el resultado del análisis antes de guardar. Algunos enlaces privados o páginas que exigen identificación no permiten la descarga directa. Para incorporar un documento a TifloLector, utiliza su función Importar o Compartir.'
      ],
      en: [
        'Downloads provides tools to analyze a link or look for sound files. To download an Internet file, choose Download from a link and enter its address.',
        'Review the analysis before saving. Private links and sites requiring sign-in may block direct downloads. To add a document to TifloLector, use Import or Share.'
      ]
    }
  },
  {
    id: 'favoritos',
    title: { es: 'Favoritos', en: 'Favorites' },
    paragraphs: {
      es: [
        'En Favoritos encontrarás las noticias, recursos y vídeos que has señalado para regresar a ellos sin volver a buscarlos.',
        'Abre cada elemento para consultarlo. Si eliges Quitar de Favoritos, desaparece de tu lista personal, pero no se elimina el material original del catálogo.'
      ],
      en: [
        'Favorites contains news, resources and videos you have saved so you can find them again quickly.',
        'Open an item to explore it. Remove from Favorites removes the personal shortcut, not the original catalog item.'
      ]
    }
  },
  {
    id: 'videos',
    title: { es: 'Vídeos y YouTube', en: 'Videos and YouTube' },
    paragraphs: {
      es: [
        'En Vídeos puedes consultar los contenidos de TifloAcosta y buscar vídeos públicos de YouTube. Introduce la búsqueda, pulsa Buscar y utiliza Mostrar diez resultados más cuando aparezca.',
        'El reproductor dispone de controles de reproducción y posición accesibles con TalkBack. La búsqueda y reproducción públicas no requieren iniciar sesión.',
        'Las versiones que ofrecen funciones de cuenta permiten iniciar o cerrar sesión con Google y utilizar acciones como Me gusta y comentar. Esas funciones ya operativas deben conservarse; utiliza las opciones de cuenta existentes en tu instalación.'
      ],
      en: [
        'Videos lets you explore TifloAcosta content and search public YouTube videos. Enter a search, choose Search, and use Show ten more results when available.',
        'Playback and position controls are accessible using TalkBack. Public searches and playback do not require sign-in.',
        'Versions with account features let you sign in or out of Google and use actions such as Like and Comment. These existing features must be preserved; use the account controls in your installation.'
      ]
    }
  },
  {
    id: 'podcast',
    title: { es: 'Podcast', en: 'Podcasts' },
    paragraphs: {
      es: [
        'Podcast presenta episodios de TifloAcosta para escucharlos dentro de la aplicación. Recorre la lista, selecciona un episodio y utiliza los controles de reproducción.',
        'Puedes pausar, reanudar y avanzar o retroceder 30 segundos, además de modificar la posición cuando el episodio lo permite. También encontrarás enlaces a otros servicios de podcast.'
      ],
      en: [
        'Podcasts lists TifloAcosta episodes to play within the app. Explore the episode list, choose one and use the playback controls.',
        'You can pause, resume, skip forward or backward 30 seconds, and seek when supported. Links to other podcast services are also available.'
      ]
    }
  },
  {
    id: 'contacto',
    title: { es: 'Contacto, redes y Mi libro', en: 'Contact, social links and My book' },
    paragraphs: {
      es: [
        'Contacto reúne las vías de comunicación y redes de TifloAcosta. Los enlaces externos pueden abrir otras aplicaciones o el navegador de Android.',
        'Desde Mi libro puedes consultar la información de La vida vista desde donde estoy. Con TalkBack, sitúate en el enlace o botón y actívalo con doble toque.'
      ],
      en: [
        'Contact provides ways to reach TifloAcosta and its social pages. External links may open another Android app or a browser.',
        'My book provides information about La vida vista desde donde estoy. With TalkBack, focus a link or button and double-tap to activate it.'
      ]
    }
  },
  {
    id: 'privacidad',
    title: { es: 'Privacidad y accesibilidad', en: 'Privacy and accessibility' },
    paragraphs: {
      es: [
        'En Privacidad encontrarás información sobre la aplicación y su tratamiento de datos. Algunos servicios externos mantienen sus propias condiciones.',
        'Las pantallas se han preparado para navegación con TalkBack. Para recorrer botones y enlaces, desliza un dedo a derecha o izquierda; para activar el elemento enfocado, da dos toques.'
      ],
      en: [
        'Privacy explains the app and its handling of information. External services may have their own terms.',
        'Screens support navigation using TalkBack. Swipe right or left with one finger to move between controls; double-tap to activate the focused item.'
      ]
    }
  },
  {
    id: 'configuracion',
    title: { es: 'Configuración', en: 'Settings' },
    paragraphs: {
      es: [
        'En Configuración puedes elegir español o inglés y modificar opciones de visualización como el tamaño del texto y el tema. La aplicación guarda las preferencias disponibles.',
        'También puedes consultar información de la versión y los ajustes de notificaciones. Las opciones de voz, audio y lectura de documentos se gestionan en TifloLector, no en la configuración general de la aplicación.'
      ],
      en: [
        'Settings lets you choose Spanish or English and adjust visual options such as text size and theme. The app saves supported preferences.',
        'You can also check version information and notification settings. Voice, audio and document-reading preferences are managed in TifloLector rather than general app settings.'
      ]
    }
  }
];

const GUIDE_INTRO = {
  es: 'Selecciona un apartado para consultar su guía. Cada apartado se abre por separado; utiliza Volver para regresar a la lista.',
  en: 'Choose a topic to read its instructions. Each topic opens separately; use Back to return to the list.'
};

export function renderUsageGuide({
  root,
  router,
  preferences = { lang: 'es' },
  t,
  sectionId = ''
}) {
  clearScreen(root);
  const lang = preferences.lang === 'en' ? 'en' : 'es';
  const section = USAGE_GUIDE_SECTIONS.find(item => item.id === sectionId);

  addScreenHeader(root, {
    router,
    title: section ? section.title[lang] : t('screen.usage-guide'),
    backLabel: t('nav.back')
  });

  if (section) {
    const article = document.createElement('article');
    article.className = 'section-stack';
    for (const paragraph of section.paragraphs[lang]) addParagraph(article, paragraph);
    root.append(article);
    return;
  }

  addParagraph(root, GUIDE_INTRO[lang]);
  const nav = document.createElement('nav');
  nav.className = 'section-stack';
  nav.setAttribute('aria-label', t('screen.usage-guide'));

  for (const topic of USAGE_GUIDE_SECTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-entry';
    button.id = `usage-guide-topic-${topic.id}`;
    button.textContent = topic.title[lang];
    button.addEventListener('click', () => {
      router.navigate(`usage-guide/${topic.id}`, { originId: button.id });
    });
    nav.append(button);
  }

  root.append(nav);
}
