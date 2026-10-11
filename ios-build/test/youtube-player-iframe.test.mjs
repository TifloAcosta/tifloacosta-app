import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const page = readFileSync(resolve(import.meta.dirname, '../native/tiflo-youtube-player.html'), 'utf8');
const body = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(body, 'YouTube iframe controller script must be bundled');

function harness() {
  const messages = [];
  const commands = [];
  const handlers = {};
  const player = {
    getDuration: () => 300,
    getCurrentTime: () => 120,
    getPlayerState: () => 2,
    playVideo: () => commands.push(['play']),
    pauseVideo: () => commands.push(['pause']),
    seekTo: (value, allow) => commands.push(['seek', value, allow])
  };
  const window = {
    webkit: { messageHandlers: { tifloPlayer: { postMessage: msg => messages.push(msg) } } }
  };
  const document = {
    createElement: tag => ({ tag }),
    head: { appendChild: node => { handlers.loader = node; } }
  };
  const context = { window, document, Number, Math,
    location: { origin: 'https://com.tifloacosta.app' },
    setInterval: callback => { handlers.poll = callback; }
  };
  const mockYT = {
    Player: class {
      constructor(_id, options) {
        handlers.options = options;
        return player;
      }
    }
  };
  runInNewContext(body, context);
  context.YT = mockYT;
  window.onYouTubeIframeAPIReady();
  return { window, messages, commands, handlers };
}

test('la reproducción y pausa usan la API oficial y no generan reproducción automática', () => {
  const h = harness();
  assert.equal(h.handlers.options.playerVars.playsinline, 1);
  assert.equal(h.handlers.options.playerVars.enablejsapi, 1);
  assert.equal(h.handlers.options.playerVars.origin, 'https://com.tifloacosta.app');
  assert.equal(h.handlers.options.videoId, '__TIFLO_YOUTUBE_VIDEO_ID__');
  assert.deepEqual(h.commands, []);
  h.handlers.options.events.onReady();
  assert.equal(h.window.tifloControl('play'), true);
  assert.equal(h.window.tifloControl('pause'), true);
  assert.deepEqual(h.commands, [['play'], ['pause']]);
  assert.ok(h.messages.some(msg => msg.type === 'ready'));
});

test('el avance respeta duración y rechaza comandos arbitrarios', () => {
  const h = harness();
  assert.equal(h.window.tifloControl('seek', 200), false);
  h.handlers.options.events.onReady();
  assert.equal(h.window.tifloControl('seek', 10000), true);
  assert.equal(h.window.tifloControl('seek', -20), true);
  assert.equal(h.window.tifloControl('seek', Number.NaN), false);
  assert.equal(h.window.tifloControl('arbitrary', 5), false);
  assert.deepEqual(h.commands, [['seek', 300, true], ['seek', 0, true]]);
});

test('el estado de progreso mantiene datos reales y el error de YouTube detiene los controles', () => {
  const h = harness();
  h.handlers.options.events.onReady();
  h.handlers.poll();
  const progress = h.messages.find(msg => msg.type === 'progress');
  assert.ok(progress);
  assert.equal(progress.position, 120);
  assert.equal(progress.duration, 300);
  assert.equal(progress.state, 2);
  h.handlers.options.events.onError({ data: 153 });
  assert.equal(h.messages.at(-1).type, 'error');
  assert.equal(h.messages.at(-1).code, 153);
  assert.equal(h.window.tifloControl('play'), false);
});

test('bloqueo de autoplay se comunica a la interfaz nativa', () => {
  const h = harness();
  h.handlers.options.events.onAutoplayBlocked();
  assert.equal(h.messages.at(-1).type, 'blocked');
  assert.equal(h.handlers.loader.src, 'https://www.youtube.com/iframe_api');
});
