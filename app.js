(() => {
  'use strict';

  const APP_VERSION = '1.9';
  const core = window.TIFLO_APP_CORE;
  const data = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];
  const $ = (selector) => document.querySelector(selector);

  const els = {
    langEs: $('#lang-es'), langEn: $('#lang-en'), skip: $('.skip-link'), brand: $('.brand'), appHeading: $('#app-heading'),
    intro: $('#intro'), searchHeading: $('#search-heading'), searchLabel: $('label[for="search"]'),
    searchForm: $('#search-form'), search: $('#search'), searchButton: $('#search-button'), newsHeading: $('#news-heading'),
    newsCount: $('#news-count'), newsList: $('#news-list'), exploreHeading: $('#explore-heading'), categoryLabel: $('label[for="category"]'), category: $('#category'),
    favoritesButton: $('#favorites-button'), clearResults: $('#clear-results'), resultStatus: $('#result-status'), results: $('#resource-results'),
    videosHomeHeading: $('#videos-home-heading'), videosHomeIntro: $('#videos-home-intro'), videosHomeOpen: $('#videos-home-open'), youtubeHomeChannel: $('#youtube-home-channel'),
    bookHeading: $('#book-heading'), bookCover: $('#book-cover'), bookTitle: $('#book-title'), bookSubtitle: $('#book-subtitle'),
    bookDescription: $('#book-description'), bookDescription2: $('#book-description-2'), bookBuyPrint: $('#book-buy-print'),
    bookBuyKindle: $('#book-buy-kindle'), bookKindleNote: $('#book-kindle-note'),
    contactHeading: $('#contact-heading'), contactDirectHeading: $('#contact-direct-heading'), contactFollowHeading: $('#contact-follow-heading'),
    contactPodcastHeading: $('#contact-podcast-heading'), contactWhatsapp: $('#contact-whatsapp'), contactEmail: $('#contact-email'),
    contactInstagram: $('#contact-instagram'), contactFacebookChannel: $('#contact-facebook-channel'), contactFacebookPersonal: $('#contact-facebook-personal'),
    contactSpotify: $('#contact-spotify'), contactApplePodcasts: $('#contact-apple-podcasts'),
    contactIvoox: $('#contact-ivoox'), contactPodimo: $('#contact-podimo'), contactRadio: $('#contact-radio'),
    aboutHeading: $('#about-heading'), aboutText: $('#about-text'), externalLinksNote: $('#external-links-note'),
    privacyHeading: $('#privacy-heading'), privacySubheading: $('#privacy-subheading'), privacyText: $('#privacy-text'), accessibilityInfoHeading: $('#accessibility-info-heading'), accessibilityInfoText: $('#accessibility-info-text'),
    configHeading: $('#config-heading'), settingsToggle: $('#settings-toggle'), accessibilityHeading: $('#accessibility-heading'), settingsPanel: $('#settings-panel'),
    installSection: $('#install-section'), installHeading: $('#install-heading'), installIntro: $('#install-intro'),
    settingsIntro: $('#settings-intro'), settingsForm: $('#settings-form'), textLegend: $('#setting-text-legend'),
    textLabel: $('#setting-text-label'), textSize: $('#setting-text-size'), themeLegend: $('#setting-theme-legend'),
    themeLabel: $('#setting-theme-label'), theme: $('#setting-theme'), spacingLegend: $('#setting-spacing-legend'),
    spacingLabel: $('#setting-spacing-label'), spacing: $('#setting-spacing'), boldLegend: $('#setting-bold-legend'),
    bold: $('#setting-bold'), boldLabel: $('#setting-bold-label'), settingsReset: $('#settings-reset'),
    settingsStatus: $('#settings-status'), updateHeading: $('#update-heading'), appVersion: $('#app-version'),
    updateButton: $('#app-update'), updateStatus: $('#app-update-status'), footer: $('#footer-text')
  };

  const copy = {
    es: {
      documentTitle: 'TifloAcosta App — Recursos de accesibilidad', skip: 'Saltar al contenido principal', brandLabel: 'TifloAcosta, inicio', appHeading: 'TifloAcosta App',
      intro: 'Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.',
      searchHeading: 'Buscar recursos', searchLabel: 'Título o palabra clave', placeholder: 'Por ejemplo: VoiceOver, Android, WhatsApp…', searchButton: 'Buscar',
      news: 'Novedades', newsCount: n => `${n} novedad${n === 1 ? '' : 'es'} reciente${n === 1 ? '' : 's'}.`,
      explore: 'Explorar recursos', categoryLabel: 'Categoría', categoryPlaceholder: 'Seleccionar una categoría', favorites: 'Ver favoritos', clear: 'Limpiar resultados',
      configuration: 'Configuración', accessibility: 'Accesibilidad visual',
      videosHome: { heading:'Canal TifloAcosta en YouTube', intro:'Accede al catálogo completo de vídeos de TifloAcosta desde una pantalla pensada para buscar, ordenar y recorrer el canal con comodidad.', open:'Explorar todos los vídeos', channel:'Abrir Canal TifloAcosta en YouTube' },
      book: {
        heading: 'Mi libro', title: 'La vida vista desde donde estoy', subtitle: 'Reflexiones desde una forma propia de estar en el mundo.',
        description: 'Una colección de textos sobre la infancia, la ceguera, la memoria, la amistad, la dignidad, los miedos, la vida sencilla y esas pequeñas cosas que a veces entendemos mejor cuando dejamos de correr.',
        description2: 'No es un manual ni unas memorias al uso. Es, sencillamente, mi manera de mirar algunas de las cosas que nos pasan a todos.',
        coverAlt: 'Portada del libro La vida vista desde donde estoy, de Tony Acosta', buyPrint: 'Comprar en Amazon', buyKindle: 'Comprar la edición Kindle',
        kindleNote: 'Para evitar problemas de compra en móviles, la edición Kindle se abre en la web de Amazon. Después de comprarla, podrás acceder al libro desde Kindle.',
        printUrl: 'https://www.amazon.es/s?k=9798185909218&i=stripbooks', kindleUrl: 'https://www.amazon.es/s?k=La+vida+vista+desde+donde+estoy+Tony+Acosta&i=digital-text'
      },
      contact: 'Contacto y redes', contactDirect: 'Contacto', contactFollow: 'Sígueme', contactPodcast: 'Escucha el podcast',
      about: { heading: 'Sobre Tony', text: 'Tony Acosta es el autor del libro y la persona que presenta los contenidos y vías de contacto de TifloAcosta reunidos en esta aplicación.' },
      externalLinks: 'Los enlaces de esta sección, del catálogo, de Amazon y de YouTube abren servicios externos, sujetos a sus propias condiciones y prácticas de privacidad.',
      privacy: { heading: 'Privacidad y accesibilidad', privacyHeading: 'Privacidad', text: 'La app guarda en este navegador el idioma, los favoritos y los ajustes visuales. No necesitas crear una cuenta. Al visitar la app se carga GoatCounter para medir el uso del sitio y OneSignal para ofrecer las notificaciones; si activas estas últimas, el navegador solicita tu permiso. Los enlaces externos pueden recibir información técnica habitual de la navegación.', accessibilityHeading: 'Accesibilidad', accessibilityText: 'La app usa encabezados, etiquetas y controles nativos, incluye un enlace para saltar al contenido y avisos para lector de pantalla. Respeta preferencias del sistema y permite ajustar tamaño, contraste, espaciado y grosor del texto. Si encuentras una barrera, puedes comunicarla mediante las opciones de contacto anteriores.' },
      contactLabels: { whatsapp: 'Contactar por WhatsApp', email: 'Enviar correo electrónico', instagram: 'Instagram', facebookChannel: 'Facebook — Canal TifloAcosta', facebookPersonal: 'Facebook — Tony Acosta', spotify: 'Spotify', applePodcasts: 'Apple Podcasts', ivoox: 'iVoox', podimo: 'Podimo', radio: 'radio.es' },
      found: n => `${n} recurso${n === 1 ? '' : 's'} encontrado${n === 1 ? '' : 's'}.`, categoryFound: (cat,n) => `Categoría ${cat}. ${n} recurso${n === 1 ? '' : 's'} encontrado${n === 1 ? '' : 's'}.`, favFound: n => `${n} favorito${n === 1 ? '' : 's'}.`,
      noResults: 'No hay recursos que coincidan.', noFavorites: 'Todavía no hay favoritos guardados.', newBadge: 'Nuevo', open: 'Abrir recurso', addFav: 'Añadir a favoritos', removeFav: 'Quitar de favoritos',
      settings: {
        title: 'Ajustes de visualización y accesibilidad', toggle: 'Opciones de configuración visual', intro: 'La app respeta el tamaño y el modo de color del sistema. Además, puedes guardar aquí preferencias propias para TifloAcosta.',
        textLegend: 'Tamaño del texto', textLabel: 'Tamaño', textOptions: { normal:'Predeterminado', large:'Grande', xlarge:'Muy grande', max:'Máximo' },
        themeLegend: 'Color y contraste', themeLabel: 'Perfil de contraste', themeOptions: { auto:'Seguir el sistema', light:'Alto contraste claro', dark:'Alto contraste oscuro' },
        spacingLegend: 'Espaciado', spacingLabel: 'Separación entre líneas', spacingOptions: { normal:'Normal', comfortable:'Cómoda', wide:'Amplia' },
        boldLegend: 'Legibilidad', boldLabel: 'Usar texto reforzado', reset: 'Restablecer ajustes', saved: 'Preferencias guardadas.', resetDone: 'Ajustes restablecidos.'
      },
      update: {
        heading: 'Actualización', version: `Versión actual: ${APP_VERSION}`, button: 'Actualizar aplicación',
        checking: 'Comprobando la versión disponible…', reloading: 'Actualización preparada. Recargando TifloAcosta…',
        done: `Aplicación actualizada. Versión ${APP_VERSION}.`, error: 'No se pudo actualizar. Comprueba la conexión a Internet e inténtalo de nuevo.'
      },
      install: { heading:'Instalar la app', intro:'En iPhone o iPad, abre TifloAcosta App en Safari y utiliza Compartir > Añadir a pantalla de inicio. En navegadores compatibles de otros sistemas puede aparecer una opción equivalente de instalación.' },
 footer: `TifloAcosta App · Versión ${APP_VERSION}.`
    },
    en: {
      documentTitle: 'TifloAcosta App — Accessibility resources', skip: 'Skip to main content', brandLabel: 'TifloAcosta, home', appHeading: 'TifloAcosta App',
      intro: 'Accessibility and technology resources, organized so you can reach what you need without getting lost along the way.',
      searchHeading: 'Search resources', searchLabel: 'Title or keyword', placeholder: 'For example: VoiceOver, Android, WhatsApp…', searchButton: 'Search',
      news: 'What’s new', newsCount: n => `${n} recent item${n === 1 ? '' : 's'}.`,
      explore: 'Explore resources', categoryLabel: 'Category', categoryPlaceholder: 'Select a category', favorites: 'View favorites', clear: 'Clear results',
      configuration: 'Settings', accessibility: 'Visual accessibility',
      videosHome: { heading:'TifloAcosta YouTube Channel', intro:'Open the complete TifloAcosta video catalog in a screen designed for comfortable searching, sorting, and browsing.', open:'Explore all videos', channel:'Open TifloAcosta Channel on YouTube' },
      book: {
        heading: 'My book', title: 'La vida vista desde donde estoy', subtitle: 'Reflexiones desde una forma propia de estar en el mundo.',
        description: 'A collection of reflections on childhood, blindness, memory, friendship, dignity, fear, everyday life, and the small things we sometimes understand better when we stop rushing.',
        description2: 'It is not a manual or a conventional memoir. It is simply my way of looking at some of the things that happen to all of us. The book is currently available in Spanish.',
        coverAlt: 'Cover of La vida vista desde donde estoy by Tony Acosta', buyPrint: 'Buy on Amazon', buyKindle: 'Buy the Kindle edition',
        kindleNote: 'To avoid mobile purchase issues, the Kindle edition opens on the Amazon website. After purchasing it, you can access the book from Kindle.',
        printUrl: 'https://www.amazon.com/s?k=9798185909218&i=stripbooks', kindleUrl: 'https://www.amazon.com/s?k=La+vida+vista+desde+donde+estoy+Tony+Acosta&i=digital-text'
      },
      contact: 'Contact and social', contactDirect: 'Contact', contactFollow: 'Follow TifloAcosta', contactPodcast: 'Listen to the podcast',
      about: { heading: 'About Tony', text: 'Tony Acosta is the author of the book and the person presenting the TifloAcosta content and contact options collected in this application.' },
      externalLinks: 'Links in this section, the catalog, Amazon and YouTube open external services governed by their own terms and privacy practices.',
      privacy: { heading: 'Privacy and accessibility', privacyHeading: 'Privacy', text: 'The app stores your language, favorites and display settings in this browser. You do not need to create an account. GoatCounter loads when you visit to measure site use, and OneSignal loads to provide notifications; if you activate them, the browser asks for permission. External links may receive the usual technical browsing information.', accessibilityHeading: 'Accessibility', accessibilityText: 'The app uses headings, labels and native controls, and provides a skip link and screen-reader announcements. It respects system preferences and lets you adjust text size, contrast, spacing and weight. If you encounter a barrier, you can report it through the contact options above.' },
      contactLabels: { whatsapp: 'Contact on WhatsApp', email: 'Send email', instagram: 'Instagram', facebookChannel: 'Facebook — Canal TifloAcosta', facebookPersonal: 'Facebook — Tony Acosta', spotify: 'Spotify', applePodcasts: 'Apple Podcasts', ivoox: 'iVoox', podimo: 'Podimo', radio: 'radio.es' },
      found: n => `${n} resource${n === 1 ? '' : 's'} found.`, categoryFound: (cat,n) => `${cat} category. ${n} resource${n === 1 ? '' : 's'} found.`, favFound: n => `${n} favorite${n === 1 ? '' : 's'}.`,
      noResults: 'No matching resources were found.', noFavorites: 'No favorites have been saved yet.', newBadge: 'New', open: 'Open resource', addFav: 'Add to favorites', removeFav: 'Remove from favorites',
      settings: {
        title: 'Display and accessibility settings', toggle: 'Visual settings options', intro: 'The app respects your system text size and color mode. You can also save TifloAcosta-specific preferences here.',
        textLegend: 'Text size', textLabel: 'Size', textOptions: { normal:'Default', large:'Large', xlarge:'Extra large', max:'Maximum' },
        themeLegend: 'Color and contrast', themeLabel: 'Contrast profile', themeOptions: { auto:'Follow system', light:'High contrast light', dark:'High contrast dark' },
        spacingLegend: 'Spacing', spacingLabel: 'Line spacing', spacingOptions: { normal:'Normal', comfortable:'Comfortable', wide:'Wide' },
        boldLegend: 'Readability', boldLabel: 'Use stronger text', reset: 'Reset settings', saved: 'Preferences saved.', resetDone: 'Settings reset.'
      },
      update: {
        heading: 'Update', version: `Current version: ${APP_VERSION}`, button: 'Update application',
        checking: 'Checking the available version…', reloading: 'Update prepared. Reloading TifloAcosta…',
        done: `Application updated. Version ${APP_VERSION}.`, error: 'The app could not be updated. Check your internet connection and try again.'
      },
      install: { heading:'Install the app', intro:'On iPhone or iPad, open TifloAcosta App in Safari and use Share > Add to Home Screen. Compatible browsers on other systems may offer an equivalent installation option.' },
 footer: `TifloAcosta App · Version ${APP_VERSION}.`
    }
  };

  const defaultLang = navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
  const storage = core.getStorage(window);
  const storedLang = core.readStoredValue(storage,'tifloLang',defaultLang);
  let lang = storedLang === 'es' || storedLang === 'en' ? storedLang : defaultLang;
  const storedFavorites = core.readStoredJson(storage,'tifloFavorites',[]);
  let favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter(id=>typeof id==='string') : []);
  function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }

  const prefDefaults = { textSize:'normal', theme:'auto', lineSpacing:'normal', bold:false };
  const storedPrefs = core.readStoredJson(storage,'tifloDisplayPrefs',{});
  const validPrefs = storedPrefs && typeof storedPrefs === 'object' && !Array.isArray(storedPrefs) ? storedPrefs : {};
  let prefs = {
    textSize: ['normal','large','xlarge','max'].includes(validPrefs.textSize) ? validPrefs.textSize : prefDefaults.textSize,
    theme: ['auto','light','dark'].includes(validPrefs.theme) ? validPrefs.theme : prefDefaults.theme,
    lineSpacing: ['normal','comfortable','wide'].includes(validPrefs.lineSpacing) ? validPrefs.lineSpacing : prefDefaults.lineSpacing,
    bold: typeof validPrefs.bold === 'boolean' ? validPrefs.bold : prefDefaults.bold
  };

  const resourcesForLanguage = () => data.filter(item => item.lang === lang);
  const categories = () => [...new Set(resourcesForLanguage().map(item => item.category))].sort((a,b) => a.localeCompare(b,lang));
  const saveFavorites = () => core.writeStoredJson(storage,'tifloFavorites',[...favorites]);
  const savePrefs = () => core.writeStoredJson(storage,'tifloDisplayPrefs',prefs);

  function applyPrefs() {
    const root = document.documentElement;
    root.dataset.textSize = prefs.textSize;
    root.dataset.theme = prefs.theme;
    root.dataset.lineSpacing = prefs.lineSpacing;
    root.dataset.bold = String(Boolean(prefs.bold));
  }

  const resourceMenuCopy = {
    es: {
      heading: 'Opciones del documento',
      open: 'Abrir documento',
      download: 'Descargar documento',
      share: 'Compartir documento',
      addFavorite: 'Añadir a favoritos',
      removeFavorite: 'Quitar de favoritos',
      cancel: 'Cancelar',
      copied: 'El enlace del documento se ha copiado al portapapeles.',
      shareUnavailable: 'Este dispositivo no ofrece una opción compatible para compartir este documento.'
    },
    en: {
      heading: 'Document options',
      open: 'Open document',
      download: 'Download document',
      share: 'Share document',
      addFavorite: 'Add to favorites',
      removeFavorite: 'Remove from favorites',
      cancel: 'Cancel',
      copied: 'The document link has been copied to the clipboard.',
      shareUnavailable: 'This device does not provide a compatible option for sharing this document.'
    }
  };

  function extractDriveFileId(url) {
    const value=String(url||'');
    const pathMatch=value.match(/\/file\/d\/([^/?#]+)/);
    if(pathMatch) return pathMatch[1];
    try {
      const parsed=new URL(value);
      if(parsed.hostname==='drive.google.com'||parsed.hostname.endsWith('.drive.google.com')) return parsed.searchParams.get('id');
    } catch(error) {}
    return null;
  }

  function driveDownloadUrl(url) {
    const id=extractDriveFileId(url);
    return id?`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`:url;
  }

  async function shareResource(item,status) {
    const labels=resourceMenuCopy[lang];
    if(navigator.share) {
      try {
        await navigator.share({title:item.title,url:item.openUrl||item.url});
        return 'shared';
      } catch(error) {
        if(error&&error.name==='AbortError') return 'cancelled';
      }
    }
    try {
      if(navigator.clipboard&&window.isSecureContext) {
        await navigator.clipboard.writeText(item.openUrl||item.url);
        status.textContent=labels.copied;
        return 'copied';
      }
    } catch(error) {}
    status.textContent=labels.shareUnavailable;
    return 'unavailable';
  }

  function openResourceMenu(item,trigger) {
    const labels=resourceMenuCopy[lang];
    const dialog=document.createElement('dialog');
    dialog.className='panel';
    const heading=document.createElement('h2');
    heading.textContent=labels.heading;
    const headingId=`resource-dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    heading.id=headingId;
    dialog.setAttribute('aria-labelledby',headingId);
    const title=document.createElement('p');
    title.textContent=item.title;
    const actions=document.createElement('div');
    actions.className='resource-actions';
    const status=document.createElement('p');
    status.className='muted';
    status.setAttribute('aria-live','polite');
    status.setAttribute('aria-atomic','true');
    let focusAfterClose=trigger;
    let rerenderAfterClose=false;

    const makeButton=label=>{const button=document.createElement('button');button.type='button';button.textContent=label;return button;};
    const makeLink=(label,href,target='_blank')=>{const link=document.createElement('a');link.className='button-link';link.href=href;link.textContent=label;link.target=target;if(target==='_blank')link.rel='noopener noreferrer';return link;};
    const openLink=makeLink(labels.open,item.openUrl||item.url,item.openUrl?'_self':'_blank');
    const downloadLink=makeLink(labels.download,driveDownloadUrl(item.url));
    const shareButton=makeButton(labels.share);
    const favoriteButton=makeButton(favorites.has(item.id)?labels.removeFavorite:labels.addFavorite);
    const cancelButton=makeButton(labels.cancel);
    favoriteButton.setAttribute('aria-pressed',String(favorites.has(item.id)));

    openLink.addEventListener('click',()=>dialog.close());
    downloadLink.addEventListener('click',()=>dialog.close());
    shareButton.addEventListener('click',async()=>{
      status.textContent='';
      const result=await shareResource(item,status);
      if(result==='shared') dialog.close();
    });
    favoriteButton.addEventListener('click',()=>{
      const nowFavorite=!favorites.has(item.id);
      if(nowFavorite) favorites.add(item.id); else favorites.delete(item.id);
      saveFavorites();
      const card=trigger.closest?trigger.closest('.resource-card'):null;
      const cardFavorite=card?card.querySelector('[data-favorite-action="true"]'):null;
      if(cardFavorite) {
        cardFavorite.textContent=nowFavorite?copy[lang].removeFav:copy[lang].addFav;
        cardFavorite.setAttribute('aria-pressed',String(nowFavorite));
      }
      if(els.favoritesButton.getAttribute('data-active')==='true'&&!nowFavorite) {
        rerenderAfterClose=true;
        focusAfterClose=els.favoritesButton;
      }
      dialog.close();
    });
    cancelButton.addEventListener('click',()=>dialog.close());

    actions.append(openLink,downloadLink,shareButton,favoriteButton,cancelButton);
    dialog.append(heading,title,actions,status);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{
      dialog.remove();
      if(rerenderAfterClose) rerenderCurrentResults();
      if(focusAfterClose&&document.contains(focusAfterClose)) focusAfterClose.focus();
    },{once:true});
    dialog.showModal();
    openLink.focus();
  }

  function makeCard(item) {
    const c=copy[lang], article=document.createElement('div'); article.className='resource-card';
    const title=document.createElement('h3');
    const open=document.createElement('a'); open.href=item.url; open.textContent=item.title; open.setAttribute('aria-haspopup','dialog');
    open.addEventListener('click',event=>{event.preventDefault();openResourceMenu(item,open);});
    title.append(open);
    if(item.new){ const badge=document.createElement('span'); badge.className='badge'; badge.textContent=c.newBadge; title.append(' ',badge); }
    const meta=document.createElement('p'); meta.className='resource-meta'; meta.textContent=item.category;
    article.append(title,meta); return article;
  }

  function makeNewsItem(item) {
    const article=document.createElement('div'); article.className='news-item';
    const h3=document.createElement('h3'); const a=document.createElement('a'); a.href=item.url; a.textContent=item.title; a.setAttribute('aria-haspopup','dialog'); a.addEventListener('click',event=>{event.preventDefault();openResourceMenu(item,a);}); h3.append(a);
    const meta=document.createElement('p'); meta.textContent=item.category;
    article.append(h3,meta); return article;
  }

  function renderNews(){ const c=copy[lang],items=resourcesForLanguage().filter(item=>item.new).sort(core.compareNewsItems).slice(0,3); els.newsList.innerHTML=''; items.forEach(item=>els.newsList.append(makeNewsItem(item))); els.newsCount.textContent=c.newsCount(items.length); }
  function renderCategories(){ const c=copy[lang]; els.category.innerHTML=''; const p=document.createElement('option'); p.value='';p.textContent=c.categoryPlaceholder;els.category.append(p);categories().forEach(cat=>{const o=document.createElement('option');o.value=cat;o.textContent=cat;els.category.append(o);}); }
  function showResults(items,message,emptyMessage){ els.results.innerHTML='';els.results.hidden=false;els.clearResults.hidden=false;els.resultStatus.textContent=message;if(!items.length){const p=document.createElement('p');p.className='no-results';p.textContent=emptyMessage;els.results.append(p);return;}items.forEach(item=>els.results.append(makeCard(item))); }
  function clearResults(){els.results.innerHTML='';els.results.hidden=true;els.clearResults.hidden=true;els.resultStatus.textContent='';els.category.value='';els.search.value='';els.favoritesButton.removeAttribute('data-active');}
  function searchResources(){const c=copy[lang],term=els.search.value.trim();if(!term){clearResults();els.resultStatus.textContent=c.noResults;return;}els.category.value='';els.favoritesButton.removeAttribute('data-active');const items=resourcesForLanguage().filter(item=>core.resourceMatches(item,term));showResults(items,c.found(items.length),c.noResults);}
  function showCategory(cat){const c=copy[lang];els.search.value='';els.favoritesButton.removeAttribute('data-active');if(!cat){clearResults();return;}const items=resourcesForLanguage().filter(item=>item.category===cat);showResults(items,c.categoryFound(cat,items.length),c.noResults);}
  function showFavorites(){const c=copy[lang];els.search.value='';els.category.value='';els.favoritesButton.setAttribute('data-active','true');const items=resourcesForLanguage().filter(item=>favorites.has(item.id));showResults(items,c.favFound(items.length),c.noFavorites);}
  function rerenderCurrentResults(){if(els.favoritesButton.getAttribute('data-active')==='true')return showFavorites();if(els.category.value)return showCategory(els.category.value);if(els.search.value.trim())return searchResources();}

  function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}

  function setSelectOptions(select, options, selectedValue) {
    select.innerHTML='';
    Object.entries(options).forEach(([value,label])=>option(select,value,label));
    select.value=selectedValue;
  }

  function localizeSettings() {
    const s=copy[lang].settings;
    els.settingsToggle.textContent=s.toggle;
    els.settingsIntro.textContent=s.intro;
    els.textLegend.textContent=s.textLegend;
    els.textLabel.textContent=s.textLabel;
    setSelectOptions(els.textSize,s.textOptions,prefs.textSize);
    els.themeLegend.textContent=s.themeLegend;
    els.themeLabel.textContent=s.themeLabel;
    setSelectOptions(els.theme,s.themeOptions,prefs.theme);
    els.spacingLegend.textContent=s.spacingLegend;
    els.spacingLabel.textContent=s.spacingLabel;
    setSelectOptions(els.spacing,s.spacingOptions,prefs.lineSpacing);
    els.boldLegend.textContent=s.boldLegend;
    els.boldLabel.textContent=s.boldLabel;
    els.bold.checked=Boolean(prefs.bold);
    els.settingsReset.textContent=s.reset;
    els.settingsStatus.textContent='';
  }

  function toggleSettings() {
    const willExpand = els.settingsToggle.getAttribute('aria-expanded') !== 'true';
    els.settingsToggle.setAttribute('aria-expanded', String(willExpand));
    els.settingsPanel.hidden = !willExpand;
  }

  function saveDisplaySettings(message) {
    prefs={textSize:els.textSize.value,theme:els.theme.value,lineSpacing:els.spacing.value,bold:els.bold.checked};
    savePrefs();
    applyPrefs();
    els.settingsStatus.textContent=message;
  }

  function resetDisplaySettings() {
    prefs={...prefDefaults};
    savePrefs();
    applyPrefs();
    localizeSettings();
    els.settingsStatus.textContent=copy[lang].settings.resetDone;
  }

  function localizeBook(){
    const b=copy[lang].book;
    els.bookHeading.textContent=b.heading;
    els.bookTitle.textContent=b.title;
    els.bookSubtitle.textContent=b.subtitle;
    els.bookDescription.textContent=b.description;
    els.bookDescription2.textContent=b.description2;
    els.bookCover.alt=b.coverAlt;
    els.bookBuyPrint.textContent=b.buyPrint;
    els.bookBuyPrint.href=b.printUrl;
    els.bookBuyKindle.textContent=b.buyKindle;
    els.bookBuyKindle.href=b.kindleUrl;
    els.bookKindleNote.textContent=b.kindleNote;
  }

  function localizeContact(){
    const c=copy[lang], l=c.contactLabels;
    els.contactHeading.textContent=c.contact;
    els.contactDirectHeading.textContent=c.contactDirect;
    els.contactFollowHeading.textContent=c.contactFollow;
    els.contactPodcastHeading.textContent=c.contactPodcast;
    els.contactWhatsapp.textContent=l.whatsapp;
    els.contactEmail.textContent=l.email;
    els.contactInstagram.textContent=l.instagram;
    els.contactFacebookChannel.textContent=l.facebookChannel;
    els.contactFacebookPersonal.textContent=l.facebookPersonal;
    els.contactSpotify.textContent=l.spotify;
    els.contactApplePodcasts.textContent=l.applePodcasts;
    els.contactIvoox.textContent=l.ivoox;
    els.contactPodimo.textContent=l.podimo;
    els.contactRadio.textContent=l.radio;
  }

  function localizeInstall(){
    const i=copy[lang].install;
    els.installHeading.textContent=i.heading;
    els.installIntro.textContent=i.intro;
    els.installSection.hidden = isStandalone();
  }

  function localizeUpdate() {
    const u=copy[lang].update;
    els.updateHeading.textContent=u.heading;
    els.appVersion.textContent=u.version;
    els.updateButton.textContent=u.button;
    if(!els.updateStatus.dataset.persist) els.updateStatus.textContent='';
  }

  async function forceUpdateApplication() {
    const u=copy[lang].update;
    els.updateButton.disabled=true;
    els.updateStatus.dataset.persist='true';
    els.updateStatus.textContent=u.checking;
    try {
      const checkUrl=new URL('./index.html', location.href);
      checkUrl.searchParams.set('update_check', String(Date.now()));
      const response=await fetch(checkUrl.href, { cache:'no-store' });
      if(!response.ok) throw new Error(`Update check failed: ${response.status}`);

      if('serviceWorker' in navigator) {
        const appScope=new URL('./', location.href).href;
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter(reg=>reg.scope===appScope).map(reg=>reg.unregister()));
      }

      if('caches' in window) {
        const keys=await caches.keys();
        await Promise.all(keys.filter(key=>key.startsWith('tifloacosta-app-')).map(key=>caches.delete(key)));
      }

      els.updateStatus.textContent=u.reloading;
      const nextUrl=new URL('./', location.href);
      nextUrl.searchParams.set('tiflo_updated','1');
      nextUrl.searchParams.set('t',String(Date.now()));
      location.replace(nextUrl.href);
    } catch(error) {
      els.updateStatus.textContent=u.error;
      els.updateButton.disabled=false;
    }
  }

  function announceCompletedUpdate() {
    const params=new URLSearchParams(location.search);
    if(params.get('tiflo_updated')!=='1') return;
    delete els.updateStatus.dataset.persist;
    els.updateStatus.textContent=copy[lang].update.done;
    window.setTimeout(()=>{ els.updateStatus.textContent=''; },2500);
    params.delete('tiflo_updated');
    params.delete('t');
    const clean=`${location.pathname}${params.toString()?`?${params.toString()}`:''}${location.hash}`;
    if(history.replaceState) history.replaceState(null,'',clean);
  }

  function applyLanguage(){const c=copy[lang];document.documentElement.lang=lang;document.title=c.documentTitle;core.writeStoredValue(storage,'tifloLang',lang);els.langEs.setAttribute('aria-pressed',String(lang==='es'));els.langEn.setAttribute('aria-pressed',String(lang==='en'));els.skip.textContent=c.skip;els.brand.setAttribute('aria-label',c.brandLabel);els.appHeading.textContent=c.appHeading;els.intro.textContent=c.intro;els.searchHeading.textContent=c.searchHeading;els.searchLabel.textContent=c.searchLabel;els.search.placeholder=c.placeholder;els.searchButton.textContent=c.searchButton;els.newsHeading.textContent=c.news;els.exploreHeading.textContent=c.explore;els.categoryLabel.textContent=c.categoryLabel;els.favoritesButton.textContent=c.favorites;els.clearResults.textContent=c.clear;els.videosHomeHeading.textContent=c.videosHome.heading;els.videosHomeIntro.textContent=c.videosHome.intro;els.videosHomeOpen.textContent=c.videosHome.open;els.youtubeHomeChannel.textContent=c.videosHome.channel;els.aboutHeading.textContent=c.about.heading;els.aboutText.textContent=c.about.text;els.externalLinksNote.textContent=c.externalLinks;els.privacyHeading.textContent=c.privacy.heading;els.privacySubheading.textContent=c.privacy.privacyHeading;els.privacyText.textContent=c.privacy.text;els.accessibilityInfoHeading.textContent=c.privacy.accessibilityHeading;els.accessibilityInfoText.textContent=c.privacy.accessibilityText;els.configHeading.textContent=c.configuration;els.accessibilityHeading.textContent=c.accessibility;els.footer.textContent=c.footer;renderCategories();renderNews();localizeBook();localizeContact();localizeSettings();localizeInstall();localizeUpdate();clearResults();}

  els.langEs.addEventListener('click',()=>{lang='es';applyLanguage();});els.langEn.addEventListener('click',()=>{lang='en';applyLanguage();});els.searchForm.addEventListener('submit',e=>{e.preventDefault();searchResources();});els.category.addEventListener('change',()=>showCategory(els.category.value));els.favoritesButton.addEventListener('click',showFavorites);els.clearResults.addEventListener('click',clearResults);
  els.settingsToggle.addEventListener('click',toggleSettings);
  els.settingsForm.addEventListener('submit',e=>e.preventDefault());
  els.textSize.addEventListener('change',()=>saveDisplaySettings(copy[lang].settings.saved));
  els.theme.addEventListener('change',()=>saveDisplaySettings(copy[lang].settings.saved));
  els.spacing.addEventListener('change',()=>saveDisplaySettings(copy[lang].settings.saved));
  els.bold.addEventListener('change',()=>saveDisplaySettings(copy[lang].settings.saved));
  els.settingsReset.addEventListener('click',resetDisplaySettings);
  els.updateButton.addEventListener('click',forceUpdateApplication);
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(reg=>reg.update()).catch(()=>{}));}
  applyPrefs();applyLanguage();announceCompletedUpdate();
})();
