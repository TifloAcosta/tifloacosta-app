import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAudiusTracks, audiusStreamUrl } from '../shared/music-source-audius.mjs';

test('Audius búsqueda codifica parámetros y normaliza canción sin revelar secretos', async () => {
  let called;
  const fetcher = async (url) => {
    called = new URL(url);
    return { ok: true, json: async () => ({ data: [{ id: 'abCD', title: 'Tierra', user: { name: 'Ana' }, duration: 185 }] }) };
  };
  const songs = await searchAudiusTracks('rock & blues', { fetcher });
  assert.equal(called.origin, 'https://api.audius.co');
  assert.equal(called.searchParams.get('query'), 'rock & blues');
  assert.deepEqual(songs, [{ provider: 'audius', id: 'abCD', title: 'Tierra', artist: 'Ana', duration: 185, streamable: true }]);
});

test('Audius rechaza búsquedas vacías y respuestas HTTP fallidas', async () => {
  assert.deepEqual(await searchAudiusTracks('   ', { fetcher: () => { throw Error('unexpected call'); } }), []);
  await assert.rejects(searchAudiusTracks('rock', { fetcher: async () => ({ ok: false, status: 429 }) }), /Audius.*429/);
});

test('Audius URL de streaming solo acepta ID seguro', () => {
  assert.equal(audiusStreamUrl('abCD-12'), 'https://api.audius.co/v1/tracks/abCD-12/stream');
  assert.throws(() => audiusStreamUrl('../other'), /identificador/);
});
