(() => {
  'use strict';

  const core = window.TIFLO_SOUND_CORE;
  const downloadCore = window.TIFLO_DOWNLOAD_CORE;
  const config = window.TIFLO_SOUND_CONFIG || { endpoint:'', providers:[], externalBanks:[] };
  if (!core || !downloadCore) return;

  const copy = {
    es: {
      heading:'Buscar sonidos', intro:'Busca un sonido por palabra, explora una categoría o combina ambas opciones. Los resultados indican siempre de qué banco proceden.',
      back:'Volver a Descargas', queryLabel:'Buscar por palabra o frase', queryPlaceholder:'Por ejemplo: campana, teléfono antiguo, pájaros…',
      categoryLabel:'Categoría', categoryAll:'Todas las categorías', providerLabel:'Banco de sonidos', providerAll:'Todos los bancos', search:'Buscar sonidos',
      searching:'Buscando sonidos…', needTermOrCategory:'Escribe algo para buscar o elige una categoría.', results:'Resultados',
      resultCount:n => `${n} sonido${n === 1 ? '' : 's'} encontrado${n === 1 ? '' : 's'}.`, noResults:'No se encontraron sonidos con esos criterios.',
      internalError:'No se pudo completar la búsqueda interna. Puedes probar de nuevo o explorar los otros bancos de sonidos.',
      duration:'Duración', format:'Formato', size:'Tamaño', provider:'Banco', license:'Licencia', author:'Autor', listen:'Escuchar', openToDownload:'Abrir para descargar',
      externalHeading:'Explorar otros bancos de sonidos', externalIntro:'También puedes abrir estos bancos externos y seguir buscando allí. Sus condiciones y accesibilidad dependen de cada servicio.',
      openBank:'Abrir', freesound:'Freesound',
      privacyNote:'Cuando utilizas Buscar sonidos, el término y la categoría elegidos pueden enviarse al servicio externo necesario para localizar resultados; TifloAcosta no guarda un historial personal de esas búsquedas de sonidos.'
    },
    en: {
      heading:'Search sounds', intro:'Search for a sound by word, browse a category, or combine both options. Results always identify the source bank.',
      back:'Back to Downloads', queryLabel:'Search by word or phrase', queryPlaceholder:'For example: bell, old telephone, birds…',
      categoryLabel:'Category', categoryAll:'All categories', providerLabel:'Sound bank', providerAll:'All banks', search:'Search sounds',
      searching:'Searching sounds…', needTermOrCategory:'Enter something to search for or choose a category.', results:'Results',
      resultCount:n => `${n} sound${n === 1 ? '' : 's'} found.`, noResults:'No sounds were found for those criteria.',
      internalError:'The internal search could not be completed. You can try again or explore the other sound banks.',
      duration:'Duration', format:'Format', size:'Size', provider:'Bank', license:'License', author:'Author', listen:'Listen', openToDownload:'Open to download',
      externalHeading:'Explore other sound banks', externalIntro:'You can also open these external banks and continue searching there. Their terms and accessibility depend on each service.',
      openBank:'Open', freesound:'Freesound',
      privacyNote:'When you use Search sounds, the term and category you choose may be sent to the external service needed to find results; TifloAcosta does not keep a personal history of those sound searches.'
    }
  };

  let section, form, queryInput, categorySelect, providerSelect, status, resultsSection, resultsHeading, resultCount, results, externalSection;
  let activeAudio = null;
  let currentResults = [];

  function language() { return document.documentElement.lang === 'en' ? 'en' : 'es'; }
  function t() { return copy[language()]; }
  function element(tag, options = {}) { const node=document.createElement(tag); if(options.id)node.id=options.id; if(options.className)node.className=options.className; if(options.text!==undefined)node.textContent=options.text; return node; }

  function makeBackButton() { const wrapper=element('p'); const button=element('button',{className:'button-link back-link',text:t().back}); button.type='button'; button.dataset.soundBack='true'; button.addEventListener('click',()=>{window.location.hash='#downloads';}); wrapper.append(button); return wrapper; }
  function addLabel(parent,forId,text){const label=element('label',{text});label.htmlFor=forId;parent.append(label);return label;}

  function populateCategories(){const selected=categorySelect.value;categorySelect.replaceChildren();const all=element('option',{text:t().categoryAll});all.value='';categorySelect.append(all);Object.entries(core.categories).forEach(([id,category])=>{const option=element('option',{text:category[language()]||category.es||id});option.value=id;categorySelect.append(option);});if([...categorySelect.options].some(o=>o.value===selected))categorySelect.value=selected;}
  function populateProviders(){const selected=providerSelect.value;providerSelect.replaceChildren();const all=element('option',{text:t().providerAll});all.value='all';providerSelect.append(all);if(Array.isArray(config.providers)&&config.providers.includes('freesound')){const option=element('option',{text:t().freesound});option.value='freesound';providerSelect.append(option);}providerSelect.value=[...providerSelect.options].some(o=>o.value===selected)?selected:'all';}

  function renderExternalBanks(){externalSection.replaceChildren();const heading=element('h3',{text:t().externalHeading});const intro=element('p',{text:t().externalIntro});const actions=element('div',{className:'resource-actions sound-bank-actions'});const externalBanks=Array.isArray(config.externalBanks)&&config.externalBanks.length?config.externalBanks:[{name:'Mixkit',url:'https://mixkit.co/free-sound-effects/'},{name:'Pixabay',url:'https://pixabay.com/sound-effects/'}];externalBanks.forEach(bank=>{const link=element('a',{className:'button-link',text:`${t().openBank} ${bank.name}`});link.href=bank.url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);});externalSection.append(heading,intro,actions);}

  function localizePrivacyNote(){const privacy=document.getElementById('privacy-text');if(!privacy)return;let note=document.getElementById('sound-search-privacy-note');if(!note){note=element('span',{id:'sound-search-privacy-note'});privacy.append(document.createTextNode(' '),note);}note.textContent=t().privacyNote;}

  function buildSurface(){const main=document.getElementById('main');if(!main||document.getElementById('sound-search-section'))return false;section=element('section',{id:'sound-search-section'});section.hidden=true;section.tabIndex=-1;section.setAttribute('aria-labelledby','sound-search-heading');section.append(makeBackButton());const heading=element('h2',{id:'sound-search-heading',text:t().heading});section.append(heading);section.append(element('p',{id:'sound-search-intro',className:'download-tool-intro',text:t().intro}));form=element('form',{id:'sound-search-form'});const queryWrap=element('div',{className:'sound-search-field'});addLabel(queryWrap,'sound-query',t().queryLabel);queryInput=element('input',{id:'sound-query'});queryInput.type='search';queryInput.autocomplete='off';queryInput.placeholder=t().queryPlaceholder;queryWrap.append(queryInput);const filters=element('div',{className:'download-controls sound-search-filters'});const categoryWrap=element('div');addLabel(categoryWrap,'sound-category',t().categoryLabel);categorySelect=element('select',{id:'sound-category'});categoryWrap.append(categorySelect);const providerWrap=element('div');addLabel(providerWrap,'sound-provider',t().providerLabel);providerSelect=element('select',{id:'sound-provider'});providerWrap.append(providerSelect);filters.append(categoryWrap,providerWrap);const submit=element('button',{id:'sound-search-submit',text:t().search});submit.type='submit';form.append(queryWrap,filters,submit);section.append(form);status=element('p',{id:'sound-status',className:'muted'});status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');section.append(status);resultsSection=element('section',{id:'sound-results-section'});resultsSection.hidden=true;resultsSection.setAttribute('aria-labelledby','sound-results-heading');resultsHeading=element('h3',{id:'sound-results-heading',text:t().results});resultsHeading.tabIndex=-1;resultCount=element('p',{id:'sound-result-count',className:'muted'});resultCount.setAttribute('aria-live','polite');results=element('div',{id:'sound-results',className:'download-results sound-results'});resultsSection.append(resultsHeading,resultCount,results);section.append(resultsSection);externalSection=element('section',{id:'sound-external-banks',className:'sound-external-banks'});section.append(externalSection);section.append(makeBackButton());main.append(section);populateCategories();populateProviders();renderExternalBanks();form.addEventListener('submit',event=>{event.preventDefault();searchSounds();});return true;}

  function setStatus(message,focus=false){status.textContent=message;if(focus&&message){status.tabIndex=-1;status.focus();}}
  function stopActiveAudio(){if(!activeAudio)return;activeAudio.pause();activeAudio.currentTime=0;activeAudio=null;}
  function meta(text){return element('p',{className:'download-result-meta',text});}

  function resultCard(item){const card=element('article',{className:'download-result-card sound-result-card'});card.append(element('h4',{text:item.name}));if(item.duration!==null)card.append(meta(`${t().duration}: ${core.formatDuration(item.duration)}`));if(item.format)card.append(meta(`${t().format}: ${String(item.format).toUpperCase()}`));if(item.size!==null)card.append(meta(`${t().size}: ${downloadCore.formatBytes(item.size)}`));card.append(meta(`${t().provider}: ${t().freesound}`));if(item.license)card.append(meta(`${t().license}: ${item.license}`));if(item.author)card.append(meta(`${t().author}: ${item.author}`));if(item.previewUrl){const audio=element('audio',{className:'sound-preview'});audio.controls=true;audio.preload = 'none';audio.src=item.previewUrl;audio.setAttribute('aria-label',`${t().listen}: ${item.name}`);audio.addEventListener('play',()=>{if(activeAudio&&activeAudio!==audio)activeAudio.pause();activeAudio=audio;});audio.addEventListener('ended',()=>{if(activeAudio===audio)activeAudio=null;});card.append(audio);}if(item.pageUrl){const link=element('a',{className:'button-link',text:`${t().openToDownload}: ${item.name}`});link.href=item.pageUrl;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}return card;}

  function renderResults(items){stopActiveAudio();currentResults=Array.isArray(items)?items:[];results.replaceChildren();resultsSection.hidden=false;currentResults.forEach(item=>results.append(resultCard(item)));resultCount.textContent=currentResults.length?t().resultCount(currentResults.length):t().noResults;setStatus('');resultsHeading.focus();}

  async function callSearch(body){if(!config.endpoint)throw new Error('missing endpoint');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const payload=await response.json();if(!payload||typeof payload!=='object')throw new Error('invalid response');return payload;}finally{clearTimeout(timer);}}

  async function searchSounds(){const valid=core.validateSearch(queryInput.value,categorySelect.value);if(!valid.ok){resultsSection.hidden=true;setStatus(t().needTermOrCategory,true);return;}stopActiveAudio();resultsSection.hidden=true;setStatus(t().searching);const query=core.buildProviderQuery(valid.term,valid.category);try{const payload=await callSearch({query,category:valid.category,provider:providerSelect.value||'all',page:1});if(payload.status!=='ok'||!Array.isArray(payload.items)){setStatus(t().internalError,true);return;}const normalized=payload.items.map(item=>core.normalizeResult(item,item.provider||payload.provider||'freesound'));renderResults(core.mergeResults([normalized],20));}catch(error){setStatus(t().internalError,true);}}

  function localize(){if(!section)return;section.querySelector('#sound-search-heading').textContent=t().heading;section.querySelector('#sound-search-intro').textContent=t().intro;section.querySelector('label[for="sound-query"]').textContent=t().queryLabel;queryInput.placeholder=t().queryPlaceholder;section.querySelector('label[for="sound-category"]').textContent=t().categoryLabel;section.querySelector('label[for="sound-provider"]').textContent=t().providerLabel;section.querySelector('#sound-search-submit').textContent=t().search;resultsHeading.textContent=t().results;section.querySelectorAll('[data-sound-back]').forEach(button=>{button.textContent=t().back;});populateCategories();populateProviders();renderExternalBanks();localizePrivacyNote();if(!resultsSection.hidden){results.replaceChildren();currentResults.forEach(item=>results.append(resultCard(item)));resultCount.textContent=currentResults.length?t().resultCount(currentResults.length):t().noResults;}}

  function applyVisibility(){if(!section)return;const active=window.location.hash.replace(/^#/,'')==='downloads-sounds';section.hidden=!active;if(!active){stopActiveAudio();return;}['home-hero','home-blocks','global-search-section','resources-view','news-view','book-section','contact-section','privacy-section','config-section','downloads-hub','downloads-section'].forEach(id=>{const node=document.getElementById(id);if(node)node.hidden=true;});document.querySelectorAll('.site-header,.site-footer,.skip-link').forEach(node=>{node.hidden=true;});section.hidden=false;queryInput.focus();}

  if(!buildSurface())return;localize();applyVisibility();window.addEventListener('hashchange',applyVisibility);document.getElementById('lang-es')?.addEventListener('click',()=>setTimeout(localize,0));document.getElementById('lang-en')?.addEventListener('click',()=>setTimeout(localize,0));
})();
