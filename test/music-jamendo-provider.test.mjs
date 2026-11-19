import test from 'node:test';
import assert from 'node:assert/strict';
import { searchJamendoTracks } from '../shared/music-source-jamendo.mjs';

test('Jamendo requiere client id de la aplicación y codifica la búsqueda', async () => {
  let target;
  const fetcher = async url => {
    target = new URL(url);
    return { ok: true, json: async () => ({ headers: { status: 'success', code: 0 }, results: [
      { id: '21', name: 'Luz', artist_name: 'Mar', duration: 183, audio: 'https://cdn.jamendo.com/audio/21' }
    ] }) };
  };
  const result = await searchJamendoTracks('rock & jazz', { clientId: 'public-app-id', fetcher });
  assert.equal(target.searchParams.get('client_id'), 'public-app-id');
  assert.equal(target.searchParams.get('search'), 'rock & jazz');
  assert.equal(target.searchParams.get('limit'), '20');
  assert.deepEqual(result, [{ provider: 'jamendo', id: '21', title: 'Luz', artist: 'Mar', duration: 183,
    streamUrl: 'https://cdn.jamendo.com/audio/21' }]);
});

test('Jamendo no consulta API sin client id configurado', async () => {
  await assert.rejects(searchJamendoTracks('rock', { fetcher: () => { throw Error('no'); } }), /identificador de aplicación/);
});

test('Jamendo rechaza enlaces de streaming inseguros y errores del proveedor', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ headers: { status: 'success', code: 0 },
    results: [{ id: '2', name: 'Canción', artist_name: 'Ana', audio: 'javascript:alert(1)' }] }) });
  assert.deepEqual(await searchJamendoTracks('x', { clientId: 'id', fetcher }), []);
  await assert.rejects(searchJamendoTracks('x', { clientId: 'id', fetcher: async () => ({ ok: false, status: 403 }) }), /403/);
});
