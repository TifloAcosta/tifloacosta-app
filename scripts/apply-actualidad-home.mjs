import { readFile, writeFile } from 'node:fs/promises';

async function patchFile(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`${path}: no change`);
    return false;
  }
  await writeFile(path, after, 'utf8');
  console.log(`${path}: updated`);
  return true;
}

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Patch anchor not found: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchIndex(source) {
  if (source.includes('id="actualidad-home-section"')) return source;

  source = replaceOnce(
    source,
    `  </section>\n\n  <section>\n    <h2 id="search-heading">Buscar recursos</h2>`,
    `  </section>\n\n  <section id="actualidad-home-section">\n    <div class="section-head">\n      <h2 id="actualidad-home-heading">Actualidad</h2>\n      <p id="actualidad-home-count" class="muted"></p>\n    </div>\n    <p id="actualidad-home-intro">Noticias y novedades de accesibilidad y tecnología seleccionadas por TifloAcosta.</p>\n    <div id="actualidad-home-list" class="news-list"></div>\n    <p><a class="button-link" id="actualidad-home-open" href="actualidad.html">Ver toda la actualidad</a></p>\n  </section>\n\n  <section>\n    <h2 id="search-heading">Buscar recursos</h2>`,
    'home Actualidad section'
  );

  source = replaceOnce(
    source,
    `<script src="app-core.js?v=1.3"></script>\n<script src="app.js?v=2.1"></script>`,
    `<script src="app-core.js?v=1.3"></script>\n<script src="actualidad-core.js?v=1.0"></script>\n<script src="app.js?v=2.1"></script>`,
    'Actualidad core script'
  );

  return source;
}

function patchApp(source) {
  if (source.includes("const coreActualidad = window.TIFLO_ACTUALIDAD_CORE;")) return source;

  source = replaceOnce(
    source,
    `  const core = window.TIFLO_APP_CORE;\n`,
    `  const core = window.TIFLO_APP_CORE;\n  const coreActualidad = window.TIFLO_ACTUALIDAD_CORE;\n`,
    'Actualidad core binding'
  );

  source = replaceOnce(
    source,
    `    intro: $('#intro'), searchHeading: $('#search-heading'), searchLabel: $('label[for="search"]'),`,
    `    intro: $('#intro'), actualidadHomeHeading: $('#actualidad-home-heading'), actualidadHomeCount: $('#actualidad-home-count'),\n    actualidadHomeIntro: $('#actualidad-home-intro'), actualidadHomeList: $('#actualidad-home-list'), actualidadHomeOpen: $('#actualidad-home-open'),\n    searchHeading: $('#search-heading'), searchLabel: $('label[for="search"]'),`,
    'Actualidad home elements'
  );

  source = replaceOnce(
    source,
    `      intro: 'Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.',\n      searchHeading:`,
    `      intro: 'Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.',\n      actualidadHome: { heading:'Actualidad', intro:'Noticias y novedades de accesibilidad y tecnología seleccionadas para llegar a lo importante sin tener que apartar ruido por el camino.', open:'Ver toda la actualidad', source:'Fuente', count:n => \`\${n} noticia\${n === 1 ? '' : 's'} reciente\${n === 1 ? '' : 's'}.\` },\n      searchHeading:`,
    'Spanish Actualidad copy'
  );

  source = replaceOnce(
    source,
    `      intro: 'Accessibility and technology resources, organized so you can reach what you need without getting lost along the way.',\n      searchHeading:`,
    `      intro: 'Accessibility and technology resources, organized so you can reach what you need without getting lost along the way.',\n      actualidadHome: { heading:'News', intro:'Accessibility and technology news selected to help you reach what matters without having to clear away the noise first.', open:'View all news', source:'Source', count:n => \`\${n} recent news item\${n === 1 ? '' : 's'}.\` },\n      searchHeading:`,
    'English Actualidad copy'
  );

  source = replaceOnce(
    source,
    `  let lang = storedLang === 'es' || storedLang === 'en' ? storedLang : defaultLang;\n`,
    `  let lang = storedLang === 'es' || storedLang === 'en' ? storedLang : defaultLang;\n  let actualidadItems = [];\n  let actualidadLoaded = false;\n`,
    'Actualidad state'
  );

  const actualidadFunctions = `  function renderActualidadHome() {\n    const c=copy[lang].actualidadHome;\n    els.actualidadHomeHeading.textContent=c.heading;\n    els.actualidadHomeIntro.textContent=c.intro;\n    els.actualidadHomeOpen.textContent=c.open;\n    els.actualidadHomeList.innerHTML='';\n    if(!coreActualidad||!actualidadLoaded){els.actualidadHomeCount.textContent='';return;}\n    const items=coreActualidad.homePreview(actualidadItems,lang,5);\n    items.forEach(story=>{\n      const item=document.createElement('div'); item.className='news-item';\n      const h3=document.createElement('h3'); h3.textContent=story.title;\n      const meta=document.createElement('p'); meta.className='resource-meta'; meta.textContent=\`\${c.source}: \${story.sourceName}\`;\n      item.append(h3,meta); els.actualidadHomeList.append(item);\n    });\n    els.actualidadHomeCount.textContent=c.count(items.length);\n  }\n\n  function loadActualidadHome() {\n    if(!coreActualidad){actualidadLoaded=true;renderActualidadHome();return;}\n    fetch('actualidad.json',{cache:'no-cache'})\n      .then(response=>{if(!response.ok)throw new Error(\`HTTP \${response.status}\`);return response.json();})\n      .then(items=>{actualidadItems=Array.isArray(items)?items:[];actualidadLoaded=true;renderActualidadHome();})\n      .catch(()=>{actualidadItems=[];actualidadLoaded=true;renderActualidadHome();});\n  }\n\n`;

  source = replaceOnce(
    source,
    `  function makeNewsItem(item) {`,
    `${actualidadFunctions}  function makeNewsItem(item) {`,
    'Actualidad home functions'
  );

  source = replaceOnce(
    source,
    `renderCategories();renderNews();localizeBook();`,
    `renderActualidadHome();renderCategories();renderNews();localizeBook();`,
    'language refresh'
  );

  source = replaceOnce(
    source,
    `  applyPrefs();applyLanguage();trackLanguageUse();announceCompletedUpdate();`,
    `  applyPrefs();applyLanguage();loadActualidadHome();trackLanguageUse();announceCompletedUpdate();`,
    'Actualidad startup load'
  );

  return source;
}

await patchFile('index.html', patchIndex);
await patchFile('app.js', patchApp);
