import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDriveHtml, reconcileInventory } from '../shared/resource-inventory.mjs';
import { buildMobileContent } from '../scripts/build-mobile-content.mjs';
import { inspectContentParity } from '../shared/content-parity.mjs';

const folder = (id, name) => ({ id, name, mimeType: 'application/vnd.google-apps.folder' });
const html = (id, name) => ({ id, name, mimeType: 'text/html' });

test('recursive inventory retains nested paths and consumes every page, excluding archives', async () => {
  const pages = {
    root: { files: [folder('category', 'Lectores de pantalla'), folder('archive', 'Archivados - enlaces antiguos')] },
    category: { files: [html('direct', 'Comandos.html'), folder('sub', 'NVDA')] },
    sub: { files: [folder('deep', 'Cursos')] },
    deep: { files: [html('first', 'Curso práctico.html')], nextPageToken: 'next' },
    'deep:next': { files: [html('second', 'Curso avanzado.html')] }
  };
  const result = await collectDriveHtml([{ lang: 'es', id: 'root' }], async (id, token) => {
    const page = pages[token ? id + ':' + token : id];
    assert.ok(page, 'unapproved folder must not be queried');
    return page;
  });
  assert.equal(result.folders, 4);
  assert.equal(result.excluded.length, 1);
  assert.deepEqual(result.inventory.map(x => [x.sourceId, x.folderPath]), [
    ['direct', []], ['first', ['NVDA', 'Cursos']], ['second', ['NVDA', 'Cursos']]
  ]);
});

test('missing source IDs are review candidates, never silently matched by title', () => {
  const inventory = [{ lang:'es', sourceId:'a', title:'Curso.html', category:'Lectores', folderPath:['NVDA'] }];
  const resources = [{ lang:'es', id:'legacy', title:'Curso', category:'Lectores', folderPath:[] }];
  const report = reconcileInventory(inventory, resources);
  assert.equal(report.matched.length, 0);
  assert.deepEqual(report.missing[0].titleCandidates, ['legacy']);
  const aliased = reconcileInventory(inventory, resources, { 'es:a':'legacy' });
  assert.equal(aliased.missing.length, 0);
  assert.equal(aliased.routeMismatches.length, 1);
});

test('incomplete page and repeated page token are failures, not empty successful inventories', async () => {
  const roots = [{ lang:'es', id:'root' }];
  await assert.rejects(collectDriveHtml(roots, async () => ({})), /Incomplete folder/);
  await assert.rejects(collectDriveHtml(roots, async () => ({ files:[], nextPageToken:'same' })), /Repeated page token/);
});

test('mobile generator and parity check preserve nested resource paths and searchable headings', () => {
  const resources = [{ id:'es-course', lang:'es', category:'Lectores de pantalla', title:'Curso',
    url:'https://tifloacosta.com/course.html', folderPath:['NVDA','Cursos'], searchText:'configuración avanzada' }];
  const feed = buildMobileContent({ resources, generatedAt:'2026-11-26T14:00:00Z' });
  assert.deepEqual(feed.resources[0].folderPath, ['NVDA','Cursos']);
  assert.equal(feed.resources[0].searchText, 'configuración avanzada');
  assert.deepEqual(inspectContentParity({ feed, resources }), []);
  feed.resources[0].folderPath = ['NVDA'];
  assert.match(inspectContentParity({ feed, resources }).join('\n'), /Ruta de carpeta/);
  assert.throws(() => buildMobileContent({ resources:[{ ...resources[0], folderPath:['..'] }] }), /Invalid resource folder path/);
});
