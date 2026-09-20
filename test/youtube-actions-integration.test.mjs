import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('YouTube actions panel lives inside the existing player without replacing playback controls', async () => {
  const html = await read('videos.html');
  assert.match(html, /id="video-player-rewind"[^>]*>Retroceder 1 minuto</);
  assert.match(html, /id="video-player-toggle"[^>]*>Reproducir</);
  assert.match(html, /id="video-player-forward"[^>]*>Avanzar 1 minuto</);
  assert.match(html, /<section id="youtube-actions"[^>]*aria-labelledby="youtube-actions-heading"[^>]*>[\s\S]*?<h3 id="youtube-actions-heading">Acciones de YouTube<\/h3>/);
  assert.match(html, /id="youtube-details"[^>]*>Ver detalles<\/button>/);
  assert.match(html, /id="youtube-details-panel"[^>]*hidden/);
  assert.match(html, /id="youtube-account-actions"/);
  assert.match(html, /id="youtube-actions-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);

  const actionsAt = html.indexOf('id="youtube-actions"');
  const controlsAt = html.indexOf('id="video-player-controls"');
  const closeAt = html.indexOf('id="video-player-close"');
  assert.ok(controlsAt >= 0 && controlsAt < actionsAt);
  assert.ok(actionsAt < closeAt);
});

test('YouTube action assets are isolated from videos.js and contain no secret values', async () => {
  const [html, config] = await Promise.all([read('videos.html'), read('youtube-actions-config.js')]);
  assert.match(html, /youtube-actions\.css\?v=/);
  assert.match(html, /youtube-actions-config\.js\?v=/);
  assert.match(html, /youtube-actions-core\.js\?v=/);
  assert.match(html, /youtube-actions\.js\?v=/);
  assert.match(config, /https:\/\/youtube-auth\.tifloacosta\.com/);
  assert.doesNotMatch(config, /CLIENT_SECRET|SESSION_SECRET|refresh[_-]?token|access[_-]?token/i);
});

test('the actions module uses credentialed requests and public details remain local', async () => {
  const source = await read('youtube-actions.js');
  assert.match(source, /credentials:\s*['"]include['"]/);
  assert.match(source, /detailsFromVideo\(/);
  assert.match(source, /\/session/);
  assert.match(source, /\/state\?videoId=/);
});

test('authenticated controls call only the intended YouTube action endpoints', async () => {
  const source = await read('youtube-actions.js');
  assert.match(source, /request\(['"]\/subscribe['"]/);
  assert.match(source, /request\(['"]\/like['"]/);
  assert.match(source, /request\(['"]\/comment['"]/);
  assert.match(source, /request\(['"]\/logout['"]/);
  assert.match(source, /X-CSRF-Token/);
  assert.match(source, /Suscripción realizada\. Ya estás suscrito al canal TifloAcosta\./);
  assert.match(source, /Comentario publicado en YouTube\./);
});

test('comment editor requires an explicit publish action', async () => {
  const source = await read('youtube-actions.js');
  assert.match(source, /youtube-comment-text/);
  assert.match(source, /youtube-publish-comment/);
  assert.match(source, /youtube-cancel-comment/);
  assert.match(source, /publish\.disabled/);
});
