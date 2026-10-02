import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sharedEntry = fileURLToPath(new URL('../../shared/web-entry.mjs', import.meta.url));
const sharedOutfile = fileURLToPath(new URL('../../shared-web.js', import.meta.url));
const pdfEntry = fileURLToPath(new URL('../../shared/web-pdf-entry.mjs', import.meta.url));
const pdfOutfile = fileURLToPath(new URL('../../web-pdf.js', import.meta.url));
const pdfWorkerSource = fileURLToPath(new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url));
const pdfWorkerOutfile = fileURLToPath(new URL('../../pdf.worker.min.mjs', import.meta.url));

await build({
  entryPoints: [sharedEntry],
  outfile: sharedOutfile,
  bundle: true,
  format: 'iife',
  globalName: 'TIFLO_SHARED',
  platform: 'browser',
  target: ['chrome120', 'safari17'],
  sourcemap: false,
  minify: false,
  logLevel: 'info'
});

await build({
  entryPoints: [pdfEntry],
  outfile: pdfOutfile,
  bundle: true,
  format: 'iife',
  globalName: 'TIFLO_PDF',
  platform: 'browser',
  target: ['chrome120', 'safari17'],
  sourcemap: false,
  minify: true,
  logLevel: 'info'
});

await copyFile(pdfWorkerSource, pdfWorkerOutfile);

console.log('Shared web bundle created: shared-web.js');
console.log('On-demand PDF bundle created: web-pdf.js');
console.log('PDF worker copied: pdf.worker.min.mjs');
