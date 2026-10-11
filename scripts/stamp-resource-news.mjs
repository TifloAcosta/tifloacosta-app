import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function parseResources(source) {
  const content = String(source || '');
  const match = /^window\.TIFLO_RESOURCES\s*=\s*(\[[\s\S]*\]);?\s*$/.exec(content);
  if (!match) throw new Error('data.js no contiene el catálogo de recursos esperado');
  const items = JSON.parse(match[1]);
  if (!Array.isArray(items)) throw new Error('Catálogo de recursos inválido');
  return items;
}

export function stampNewResources(current, previous, timestamp) {
  const known = new Set((Array.isArray(previous) ? previous : []).map(item => String(item.id || '')));
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Fecha de incorporación inválida');
  let stamped = 0;
  const next = (Array.isArray(current) ? current : []).map(item => {
    if (!item || !item.id || known.has(String(item.id))) return item;
    // An explicit existing date wins, preserving the author's original chronology.
    stamped += 1;
    return { ...item, new: true, newsDate: item.newsDate || timestamp };
  });
  return { items: next, stamped };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim();
}

async function main() {
  const path = new URL('../data.js', import.meta.url);
  const source = await readFile(path, 'utf8');
  const current = parseResources(source);
  let previous;
  try {
    previous = parseResources(git(['show', 'HEAD^:data.js']));
  } catch {
    console.log('Sin versión anterior para comparar; se mantiene el catálogo existente.');
    return;
  }
  const timestamp = git(['show', '-s', '--format=%cI', 'HEAD']);
  const { items, stamped } = stampNewResources(current, previous, timestamp);
  if (!stamped) {
    console.log('Novedades: sin recursos nuevos en este cambio.');
    return;
  }
  await writeFile(path, 'window.TIFLO_RESOURCES = ' + JSON.stringify(items, null, 2) + ';\n', 'utf8');
  console.log('Novedades: ' + stamped + ' recursos nuevos fechados automáticamente.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
