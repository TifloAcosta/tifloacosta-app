function excludedFolder(name) {
  return /^(?:archivad[oa]s?|archived|archive|borradores?|drafts?|privad[oa]s?|private|backup|papelera)(?:$|[\s_-])/i.test(String(name).trim());
}

export async function collectDriveHtml(roots, listPage) {
  const inventory = [], excluded = [], skipped = [];
  const visited = new Set(), seenFiles = new Set();
  const queue = roots.map(root => ({ ...root, path: [] }));
  while (queue.length) {
    const folder = queue.shift();
    const key = folder.lang + ':' + folder.id;
    if (visited.has(key)) throw new Error('Duplicate/cyclic source folder: ' + key);
    visited.add(key);
    let pageToken;
    const tokens = new Set();
    do {
      const page = await listPage(folder.id, pageToken);
      if (!page || !Array.isArray(page.files)) throw new Error('Incomplete folder listing: ' + key);
      for (const item of page.files) {
        if (item.trashed) continue;
        if (!item.id || !item.name) throw new Error('Invalid source entry in ' + key);
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          if (excludedFolder(item.name)) {
            excluded.push({ lang: folder.lang, path: [...folder.path, item.name] });
          } else {
            queue.push({ lang: folder.lang, id: item.id, path: [...folder.path, item.name] });
          }
          continue;
        }
        if (item.mimeType !== 'text/html') {
          skipped.push({ lang: folder.lang, name: item.name, mimeType: item.mimeType, path: folder.path });
          continue;
        }
        const fileKey = folder.lang + ':' + item.id;
        if (seenFiles.has(fileKey)) throw new Error('Duplicate source file: ' + fileKey);
        seenFiles.add(fileKey);
        inventory.push({ lang: folder.lang, sourceId: item.id, title: item.name,
          category: folder.path[0] || '', folderPath: folder.path.slice(1) });
      }
      pageToken = page.nextPageToken || undefined;
      if (pageToken && tokens.has(pageToken)) throw new Error('Repeated page token: ' + key);
      if (pageToken) tokens.add(pageToken);
    } while (pageToken);
  }
  return { inventory, excluded, skipped, folders: visited.size };
}

function normalizedTitle(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\.html?$/, '').replace(/\(tifloacosta\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function matchesSource(resource, entry) {
  if (resource.lang !== entry.lang) return false;
  const id = entry.sourceId;
  if (resource.sourceDriveId === id || resource.id === entry.lang + '-' + id ||
      String(resource.id || '').endsWith('-' + id)) return true;
  return [resource.url, resource.openUrl].some(value => {
    try {
      const url = new URL(value);
      const filename = decodeURIComponent(url.pathname.split('/').pop() || '');
      return url.searchParams.get('id') === id || url.pathname.split('/').includes(id) ||
        filename === id + '.html' || filename.endsWith('-' + id + '.html');
    } catch { return false; }
  });
}

export function reconcileInventory(inventory, resources, aliases = {}) {
  const matched = [], missing = [], ambiguous = [], routeMismatches = [], used = new Set();
  for (const entry of inventory) {
    const aliasKey = entry.lang + ':' + entry.sourceId;
    const alias = Object.hasOwn(aliases, aliasKey) ? aliases[aliasKey] : null;
    const matches = resources.filter(item => item.lang === entry.lang &&
      (alias ? item.id === alias : matchesSource(item, entry)));
    if (matches.length !== 1) {
      if (matches.length > 1) ambiguous.push({ ...entry, matches: matches.map(item => item.id) });
      else missing.push({ ...entry, titleCandidates: resources.filter(item => item.lang === entry.lang &&
        normalizedTitle(item.title) === normalizedTitle(entry.title)).map(item => item.id) });
      continue;
    }
    const item = matches[0], key = item.lang + ':' + item.id;
    if (used.has(key)) {
      ambiguous.push({ ...entry, matches: [item.id], reason: 'resource already matched to another source' });
      continue;
    }
    used.add(key);
    matched.push({ ...entry, resourceId: item.id });
    if (entry.category && (item.category !== entry.category ||
        JSON.stringify(item.folderPath || []) !== JSON.stringify(entry.folderPath))) {
      routeMismatches.push({ ...entry, resourceId: item.id,
        catalogCategory: item.category, catalogFolderPath: item.folderPath || [] });
    }
  }
  return { matched, missing, ambiguous, routeMismatches,
    catalogOnly: resources.filter(item => !used.has(item.lang + ':' + item.id))
      .map(item => ({ lang: item.lang, id: item.id, title: item.title })) };
}
