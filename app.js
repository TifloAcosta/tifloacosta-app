(() => {
  'use strict';

  const APP_VERSION = '0.9';
  const data = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];
  const $ = (selector) => document.querySelector(selector);

  const els = {
    langEs: $('#lang-es'), langEn: $('#lang-en'), intro: $('#intro'), searchHeading: $('#search-heading'),
    searchForm: $('#search-form'), search: $('#search'), searchButton: $('#search-button'), newsHeading: $('#news-heading'),
    newsCount: $('#news-count'), newsList: $('#news-list'), exploreHeading: $('#explore-heading'), category: $('#category'),
    favoritesButton: $('#favorites-button'), clearResults: $('#clear-results'), resultStatus: $('#result-status'), results: $('#resource-results'),
    moreHeading: $('#more-heading'), moreSelect: $('#more-select'), morePanel: $('#more-panel'),
    contactHeading: $('#contact-heading'), contactDirectHeading: $('#contact-direct-heading'), contactFollowHeading: $('#contact-follow-heading'),
    contactPodcastHeading: $('#contact-podcast-heading'), contactWhatsapp: $('#contact-whatsapp'), contactEmail: $('#contact-email'),
    contactInstagram: $('#contact-instagram'), contactFacebookChannel: $('#contact-facebook-channel'), contactFacebookPersonal: $('#contact-facebook-personal'),
    contactYoutube: $('#contact-youtube'), contactSpotify: $('#contact-spotify'), contactApplePodcasts: $('#contact-apple-podcasts'),
    contactIvoox: $('#contact-ivoox'), contactPodimo: $('#contact-podimo'), contactRadio: $('#contact-radio'),
    configHeading: $('#config-heading'), settingsToggle: $('#settings-toggle'), accessibilityHeading: $('#accessibility-heading'), settingsPanel: $('#settings-panel'),
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
      intro: 'Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.',
      searchHeading: 'Buscar recursos', searchLabel: 'Título o palabra clave', placeholder: 'Por ejemplo: VoiceOver, Android, WhatsApp…', searchButton: 'Buscar',
      news: 'Novedades', newsCount: n => `${n} novedad${n === 1 ? '' : 'es'} reciente${n === 1 ? '' : 's'}.`,
      explore: 'Explorar recursos', categoryLabel: 'Categoría', categoryPlaceholder: 'Seleccionar una categoría', favorites: 'Ver favoritos', clear: 'Limpiar resultados',
      configuration: 'Configuración', accessibility: 'Accesibilidad visual',
      more: 'Más de TifloAcosta', moreLabel: 'Elegir una opción', morePlaceholder: 'Seleccionar',
      contact: 'Contacto y redes', contactDirect: 'Contacto', contactFollow: 'Sígueme', contactPodcast: 'Escucha el podcast',
      contactLabels: { whatsapp: 'Contactar por WhatsApp', email: 'Enviar correo electrónico', instagram: 'Instagram', facebookChannel: 'Facebook — Canal TifloAcosta', facebookPersonal: 'Facebook — Tony Acosta', youtube: 'YouTube — Canal TifloAcosta', spotify: 'Spotify', applePodcasts: 'Apple Podcasts', ivoox: 'iVoox', podimo: 'Podimo', radio: 'radio.es' },
      moreOptions: { videos: 'Vídeos', book: 'Libro', community: 'Comunidad', social: 'Redes sociales', library: 'Biblioteca completa', install: 'Instalar la app', notifications: 'Notificaciones' },
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
      panels: {
        videos: '<h3>Vídeos</h3><p>La sección de vídeos se incorporará como área propia, con acceso sencillo al contenido de TifloAcosta y sin llenar la portada de reproductores.</p><p><a class="button-link" href="https://www.youtube.com/results?search_query=Canal+TifloAcosta">Buscar Canal TifloAcosta en YouTube</a></p>',
        book: '<h3>Libro</h3><p>Aquí se incorporará el acceso directo a la información y compra del libro de TifloAcosta. El enlace definitivo se añadirá cuando configuremos esta sección.</p>',
        community: '<h3>Comunidad</h3><p>Esta sección reunirá la información para formar parte de la comunidad TifloAcosta y acceder a sus materiales.</p>',
        social: '<h3>Redes sociales</h3><p>Aquí agruparemos los canales y redes oficiales de TifloAcosta sin recargar la pantalla principal.</p>',
        library: '<h3>Biblioteca completa</h3><p><a class="button-link" href="https://drive.google.com/drive/folders/1qUy0-ESqWhmIbYC00gpIdHHMZCPla_1r">Carpeta completa en español</a></p><p><a class="button-link" href="https://drive.google.com/drive/folders/1fVQp_eDGWoVO_fp7xFGdPllXMMWZalvx?usp=sharing">Carpeta completa en inglés</a></p><p><a class="button-link" href="https://tifloacosta.wixsite.com/tifloacosta-recursos">Página pública de recursos</a></p>',
        install: '<h3>Instalar la app</h3><p>En iPhone o iPad, abre TifloAcosta App en Safari y utiliza Compartir > Añadir a pantalla de inicio. En navegadores compatibles de otros sistemas puede aparecer una opción equivalente de instalación.</p>',
        notifications: '<h3>Notificaciones</h3><p>La estructura está preparada para incorporar avisos de nuevos contenidos después de publicar la PWA y comprobar su accesibilidad instalada.</p>'
      }, footer: 'TifloAcosta App · Versión 0.9 de prueba accesible.'
    },
    en: {
      intro: 'Accessibility and technology resources, organized so you can reach what you need without getting lost along the way.',
      searchHeading: 'Search resources', searchLabel: 'Title or keyword', placeholder: 'For example: VoiceOver, Android, WhatsApp…', searchButton: 'Search',
      news: 'What’s new', newsCount: n => `${n} recent item${n === 1 ? '' : 's'}.`,
      explore: 'Explore resources', categoryLabel: 'Category', categoryPlaceholder: 'Select a category', favorites: 'View favorites', clear: 'Clear results',
      configuration: 'Settings', accessibility: 'Visual accessibility',
      more: 'More from TifloAcosta', moreLabel: 'Choose an option', morePlaceholder: 'Select',
      contact: 'Contact and social', contactDirect: 'Contact', contactFollow: 'Follow TifloAcosta', contactPodcast: 'Listen to the podcast',
      contactLabels: { whatsapp: 'Contact on WhatsApp', email: 'Send email', instagram: 'Instagram', facebookChannel: 'Facebook — Canal TifloAcosta', facebookPersonal: 'Facebook — Tony Acosta', youtube: 'YouTube — Canal TifloAcosta', spotify: 'Spotify', applePodcasts: 'Apple Podcasts', ivoox: 'iVoox', podimo: 'Podimo', radio: 'radio.es' },
      moreOptions: { videos: 'Videos', book: 'Book', community: 'Community', social: 'Social media', library: 'Full library', install: 'Install the app', notifications: 'Notifications' },
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
      panels: {
        videos: '<h3>Videos</h3><p>The video area will be added as its own section, with simple access to TifloAcosta content and without filling the home screen with players.</p><p><a class="button-link" href="https://www.youtube.com/results?search_query=Canal+TifloAcosta">Find Canal TifloAcosta on YouTube</a></p>',
        book: '<h3>Book</h3><p>This area will provide direct access to information and purchasing options for the TifloAcosta book. The final link will be added when this section is configured.</p>',
        community: '<h3>Community</h3><p>This area will explain how to join the TifloAcosta community and access its materials.</p>',
        social: '<h3>Social media</h3><p>This area will group TifloAcosta’s official channels and social profiles without cluttering the home screen.</p>',
        library: '<h3>Full library</h3><p><a class="button-link" href="https://drive.google.com/drive/folders/1qUy0-ESqWhmIbYC00gpIdHHMZCPla_1r">Full Spanish folder</a></p><p><a class="button-link" href="https://drive.google.com/drive/folders/1fVQp_eDGWoVO_fp7xFGdPllXMMWZalvx?usp=sharing">Full English folder</a></p><p><a class="button-link" href="https://tifloacosta.wixsite.com/tifloacosta-recursos">Public resources page</a></p>',
        install: '<h3>Install the app</h3><p>On iPhone or iPad, open TifloAcosta App in Safari and use Share > Add to Home Screen. Compatible browsers on other systems may offer an equivalent install option.</p>',
        notifications: '<h3>Notifications</h3><p>The structure is ready for new-content alerts after the PWA is published and its installed accessibility has been verified.</p>'
      }, footer: 'TifloAcosta App · Accessible test version 0.9.'
    }
  };

  let lang = localStorage.getItem('tifloLang') || (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es');
  let favorites = new Set(JSON.parse(localStorage.getItem('tifloFavorites') || '[]'));
  function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }

  const prefDefaults = { textSize:'normal', theme:'auto', lineSpacing:'normal', bold:false };
  let prefs = { ...prefDefaults, ...JSON.parse(localStorage.getItem('tifloDisplayPrefs') || '{}') };

  const resourcesForLanguage = () => data.filter(item => item.lang === lang);
  const categories = () => [...new Set(resourcesForLanguage().map(item => item.category))].sort((a,b) => a.localeCompare(b,lang));
  const saveFavorites = () => localStorage.setItem('tifloFavorites', JSON.stringify([...favorites]));
  const savePrefs = () => localStorage.setItem('tifloDisplayPrefs', JSON.stringify(prefs));

  function applyPrefs() {
    const root = document.documentElement;
    root.dataset.textSize = prefs.textSize;
    root.dataset.theme = prefs.theme;
    root.dataset.lineSpacing = prefs.lineSpacing;
    root.dataset.bold = String(Boolean(prefs.bold));
  }

  function makeCard(item) {
    const c=copy[lang], article=document.createElement('article'); article.className='resource-card';
    const title=document.createElement('h3'); title.textContent=item.title;
    if(item.new){ const badge=document.createElement('span'); badge.className='badge'; badge.textContent=c.newBadge; title.append(' ',badge); }
    const meta=document.createElement('p'); meta.className='resource-meta'; meta.textContent=item.category;
    const actions=document.createElement('div'); actions.className='resource-actions';
    const open=document.createElement('a'); open.className='button-link'; open.href=item.url; open.textContent=c.open;
    const fav=document.createElement('button'); fav.type='button'; const isFav=favorites.has(item.id); fav.textContent=isFav?c.removeFav:c.addFav; fav.setAttribute('aria-pressed',String(isFav));
    fav.addEventListener('click',()=>{ if(favorites.has(item.id)) favorites.delete(item.id); else favorites.add(item.id); saveFavorites(); if(!els.results.hidden) rerenderCurrentResults(); });
    actions.append(open,fav); article.append(title,meta,actions); return article;
  }

  function makeNewsItem(item) {
    const article=document.createElement('article'); article.className='news-item';
    const h3=document.createElement('h3'); const a=document.createElement('a'); a.href=item.url; a.textContent=item.title; h3.append(a);
    const meta=document.createElement('p'); meta.textContent=item.category;
    article.append(h3,meta); return article;
  }

  function renderNews(){ const c=copy[lang],items=resourcesForLanguage().filter(item=>item.new).slice(0,3); els.newsList.innerHTML=''; items.forEach(item=>els.newsList.append(makeNewsItem(item))); els.newsCount.textContent=c.newsCount(items.length); }
  function renderCategories(){ const c=copy[lang]; els.category.innerHTML=''; const p=document.createElement('option'); p.value='';p.textContent=c.categoryPlaceholder;els.category.append(p);categories().forEach(cat=>{const o=document.createElement('option');o.value=cat;o.textContent=cat;els.category.append(o);}); }
  function showResults(items,message,emptyMessage){ els.results.innerHTML='';els.results.hidden=false;els.clearResults.hidden=false;els.resultStatus.textContent=message;if(!items.length){const p=document.createElement('p');p.className='no-results';p.textContent=emptyMessage;els.results.append(p);return;}items.forEach(item=>els.results.append(makeCard(item))); }
  function clearResults(){els.results.innerHTML='';els.results.hidden=true;els.clearResults.hidden=true;els.resultStatus.textContent='';els.category.value='';els.search.value='';els.favoritesButton.removeAttribute('data-active');}
  function searchResources(){const c=copy[lang],term=els.search.value.trim().toLocaleLowerCase(lang);if(!term){clearResults();els.resultStatus.textContent=c.noResults;return;}els.category.value='';els.favoritesButton.removeAttribute('data-active');const items=resourcesForLanguage().filter(item=>`${item.title} ${item.category}`.toLocaleLowerCase(lang).includes(term));showResults(items,c.found(items.length),c.noResults);}
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

  function renderMoreOptions(){const c=copy[lang],values=['','videos','book','library'];if(!isStandalone()) values.push('install');values.push('notifications');els.moreSelect.innerHTML='';values.forEach(v=>option(els.moreSelect,v,v?c.moreOptions[v]:c.morePlaceholder));}
  function showMore(value){if(!value){els.morePanel.hidden=true;els.morePanel.innerHTML='';return;}els.morePanel.hidden=false;els.morePanel.innerHTML=copy[lang].panels[value];}

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
    els.contactYoutube.textContent=l.youtube;
    els.contactSpotify.textContent=l.spotify;
    els.contactApplePodcasts.textContent=l.applePodcasts;
    els.contactIvoox.textContent=l.ivoox;
    els.contactPodimo.textContent=l.podimo;
    els.contactRadio.textContent=l.radio;
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
    els.updateStatus.dataset.persist='true';
    els.updateStatus.textContent=copy[lang].update.done;
    params.delete('tiflo_updated');
    params.delete('t');
    const clean=`${location.pathname}${params.toString()?`?${params.toString()}`:''}${location.hash}`;
    if(history.replaceState) history.replaceState(null,'',clean);
  }

  function applyLanguage(){const c=copy[lang];document.documentElement.lang=lang;localStorage.setItem('tifloLang',lang);els.langEs.setAttribute('aria-pressed',String(lang==='es'));els.langEn.setAttribute('aria-pressed',String(lang==='en'));els.intro.textContent=c.intro;els.searchHeading.textContent=c.searchHeading;els.search.previousElementSibling.textContent=c.searchLabel;els.search.placeholder=c.placeholder;els.searchButton.textContent=c.searchButton;els.newsHeading.textContent=c.news;els.exploreHeading.textContent=c.explore;els.category.previousElementSibling.textContent=c.categoryLabel;els.favoritesButton.textContent=c.favorites;els.clearResults.textContent=c.clear;els.moreHeading.textContent=c.more;els.moreSelect.previousElementSibling.textContent=c.moreLabel;els.configHeading.textContent=c.configuration;els.accessibilityHeading.textContent=c.accessibility;els.footer.textContent=c.footer;renderCategories();renderMoreOptions();renderNews();localizeContact();localizeSettings();localizeUpdate();clearResults();showMore('');}

  els.langEs.addEventListener('click',()=>{lang='es';applyLanguage();});els.langEn.addEventListener('click',()=>{lang='en';applyLanguage();});els.searchForm.addEventListener('submit',e=>{e.preventDefault();searchResources();});els.category.addEventListener('change',()=>showCategory(els.category.value));els.favoritesButton.addEventListener('click',showFavorites);els.clearResults.addEventListener('click',clearResults);els.moreSelect.addEventListener('change',()=>showMore(els.moreSelect.value));
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
