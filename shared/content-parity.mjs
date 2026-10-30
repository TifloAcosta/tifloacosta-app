// Un contrato para el contenido que comparten la web, Android e iOS.
// No transforma ni elimina datos: detiene una publicación incoherente.
const key = (lang, id) => String(lang || '') + '|' + String(id || '');
const validDate = value => Number.isFinite(Date.parse(String(value || '')));

export function inspectContentParity({ feed, resources = [], videos = [] }) {
  const errors = [];
  if (!feed || feed.schemaVersion !== 1) errors.push('Versión del catálogo móvil incompatible (debe ser 1)');
  if (!validDate(feed?.generatedAt)) errors.push('Fecha de generación inválida');
  for (const group of ['resources', 'videos', 'news']) {
    if (!Array.isArray(feed?.[group])) errors.push('Falta la colección ' + group);
  }
  if (errors.length) return errors;

  const unique = (items, type, makeKey) => {
    const found = new Set();
    for (const item of items) {
      const itemKey = makeKey(item);
      if (!itemKey.trim() || itemKey.includes('|undefined')) errors.push(type + ': identificador vacío');
      if (found.has(itemKey)) errors.push(type + ': duplicado ' + itemKey);
      found.add(itemKey);
    }
  };

  unique(feed.resources, 'Recursos móviles', item => key(item.lang, item.id));
  unique(feed.videos, 'Vídeos móviles', item => String(item.id || ''));
  unique(feed.news, 'Noticias móviles', item => key(item.lang, item.sourceId || item.id));
  unique(resources, 'Recursos web', item => key(item.lang, item.id));
  unique(videos, 'Vídeos web', item => String(item.id || ''));

  const mobileResources = new Map(feed.resources.map(item => [key(item.lang, item.id), item]));
  for (const item of resources) {
    const id = key(item.lang, item.id);
    const mobile = mobileResources.get(id);
    if (!mobile) { errors.push('Recurso ausente en apps: ' + id); continue; }
    for (const prop of ['title', 'category', 'url']) {
      if (mobile[prop] !== item[prop]) errors.push('Recurso no coincide en ' + prop + ': ' + id);
    }
    if (mobile.openUrl !== (item.openUrl || item.url)) errors.push('Enlace de apertura no coincide: ' + id);
    if (mobile.isNew !== Boolean(item.new)) errors.push('Novedad no coincide: ' + id);
    const date = item.newsDate || item.publishedAt || '';
    if (mobile.isNew && (!validDate(mobile.newsDate) || mobile.newsDate !== date)) errors.push('Fecha de novedad no coincide: ' + id);
    if (!mobile.isNew && date && mobile.newsDate !== date) errors.push('Fecha del recurso no coincide: ' + id);
  }

  const mobileVideos = new Map(feed.videos.map(item => [String(item.id || ''), item]));
  for (const item of videos) {
    const id = String(item.id || '');
    const mobile = mobileVideos.get(id);
    if (!mobile) { errors.push('Vídeo ausente en apps: ' + id); continue; }
    for (const prop of ['title', 'publishedAt', 'url']) {
      if ((mobile[prop] || '') !== (item[prop] || '')) errors.push('Vídeo no coincide en ' + prop + ': ' + id);
    }
  }

  const latest = Date.parse(feed.generatedAt);
  for (const item of feed.news) {
    if (!item.id || !item.sourceId || !['es','en'].includes(item.lang)) errors.push('Noticia sin identificador o idioma válido: ' + String(item.id));
    if (item.id !== item.sourceId + ':' + item.lang) errors.push('Identificador de noticia no estable: ' + item.id);
    if (!validDate(item.publishedAt)) errors.push('Noticia sin fecha real: ' + item.id);
    else {
      const age = latest - Date.parse(item.publishedAt);
      if (age < 0 || age > 10 * 24 * 60 * 60 * 1000) errors.push('Noticia fuera de la ventana de diez días: ' + item.id);
    }
    if (!item.sourceName || !item.originalUrl) errors.push('Noticia sin fuente original: ' + item.id);
  }
  return errors;
}

export function assertContentParity(payload) {
  const errors = inspectContentParity(payload);
  if (errors.length) throw new Error('Error de coherencia web/apps:\n' + errors.join('\n'));
  return {
    resources: payload.feed.resources.length,
    videos: payload.feed.videos.length,
    news: payload.feed.news.length
  };
}
