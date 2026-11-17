function normalizedLocation(location) {
  if (!location?.id || !location?.provider || !location?.remoteId) {
    throw new TypeError('La ubicación necesita id, proveedor e identificador del archivo');
  }
  return {
    id: String(location.id),
    provider: String(location.provider),
    remoteId: String(location.remoteId),
    displayPath: String(location.displayPath ?? ''),
    available: location.available !== false,
  };
}

export function createTrack({ id, title, artist = '', album = '', genre = '', durationMs = null, locations = [] }) {
  if (!id || !title) throw new TypeError('La canción necesita un identificador y un título');
  const track = { id: String(id), title: String(title), artist, album, genre, durationMs, locations: [] };
  return locations.reduce(addLocation, track);
}

export function addLocation(track, location) {
  const next = normalizedLocation(location);
  const locations = track.locations.filter((item) => item.id !== next.id);
  return { ...track, locations: [...locations, next] };
}

export function removeLocation(track, locationId) {
  return { ...track, locations: track.locations.filter((item) => item.id !== locationId) };
}

export function createCatalog() {
  return { version: 1, tracks: {} };
}

export function upsertTrack(catalog, track) {
  return { ...catalog, tracks: { ...catalog.tracks, [track.id]: track } };
}
