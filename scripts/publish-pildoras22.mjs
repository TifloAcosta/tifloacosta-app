import fs from 'node:fs';

const path = 'data.js';
const raw = fs.readFileSync(path, 'utf8');
const prefix = 'window.TIFLO_RESOURCES = ';
if (!raw.startsWith(prefix)) throw new Error('Unexpected data.js format');
const jsonText = raw.slice(prefix.length).trim().replace(/;\s*$/, '');
const resources = JSON.parse(jsonText);

const esOld = resources.find(item => item.id === 'es-1Yk652avn7fcQtfNV28nu0VIkqpcZiRos' || item.title === 'Píldoras 21 2026');
const enOld = resources.find(item => item.id === 'en-1ztd-nsQcYPNa3-Ij40CxlNIGkuEPtX-T' || item.title === 'Tech Pills 21 2026');
if (esOld) esOld.new = false;
if (enOld) enOld.new = false;

const newIds = new Set(['es-pildoras-22-2026', 'en-tech-pills-22-2026']);
const filtered = resources.filter(item => !newIds.has(item.id));

filtered.unshift(
  {
    id: 'es-pildoras-22-2026',
    lang: 'es',
    category: 'Noticias',
    title: 'Píldoras 22 2026',
    url: 'https://tifloacosta.com/docs/es/pildoras-tecnologicas-22-2026.html',
    openUrl: 'https://tifloacosta.com/docs/es/pildoras-tecnologicas-22-2026.html',
    new: true
  },
  {
    id: 'en-tech-pills-22-2026',
    lang: 'en',
    category: 'News',
    title: 'Tech Pills 22 2026',
    url: 'https://tifloacosta.com/docs/en/technology-pills-22-2026.html',
    openUrl: 'https://tifloacosta.com/docs/en/technology-pills-22-2026.html',
    new: true
  }
);

for (const lang of ['es', 'en']) {
  const count = filtered.filter(item => item.lang === lang && item.new === true).length;
  if (count > 3) throw new Error(`Too many new resources for ${lang}: ${count}`);
}

fs.writeFileSync(path, `${prefix}${JSON.stringify(filtered, null, 2)};\n`, 'utf8');
console.log('Píldoras 22 added to data.js and Píldoras 21 removed from Novedades.');
