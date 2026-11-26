import { readFile } from 'node:fs/promises';
import { collectDriveHtml, reconcileInventory } from '../shared/resource-inventory.mjs';

// Read-only audit. Use an externally obtained, short-lived Drive read token,
// or a reviewed inventory JSON. Never publish or delete anything from this tool.
const args = process.argv.slice(2);
const option = name => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing value for ' + name);
  return args[i + 1];
};
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));

async function listDrivePage(folderId, pageToken) {
  if (!/^[A-Za-z0-9_-]+$/.test(folderId)) throw new Error('Invalid source folder ID');
  const token = process.env.TIFLO_DRIVE_READ_TOKEN;
  if (!token) throw new Error('A read-only Drive access token is required');
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', "'" + folderId + "' in parents and trashed = false");
  url.searchParams.set('fields', 'nextPageToken,incompleteSearch,files(id,name,mimeType,trashed)');
  url.searchParams.set('pageSize', '1000');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token },
    redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Drive listing failed: HTTP ' + response.status);
  const page = await response.json();
  if (page.incompleteSearch) throw new Error('Drive reports an incomplete search');
  return page;
}

async function main() {
  const catalog = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  const match = catalog.match(/^window\.TIFLO_RESOURCES\s*=\s*(\[[\s\S]*\]);\s*$/);
  if (!match) throw new Error('Unexpected editorial catalog format');
  const resources = JSON.parse(match[1]);
  const input = option('--inventory');
  let walked;
  if (input) {
    walked = await readJSON(input);
    if (!Array.isArray(walked.inventory)) throw new Error('Invalid inventory file');
  } else {
    const roots = ['es', 'en'].map(lang => ({ lang, id: process.env['TIFLO_RESOURCE_ROOT_' + lang.toUpperCase()] }));
    if (roots.some(root => !root.id)) throw new Error('Both approved editorial roots must be specified');
    walked = await collectDriveHtml(roots, listDrivePage);
  }
  const aliasPath = option('--aliases');
  const aliases = aliasPath ? await readJSON(aliasPath) : {};
  const report = reconcileInventory(walked.inventory, resources, aliases);
  const counts = Object.fromEntries(Object.entries(report).map(([name, values]) => [name, values.length]));
  // Title candidates and unmatched IDs require editorial review; never infer deletions.
  console.log(JSON.stringify({ counts, folders: walked.folders, excluded: walked.excluded,
    skipped: walked.skipped, ...report }, null, 2));
  if (args.includes('--strict') && (report.missing.length || report.ambiguous.length || report.routeMismatches.length)) {
    process.exitCode = 1;
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
