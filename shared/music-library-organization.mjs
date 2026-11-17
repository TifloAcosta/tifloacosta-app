export function createMusicFolders() {
  return { version: 1, folders: {} };
}

function folderIn(collection, id) {
  const folder = collection.folders[id];
  if (!folder) throw new RangeError('Carpeta desconocida');
  return folder;
}

export function createMusicFolder(collection, { id, name, parentId = null }) {
  if (!id || !String(name ?? '').trim()) throw new TypeError('La carpeta necesita identificador y nombre');
  if (collection.folders[id]) throw new TypeError('Ya existe esta carpeta');
  if (parentId !== null) folderIn(collection, parentId);
  return {
    ...collection,
    folders: { ...collection.folders, [id]: { id, name: String(name).trim(), parentId, trackIds: [] } },
  };
}

export function renameMusicFolder(collection, id, name) {
  const folder = folderIn(collection, id);
  if (!String(name ?? '').trim()) throw new TypeError('Nombre vacío');
  return { ...collection, folders: { ...collection.folders, [id]: { ...folder, name: String(name).trim() } } };
}

export function moveMusicFolder(collection, id, parentId) {
  const folder = folderIn(collection, id);
  if (parentId !== null) folderIn(collection, parentId);
  let cursor = parentId;
  while (cursor !== null) {
    if (cursor === id) throw new TypeError('No se permite crear un ciclo de carpetas');
    cursor = folderIn(collection, cursor).parentId;
  }
  return { ...collection, folders: { ...collection.folders, [id]: { ...folder, parentId } } };
}

export function assignMusicTrack(collection, folderId, trackId) {
  const folder = folderIn(collection, folderId);
  if (!trackId) throw new TypeError('Canción sin identificador');
  const trackIds = folder.trackIds.includes(trackId) ? folder.trackIds : [...folder.trackIds, trackId];
  return { ...collection, folders: { ...collection.folders, [folderId]: { ...folder, trackIds } } };
}

export function removeMusicFolder(collection, id) {
  folderIn(collection, id);
  const folders = { ...collection.folders };
  for (const folder of Object.values(folders)) {
    if (folder.parentId === id) folders[folder.id] = { ...folder, parentId: null };
  }
  delete folders[id];
  return { ...collection, folders };
}

function fold(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export function searchMusicTracks(tracks, query) {
  const needle = fold(query).trim();
  if (!needle) return [...tracks];
  return tracks.filter((track) => [track.title, track.artist, track.album].some((part) => fold(part).includes(needle)));
}
