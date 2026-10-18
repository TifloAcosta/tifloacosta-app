/**
 * Build the future iPhone shell from the dedicated mobile application.
 *
 * Staging-only until native bridges and persisted-reader data are compatible.
 * This script NEVER signs, distributes, or changes the public website.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const repository = resolve(import.meta.dirname, '..');
const mobileDist = resolve(repository, 'mobile/dist');
const destination = resolve(repository, 'ios-build/www');
const sha256 = data => createHash('sha256').update(data).digest('hex');

async function fileBytes(name) {
  return readFile(join(destination, name));
}

// Inventory every packaged file, including future nested assets, so a
// successful UI entrypoint check cannot conceal an incomplete native bundle.
async function listBundledFiles(directory = destination, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      throw new Error(`Rejected iPhone bundle: unexpected symlink ${name}`);
    }
    if (entry.isDirectory()) files.push(...await listBundledFiles(join(directory, entry.name), name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Rejected iPhone bundle: unexpected filesystem entry ${name}`);
  }
  return files.sort();
}

async function validateShell() {
  const html = (await fileBytes('index.html')).toString('utf8');
  const script = (await fileBytes('app.js')).toString('utf8');
  const css = (await fileBytes('app.css')).toString('utf8');
  const bad = [
    /id=["']home-blocks["']/i,
    /id=["']reading-section["']/i,
    /id=["']global-search-shell["']/i,
    /(?:src|href)=["'](?:\.\/)?(?:videos|actualidad|podcast)\.html/i,
    /src=["'](?:\.\/)?app\.js\?v=/i
  ];
  const mainCount = (html.match(/<main\b/gi) || []).length;
  if (mainCount !== 1 ||
      !/<main\s+id=["']app["']\s+tabindex=["']-1["']\s*><\/main>/i.test(html) ||
      !/<script\s+type=["']module["']\s+src=["']\.\/app\.js["']><\/script>/i.test(html) ||
      bad.some(regex => regex.test(html))) {
    throw new Error('Rejected iPhone bundle: expected precisely one dedicated mobile shell, not public-web pages');
  }
  if (!script.includes('Missing mobile app root') ||
      !css.includes('.app-brand-header') ||
      !css.includes('.screen-header') ||
      !css.includes('--safe-top')) {
    throw new Error('Rejected iPhone bundle: mobile router or unified design system is incomplete');
  }
  const config = JSON.parse(await readFile(resolve(repository, 'mobile/capacitor.config.json'), 'utf8'));
  if (config.appId !== 'com.tifloacosta.app' || config.webDir !== 'dist' || config.server?.url ||
      config.server?.iosScheme !== 'capacitor' || config.server?.hostname !== 'localhost') {
    throw new Error('Rejected iPhone configuration: app identity, local bundle, or URL does not match');
  }
  return { entryPoint: 'mobile/src/index.html', navigation: 'mobile/src/app.mjs' };
}

await stat(join(mobileDist, 'index.html')).catch(() => {
  throw new Error('Run npm run build in mobile/ before preparing the iOS mobile shell');
});
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(mobileDist, destination, { recursive: true });
const metadata = await validateShell();
const files = await listBundledFiles();
const hashes = {};
for (const filename of files) {
  hashes[filename] = sha256(await fileBytes(filename));
}
const marker = {
  schemaVersion: 1,
  mobileUiOnly: true,
  publicWebUiExcluded: true,
  ...metadata,
  sourceCommit: String(process.env.GITHUB_SHA || '').trim(),
  fileHashes: hashes,
  includedFiles: files
};
const identityText = JSON.stringify(marker, null, 2) + '\n';
await Promise.all([
  writeFile(join(destination, 'tiflo-ios-ui-identity.json'), identityText, 'utf8'),
  writeFile(join(mobileDist, 'tiflo-ios-ui-identity.json'), identityText, 'utf8')
]);
console.log('Single mobile iPhone UI staged (NOT distributable without native/data parity):');
console.log(JSON.stringify(marker, null, 2));
