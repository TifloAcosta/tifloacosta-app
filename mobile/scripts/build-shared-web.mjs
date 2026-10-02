import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const entryPoint = fileURLToPath(new URL('../../shared/web-entry.mjs', import.meta.url));
const outfile = fileURLToPath(new URL('../../shared-web.js', import.meta.url));

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  format: 'iife',
  globalName: 'TIFLO_SHARED',
  platform: 'browser',
  target: ['chrome120', 'safari17'],
  sourcemap: false,
  minify: false,
  logLevel: 'info'
});

console.log('Shared web bundle created: shared-web.js');
