import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mobileDir = fileURLToPath(new URL('../', import.meta.url));
const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const sourceHtml = await readFile(`${srcDir}index.html`, 'utf8');
const bundledHtml = sourceHtml.replace('./app.mjs', './app.js');
await writeFile(`${distDir}index.html`, bundledHtml, 'utf8');
await copyFile(`${srcDir}styles.css`, `${distDir}styles.css`);

await build({
  entryPoints: [`${srcDir}app.mjs`],
  outfile: `${distDir}app.js`,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome120', 'safari17'],
  sourcemap: false,
  minify: false,
  logLevel: 'info'
});

console.log(`TifloAcosta mobile bundle created in ${distDir.replace(mobileDir, '')}`);
