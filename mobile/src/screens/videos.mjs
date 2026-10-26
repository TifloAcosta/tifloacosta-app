import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';
import { createAccessibleVideoPlayer, videoId, youtubeUrl } from './video-player.mjs';
import { createYoutubeAccountControls } from './youtube-account.mjs';
import { TifloYouTubeAccount } from '../native/youtube-account-plugin.mjs';

const YOUTUBE_ENDPOINT = 'https://youtube-auth.tifloacosta.com';

function addFavoriteButton(parent, item, favoritesStore, t) {
  const ref = { kind: 'video', id: videoId(item) || String(item.id || '') };
  const button = document.createElement('button');
  button.type = 'button';
  function update() {
    const active = favoritesStore.has(ref);
    button.ariaPressed = String(active);
    button.textContent = active ? t('favorites.remove') : t('favorites.add');
  }
  button.addEventListener('click', () => {
    favoritesStore.toggle(ref);
    update();
  });
  update();
  parent.append(button);
}

function matchesInitialVideo(item, initialVideoId) {
  const target = String(initialVideoId || '').trim();
  if (!target) return false;
  return String(item?.id || '').trim() === target || videoId(item) === target;
}

export function renderVideos({
  root,
  router,
  content,
  preferences = { lang: 'es' },
  favoritesStore,
  nativeActions,
  t,
  setScreenCleanup,
  initialVideoId = '',
  onBackStateChange = null
}) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.videos'), backLabel: t('nav.back') });

  const lang = preferences?.lang === 'en' ? 'en' : 'es';
  const copy = lang === 'en'
    ? {
        searchHeading:'Accessible YouTube',
        intro:'Search public YouTube videos from a simple screen designed for screen readers. No Google sign-in is required.',
        label:'What do you want to search for on YouTube?',
        placeholder:'For example: VoiceOver iPhone, TalkBack, accessible technology…',
        search:'Search YouTube',
        more:'Show 10 more results',
        searching:'Searching YouTube…',
        enter:'Enter at least two characters to search.',
        none:'No videos were found for that search.',
        found:n => `${n} result${n === 1 ? '' : 's'} found on this page.`,
        added:n => `${n} more result${n === 1 ? '' : 's'} added.`,
        error:'The YouTube search could not be completed. Please try again in a moment.',
        quota:'YouTube search has temporarily reached its usage limit. Please try again later.',
        unavailable:'YouTube search is not available yet.',
        channel:name => `Channel: ${name}`,
        published:value => `Published: ${value}`,
        duration:value => `Duration: ${value}`,
        play:'Play',
        open:'Open on YouTube',
        own:'TifloAcosta videos',
        moreActions:'More video options',
        hideActions:'Hide additional options'
      }
    : {
        searchHeading:'YouTube accesible',
        intro:'Busca vídeos públicos de YouTube desde una pantalla sencilla, pensada para lector de pantalla. No necesitas iniciar sesión en Google.',
        label:'¿Qué quieres buscar en YouTube?',
        placeholder:'Por ejemplo: VoiceOver iPhone, TalkBack, tecnología accesible…',
        search:'Buscar en YouTube',
        more:'Mostrar 10 resultados más',
        searching:'Buscando en YouTube…',
        enter:'Escribe al menos dos caracteres para buscar.',
        none:'No se encontraron vídeos con esos criterios.',
        found:n => `Se encontraron ${n} resultado${n === 1 ? '' : 's'} en esta página.`,
        added:n => `Se añadieron ${n} resultado${n === 1 ? '' : 's'} más.`,
        error:'No se pudo realizar la búsqueda en YouTube. Inténtalo de nuevo dentro de unos momentos.',
        quota:'La búsqueda de YouTube ha alcanzado temporalmente su límite de uso. Inténtalo más tarde.',
        unavailable:'La búsqueda de YouTube todavía no está disponible.',
        channel:name => `Canal: ${name}`,
        published:value => `Publicado: ${value}`,
        duration:value => `Duración: ${value}`,
        play:'Reproducir',
        open:'Abrir en YouTube',
        own:'Vídeos de TifloAcosta',
        moreActions:'Más opciones del vídeo',
        hideActions:'Ocultar opciones adicionales'
      };

  let player = null;
  let initialTarget = null;
  let nextPageToken = '';
  let currentQuery = '';
  let loading = false;

  function setPlayerBackHandler() {
    onBackStateChange?.(() => player?.close?.() === true);
  }

  player = createAccessibleVideoPlayer({
    parent: root,
    t,
    nativeActions,
    allowYouTubeFallback: true,
    closeLabel: t('videos.closePlayer'),
    onClose: () => onBackStateChange?.(null)
  });

  // A sibling panel leaves the existing accessible IFrame/player untouched.
  const youtubeAccount = createYoutubeAccountControls({
    root, videoRoot: player.getAccountActionsHost(),
    nativeActions, accountPlugin: TifloYouTubeAccount, lang
  });

  function setExtraVideoActions(item) {
    const host = player.getExtraActionsHost();
    host.replaceChildren();
    const url = youtubeUrl(item);
    const hasFavorite = Boolean(videoId(item) && favoritesStore);
    const hasShare = Boolean(url && typeof nativeActions?.share === 'function');
    if (!url && !hasFavorite && !hasShare) return;

    const show = document.createElement('button');
    show.type = 'button';
    show.textContent = copy.moreActions;
    show.setAttribute('aria-expanded', 'false');
    show.setAttribute('aria-controls', 'youtube-extra-video-options');
    const panel = document.createElement('div');
    panel.id = 'youtube-extra-video-options';
    panel.hidden = true;

    if (url) {
      addExternalLink(panel, { href: url, label: copy.open, onOpen: nativeActions?.openExternal });
    }
    if (hasShare) {
      addShareButton(panel, {
        label: t('common.share'),
        title: item.title || '',
        text: item.excerpt || item.description || '',
        url,
        onShare: nativeActions.share
      });
    }
    if (hasFavorite) addFavoriteButton(panel, item, favoritesStore, t);

    show.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      const expanded = !panel.hidden;
      show.setAttribute('aria-expanded', String(expanded));
      show.textContent = expanded ? copy.hideActions : copy.moreActions;
    });
    host.append(show, panel);
  }

  async function openVideo(item, button) {
    setPlayerBackHandler();
    const id = videoId(item);
    if (id) youtubeAccount.selectVideo({ id, title: item?.title || '' });
    setExtraVideoActions(item);
    await player.open(item, button);
  }

  const searchHeading = document.createElement('h2');
  searchHeading.textContent = copy.searchHeading;
  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = copy.intro;

  const form = document.createElement('form');
  form.className = 'search-form';
  const label = document.createElement('label');
  label.htmlFor = 'youtube-search-input';
  label.textContent = copy.label;
  const input = document.createElement('input');
  input.id = 'youtube-search-input';
  input.type = 'search';
  input.autocomplete = 'off';
  input.placeholder = copy.placeholder;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = copy.search;
  form.append(label, input, submit);

  const status = document.createElement('p');
  status.className = 'muted';
  status.tabIndex = -1;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const results = document.createElement('div');
  results.className = 'content-list';

  const more = document.createElement('button');
  more.type = 'button';
  more.textContent = copy.more;
  more.hidden = true;

  function createSearchCard(video) {
    // One accessible title per result: no duplicate heading, description or
    // row of buttons to traverse before TalkBack reaches the next title.
    const article = document.createElement('article');
    article.className = 'content-card compact-video-item';
    const item = {
      ...video,
      url: youtubeUrl(video) || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id || '')}`
    };
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'video-title-button';
    playButton.textContent = video.title || copy.play;
    playButton.addEventListener('click', () => { void openVideo(item, playButton); });
    article.append(playButton);
    return article;
  }

  function setLoading(value) {
    loading = value;
    submit.disabled = value;
    more.disabled = value;
  }

  async function searchYouTube({ append = false } = {}) {
    if (loading) return;
    const query = append ? currentQuery : input.value.trim();
    if (!append && query.length < 2) {
      status.textContent = copy.enter;
      status.focus();
      return;
    }

    if (!append) {
      currentQuery = query;
      nextPageToken = '';
      results.replaceChildren();
      more.hidden = true;
    }

    setLoading(true);
    status.textContent = copy.searching;
    try {
      const url = new URL(`${YOUTUBE_ENDPOINT}/search`);
      url.searchParams.set('q', currentQuery);
      if (append && nextPageToken) url.searchParams.set('pageToken', nextPageToken);

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = String(data.error || '');
        const error = new Error(code || 'SEARCH_ERROR');
        error.code = code;
        throw error;
      }

      const found = Array.isArray(data.items) ? data.items : [];
      for (const item of found) results.append(createSearchCard(item));
      nextPageToken = String(data.nextPageToken || '');
      more.hidden = !nextPageToken;
      status.textContent = found.length
        ? (append ? copy.added(found.length) : copy.found(found.length))
        : copy.none;
      status.focus();
    } catch (error) {
      if (error?.code === 'QUOTA_EXCEEDED') status.textContent = copy.quota;
      else if (error?.code === 'SEARCH_UNAVAILABLE') status.textContent = copy.unavailable;
      else status.textContent = copy.error;
      status.focus();
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    void searchYouTube();
  });
  more.addEventListener('click', () => { void searchYouTube({ append: true }); });

  root.append(searchHeading, intro, form, status, results, more);

  const ownHeading = document.createElement('h2');
  ownHeading.textContent = copy.own;
  root.append(ownHeading);

  const items = Array.isArray(content?.videos) ? content.videos : [];
  if (!items.length) {
    addParagraph(root, t('videos.empty'), 'empty-state');
  } else {
    const list = document.createElement('div');
    list.className = 'content-list';

    for (const item of items) {
      const article = document.createElement('article');
      article.className = 'content-card compact-video-item';
      const id = videoId(item);
      if (id) {
        const playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'video-title-button';
        playButton.id = `video-play-${String(item.id || id)}`;
        playButton.textContent = item.title || t('videos.play');
        playButton.addEventListener('click', () => { void openVideo(item, playButton); });
        article.append(playButton);
        if (matchesInitialVideo(item, initialVideoId)) initialTarget = { item, button: playButton };
      } else {
        const title = document.createElement('p');
        title.textContent = item.title || '';
        article.append(title);
      }
      list.append(article);
    }
    root.append(list);
  }

  if (initialTarget) {
    queueMicrotask(() => { void openVideo(initialTarget.item, initialTarget.button); });
  } else {
    onBackStateChange?.(null);
  }

  setScreenCleanup?.(() => {
    onBackStateChange?.(null);
    youtubeAccount.dispose();
    player.destroy();
  });
}
