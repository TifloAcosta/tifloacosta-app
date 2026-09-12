import fs from 'node:fs';
import path from 'node:path';

// Canonical home for every internal TifloAcosta link. Verified migration runner.
const OLD_BASE = ['https://tifloacosta.github.io', 'tifloacosta-app/'].join('/');
const NEW_BASE = 'https://tifloacosta.com/';
const CHECK_ONLY = process.argv.includes('--check');
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.json', '.txt', '.md', '.yml', '.yaml', '.webmanifest', '.css', '.xml']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '_site']);
const SELF = path.normalize('scripts/migrate-custom-domain.mjs');

function walk(dir = '.') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.' || entry.name === '..') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (path.normalize(full) === SELF) continue;
    if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

let filesWithLegacyUrl = 0;
let replacements = 0;
const affected = [];

for (const file of walk('.')) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch { continue; }
  if (!text.includes(OLD_BASE)) continue;

  const count = text.split(OLD_BASE).length - 1;
  filesWithLegacyUrl += 1;
  replacements += count;
  affected.push(file.replace(/^\.\//, ''));

  if (!CHECK_ONLY) {
    fs.writeFileSync(file, text.split(OLD_BASE).join(NEW_BASE), 'utf8');
  }
}

if (CHECK_ONLY) {
  if (filesWithLegacyUrl) {
    console.error(`Legacy domain still present in ${filesWithLegacyUrl} file(s), ${replacements} occurrence(s):`);
    affected.forEach(file => console.error(`- ${file}`));
    process.exit(1);
  }
  console.log('Custom-domain check passed: no legacy TifloAcosta URLs remain.');
} else {
  console.log(`Custom-domain migration updated ${filesWithLegacyUrl} file(s), ${replacements} occurrence(s).`);
  affected.forEach(file => console.log(`- ${file}`));
}
