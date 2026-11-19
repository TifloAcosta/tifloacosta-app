const API = 'https://api.jamendo.com/v3.0/tracks/';

/** Jamendo requiere el client_id de la aplicación, no una cuenta por oyente. */
export async function searchJamendoTracks(query, { clientId, fetcher = fetch, limit = 20 } = {}) {
  const id = String(clientId ?? '').trim();
  if (!id) throw new Error('Falta configurar el identificador de aplicación de Jamendo.');
  const term = String(query ?? '').trim();
  if (!term) return [];
  const url = new URL(API);
  url.searchParams.set('client_id', id);
  url.searchParams.set('format', 'json');
  url.searchParams.set('search', term);
  url.searchParams.set('limit', String(Math.max(1, Math.min(50, limit))));
  const response = await fetcher(url.toString());
  if (!response.ok) throw new Error(`Jamendo respondió con HTTP ${response.status}.`);
  const body = await response.json();
  if (body?.headers?.status !== 'success' || !Array.isArray(body.results)) {
    throw new Error(`Jamendo no pudo completar la búsqueda: ${body?.headers?.error_message ?? 'respuesta inválida'}`);
  }
  return body.results.filter(track => {
    if (!track?.id || !track.name || !track.audio) return false;
    try { return new URL(track.audio).protocol === 'https:'; } catch { return false; }
  }).map(track => ({
    provider: 'jamendo', id: String(track.id), title: String(track.name),
    artist: String(track.artist_name ?? 'Artista desconocido'),
    duration: Number.isFinite(track.duration) ? track.duration : null,
    streamUrl: track.audio,
  }));
}
