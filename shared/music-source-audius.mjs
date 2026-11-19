const API = 'https://api.audius.co/v1';

/** Audius permite consultas públicas sin sesión del usuario. */
export async function searchAudiusTracks(query, { fetcher = fetch, limit = 20 } = {}) {
  const term = String(query ?? '').trim();
  if (!term) return [];
  const endpoint = new URL(`${API}/tracks/search`);
  endpoint.searchParams.set('query', term);
  endpoint.searchParams.set('limit', String(Math.max(1, Math.min(50, limit))));
  const response = await fetcher(endpoint.toString());
  if (!response.ok) throw new Error(`Audius no respondió correctamente (HTTP ${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error('Audius devolvió una respuesta inesperada.');
  return payload.data.filter(track => track && typeof track.id === 'string' && track.title).map(track => ({
    provider: 'audius',
    id: track.id,
    title: String(track.title),
    artist: String(track.user?.name ?? 'Artista desconocido'),
    duration: Number.isFinite(track.duration) ? track.duration : null,
    streamable: track.is_streamable !== false,
  }));
}

export function audiusStreamUrl(trackId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(trackId ?? ''))) {
    throw new Error('El identificador de Audius no es válido.');
  }
  return `${API}/tracks/${trackId}/stream`;
}
