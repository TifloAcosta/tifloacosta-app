import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../videos-core.js');

test('video search finds terms from supplemental keywords and adapted text', () => {
  const videos = [
    {
      id: 'song',
      title: '¡Mamá IA, quiero ser artista!',
      description: 'Nos divertimos generando canciones con inteligencia artificial.',
      excerpt: 'Canciones con inteligencia artificial.'
    },
    {
      id: 'voice',
      title: 'VoiceOver: ¿Esa voz es nueva?',
      description: 'Nuevas voces para VoiceOver.',
      excerpt: 'Nuevas voces.'
    }
  ];

  globalThis.TIFLO_VIDEO_SEARCH_INDEX = {
    videos: {
      song: { keywords: ['Suno', 'música generativa'] },
      voice: { adaptedText: 'Visionauta permite incorporar voces al sistema. Runa TTS amplía el repertorio.' }
    }
  };

  assert.deepEqual(core.filterVideos(videos, 'Suno').map(video => video.id), ['song']);
  assert.deepEqual(core.filterVideos(videos, 'Runa TTS').map(video => video.id), ['voice']);

  delete globalThis.TIFLO_VIDEO_SEARCH_INDEX;
});

test('search index builder merges manual keywords and adapted text by normalized title', async () => {
  let builder = null;
  try {
    builder = await import('../scripts/build-video-search-index.mjs');
  } catch {}

  assert.equal(typeof builder?.buildSearchIndex, 'function');

  const videos = [
    { id: 'song', title: '¡Mamá IA, quiero ser artista!' },
    { id: 'voice', title: 'VoiceOver: ¿Esa voz es nueva?' }
  ];
  const overrides = {
    song: { keywords: ['Suno', 'música'] }
  };
  const adaptations = [
    { title: 'VoiceOver: ¿Esa voz es nueva?', text: 'Visionauta y Runa TTS para VoiceOver.' }
  ];

  const index = builder.buildSearchIndex(videos, overrides, adaptations);
  assert.deepEqual(index.videos.song.keywords, ['Suno', 'música']);
  assert.match(index.videos.voice.adaptedText, /Runa TTS/);
});
