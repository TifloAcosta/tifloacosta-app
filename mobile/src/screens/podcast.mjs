import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

const FEED_URL = 'https://anchor.fm/s/5b48ca28/podcast/rss';

const PLATFORMS = [
  ['podcast.spotify', 'https://open.spotify.com/show/6z5BbrUhRuMANB5BFJfdfB'],
  ['podcast.apple', 'https://podcasts.apple.com/es/podcast/canal-tifloacosta/id1567846456'],
  ['podcast.ivoox', 'https://www.ivoox.com/podcast-canal-tifloacosta_sq_f11282163_1.html'],
  ['podcast.podimo', 'https://podimo.com/es/shows/canal-tifloacosta'],
  ['podcast.radio', 'https://www.radio.es/podcast/canal-tifloacosta']
];

function secondsLabel(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function parseEpisodes(xmlText) {
  const xml = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
  if (xml.querySelector('parsererror')) return [];
  return [...xml.querySelectorAll('channel > item')].map((item, index) => {
    const enclosure = item.querySelector('enclosure');
    return {
      id: item.querySelector('guid')?.textContent?.trim() || `episode-${index + 1}`,
      title: item.querySelector('title')?.textContent?.trim() || 'Episodio',
      description: item.querySelector('description')?.textContent?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '',
      published: item.querySelector('pubDate')?.textContent?.trim() || '',
      audioUrl: enclosure?.getAttribute('url') || ''
    };
  }).filter(item => item.audioUrl);
}

export function renderPodcast({ root, router, nativeActions, t, setScreenCleanup }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.podcast'), backLabel: t('nav.back') });

  const lang = document.documentElement.lang === 'en' ? 'en' : 'es';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = lang === 'en' ? 'Loading episodes…' : 'Cargando episodios…';

  const player = document.createElement('section');
  player.className = 'content-card podcast-player';
  player.hidden = true;

  const playerHeading = document.createElement('h2');
  playerHeading.textContent = lang === 'en' ? 'Podcast player' : 'Reproductor de Podcast';

  const currentTitle = document.createElement('p');
  currentTitle.className = 'podcast-current-title';

  const audio = document.createElement('audio');
  audio.preload = 'metadata';

  const controls = document.createElement('div');
  controls.className = 'action-group';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', playerHeading.textContent);

  const rewind = document.createElement('button');
  rewind.type = 'button';
  rewind.textContent = lang === 'en' ? 'Back 30 seconds' : 'Retroceder 30 segundos';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = lang === 'en' ? 'Play' : 'Reproducir';

  const forward = document.createElement('button');
  forward.type = 'button';
  forward.textContent = lang === 'en' ? 'Forward 30 seconds' : 'Avanzar 30 segundos';

  const positionLabel = document.createElement('label');
  positionLabel.textContent = lang === 'en' ? 'Episode position' : 'Posición del episodio';
  const position = document.createElement('input');
  position.type = 'range';
  position.min = '0';
  position.max = '0';
  position.step = '1';
  position.value = '0';
  positionLabel.append(position);

  const timeStatus = document.createElement('p');
  timeStatus.className = 'muted';
  timeStatus.setAttribute('aria-live', 'polite');

  controls.append(rewind, toggle, forward);
  player.append(playerHeading, currentTitle, controls, positionLabel, timeStatus);

  const episodesHeading = document.createElement('h2');
  episodesHeading.textContent = lang === 'en' ? 'Episodes' : 'Episodios';
  const episodeList = document.createElement('div');
  episodeList.className = 'content-list';

  const externalHeading = document.createElement('h2');
  externalHeading.textContent = lang === 'en' ? 'Listen on other services' : 'Escuchar en otros servicios';
  const externalActions = document.createElement('div');
  externalActions.className = 'screen-actions';
  for (const [key, href] of PLATFORMS) {
    addExternalLink(externalActions, { href, label: t(key), onOpen: nativeActions?.openExternal });
  }

  root.append(status, player, episodesHeading, episodeList, externalHeading, externalActions);

  function updateTime() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    position.max = String(Math.max(0, Math.floor(duration)));
    position.value = String(Math.max(0, Math.floor(current)));
    timeStatus.textContent = lang === 'en'
      ? `${secondsLabel(current)} of ${secondsLabel(duration)}`
      : `${secondsLabel(current)} de ${secondsLabel(duration)}`;
  }

  function loadEpisode(episode, button) {
    audio.pause();
    audio.src = episode.audioUrl;
    currentTitle.textContent = episode.title;
    toggle.textContent = lang === 'en' ? 'Play' : 'Reproducir';
    player.hidden = false;
    updateTime();
    queueMicrotask(() => toggle.focus());
    button?.setAttribute('aria-current', 'true');
  }

  rewind.addEventListener('click', () => {
    audio.currentTime = Math.max(0, audio.currentTime - 30);
    updateTime();
  });
  forward.addEventListener('click', () => {
    audio.currentTime = Math.min(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + 30, audio.currentTime + 30);
    updateTime();
  });
  toggle.addEventListener('click', () => {
    if (audio.paused) void audio.play();
    else audio.pause();
  });
  position.addEventListener('input', () => {
    audio.currentTime = Math.max(0, Number(position.value) || 0);
    updateTime();
  });
  audio.addEventListener('play', () => {
    toggle.textContent = lang === 'en' ? 'Pause' : 'Pausar';
  });
  audio.addEventListener('pause', () => {
    toggle.textContent = lang === 'en' ? 'Play' : 'Reproducir';
  });
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('loadedmetadata', updateTime);
  audio.addEventListener('ended', () => {
    toggle.textContent = lang === 'en' ? 'Play' : 'Reproducir';
    updateTime();
  });

  setScreenCleanup?.(() => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  });

  void (async () => {
    try {
      const response = await fetch(FEED_URL);
      if (!response.ok) throw new Error('feed');
      const episodes = parseEpisodes(await response.text()).slice(0, 30);
      if (!episodes.length) throw new Error('empty');
      status.textContent = '';
      for (const episode of episodes) {
        const article = document.createElement('article');
        article.className = 'content-card';
        const heading = document.createElement('h3');
        heading.textContent = episode.title;
        article.append(heading);
        if (episode.published) addParagraph(article, episode.published, 'muted');
        if (episode.description) addParagraph(article, episode.description);
        const listen = document.createElement('button');
        listen.type = 'button';
        listen.textContent = lang === 'en' ? `Play: ${episode.title}` : `Escuchar: ${episode.title}`;
        listen.addEventListener('click', () => loadEpisode(episode, listen));
        article.append(listen);
        episodeList.append(article);
      }
    } catch {
      status.textContent = lang === 'en'
        ? 'Episodes could not be loaded. You can still use the external podcast services below.'
        : 'No se pudieron cargar los episodios. Puedes seguir usando los servicios externos que aparecen a continuación.';
    }
  })();
}
