import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = dirname(here);
const srcDir = join(mobileDir, 'src');
const distDir = join(mobileDir, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await build({
  entryPoints: [join(srcDir, 'app.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  outfile: join(distDir, 'app.js')
});

await Promise.all([
  copyFile(join(srcDir, 'index.html'), join(distDir, 'index.html')),
  copyFile(join(srcDir, 'styles.css'), join(distDir, 'styles.css'))
]);