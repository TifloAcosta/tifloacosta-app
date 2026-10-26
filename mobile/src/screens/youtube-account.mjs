import { App } from '@capacitor/app';

// El JavaScript nunca recibe el token Bearer ni el refresh token de Google.
const COPY = Object.freeze({
  es: {
    heading: 'Cuenta y acciones de YouTube',
    help: 'Puedes buscar y reproducir vídeos sin iniciar sesión. Identifícate con Google para suscribirte, marcar Me gusta y comentar desde TifloAcosta.',
    signIn: 'Iniciar sesión con Google',
    signOut: 'Cerrar sesión de YouTube',
    signedIn: 'Sesión de YouTube iniciada en TifloAcosta.',
    signedOut: 'La sesión de YouTube está cerrada en TifloAcosta.',
    noVideo: 'Abre un vídeo para disponer de las acciones de su cuenta de YouTube.',
    activeVideo: title => `Acciones del vídeo: ${title}`,
    subscribe: 'Suscribirse al canal de este vídeo',
    unsubscribe: 'Cancelar suscripción al canal',
    subscribed: 'Ya estás suscrito al canal.',
    like: 'Me gusta',
    unlike: 'Retirar Me gusta',
    liked: 'Has marcado Me gusta.',
    comment: 'Escribir un comentario',
    commentLabel: 'Texto del comentario que se publicará en YouTube',
    publish: 'Publicar comentario',
    cancel: 'Cancelar',
    commentSent: 'Comentario publicado en YouTube.',
    subscribedDone: 'Suscripción actualizada.',
    likedDone: 'Valoración actualizada.',
    waiting: 'Consultando el estado de tu cuenta.',
    opening: 'Abriendo la autorización segura de Google.',
    signedInDone: 'Inicio de sesión con Google completado.',
    noBrowser: 'No se pudo abrir el acceso seguro a Google.',
    notAvailable: 'Las acciones de cuenta de YouTube no están disponibles en esta instalación.',
    network: 'No se pudo contactar con YouTube. Comprueba la conexión e inténtalo de nuevo.',
    denied: 'Se ha cancelado el inicio de sesión o no se han autorizado los permisos de Google.',
    expired: 'La sesión de YouTube ha caducado. Vuelve a iniciar sesión.',
    invalid: 'La autorización de Google no se pudo completar. Repite el inicio de sesión.',
    forbidden: 'YouTube no permite esta operación con la cuenta seleccionada.',
    commentsDisabled: 'Los comentarios están desactivados en este vídeo.',
    invalidComment: 'Escribe un comentario antes de publicarlo.',
    rate: 'YouTube ha alcanzado temporalmente su límite de solicitudes.',
    error: 'No se pudo completar la operación de YouTube.'
  },
  en: {
    heading: 'YouTube account and actions',
    help: 'Searching and playing videos does not require sign-in. Sign in with Google to subscribe, like and comment from TifloAcosta.',
    signIn: 'Sign in with Google',
    signOut: 'Sign out of YouTube',
    signedIn: 'Your YouTube session is active in TifloAcosta.',
    signedOut: 'Your YouTube session is closed in TifloAcosta.',
    noVideo: 'Open a video to access YouTube account actions for that video.',
    activeVideo: title => `Actions for: ${title}`,
    subscribe: 'Subscribe to this video channel',
    unsubscribe: 'Unsubscribe from this video channel',
    subscribed: 'You are subscribed to this channel.',
    like: 'Like',
    unlike: 'Remove like',
    liked: 'You liked this video.',
    comment: 'Write a comment',
    commentLabel: 'Your comment to publish on YouTube',
    publish: 'Publish comment',
    cancel: 'Cancel',
    commentSent: 'Comment published on YouTube.',
    subscribedDone: 'Subscription updated.',
    likedDone: 'Rating updated.',
    waiting: 'Checking your YouTube account.',
    opening: 'Opening secure Google sign-in.',
    signedInDone: 'Google sign-in completed.',
    noBrowser: 'Secure Google sign-in could not be opened.',
    notAvailable: 'YouTube account actions are not available in this installation.',
    network: 'Unable to reach YouTube. Check your connection and try again.',
    denied: 'Google sign-in was cancelled or permission was not granted.',
    expired: 'Your YouTube session expired. Sign in again.',
    invalid: 'Google authorization could not be completed. Please try signing in again.',
    forbidden: 'YouTube does not allow this operation with the selected account.',
    commentsDisabled: 'Comments are disabled for this video.',
    invalidComment: 'Enter a comment before publishing.',
    rate: 'YouTube has temporarily reached its usage limit.',
    error: 'The YouTube action could not be completed.'
  }
});

export function youtubeAccountError(code, lang = 'es') {
  const copy = COPY[lang === 'en' ? 'en' : 'es'];
  switch (String(code || '')) {
    case 'AUTH_DENIED': return copy.denied;
    case 'NATIVE_AUTH_INVALID': return copy.invalid;
    case 'SESSION_EXPIRED': return copy.expired;
    case 'COMMENTS_DISABLED': return copy.commentsDisabled;
    case 'INVALID_COMMENT': return copy.invalidComment;
    case 'INELIGIBLE_ACCOUNT':
    case 'INSUFFICIENT_PERMISSIONS':
    case 'YOUTUBE_FORBIDDEN': return copy.forbidden;
    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMITED': return copy.rate;
    case 'NETWORK': return copy.network;
    default: return copy.error;
  }
}

function validVideoId(value) {
  return /^[A-Za-z0-9_-]{11}$/.test(String(value || ''));
}

/** Screen-scoped account panel; never changes the YouTube IFrame player. */
export function createYoutubeAccountControls({
  root, videoRoot = null, nativeActions, accountPlugin, lang = 'es', appPlugin = App
}) {
  const copy = COPY[lang === 'en' ? 'en' : 'es'];
  const section = document.createElement('section');
  section.className = 'settings-section youtube-account-section';
  section.setAttribute('aria-label', copy.heading);
  const heading = document.createElement('h2');
  heading.textContent = copy.heading;
  const introduction = document.createElement('p');
  introduction.textContent = copy.help;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.className = 'muted';
  const sessionButton = document.createElement('button');
  sessionButton.id = 'youtube-account-session';
  sessionButton.type = 'button';
  const noVideo = document.createElement('p');
  noVideo.textContent = copy.noVideo;
  section.append(heading, introduction, status, sessionButton, noVideo);
  root.append(section);

  // The session is managed once, but contextual actions live with the player.
  // Keeping all buttons mounted prevents TalkBack from losing focused controls.
  const videoSection = document.createElement('section');
  videoSection.className = 'youtube-video-actions';
  videoSection.setAttribute('aria-label', lang === 'en' ? 'Video actions' : 'Acciones de este vídeo');
  const videoHeading = document.createElement('h3');
  videoHeading.textContent = lang === 'en' ? 'Video actions' : 'Acciones de este vídeo';
  const videoName = document.createElement('p');
  const videoStatus = document.createElement('p');
  videoStatus.className = 'muted';
  const actions = document.createElement('div');
  actions.className = 'action-group';
  const subscribeButton = document.createElement('button');
  subscribeButton.id = 'youtube-account-subscribe-action';
  subscribeButton.type = 'button';
  const likeButton = document.createElement('button');
  likeButton.id = 'youtube-account-like-action';
  likeButton.type = 'button';
  const commentButton = document.createElement('button');
  commentButton.id = 'youtube-account-comment';
  commentButton.type = 'button';
  commentButton.textContent = copy.comment;

  const editor = document.createElement('div');
  const commentLabel = document.createElement('label');
  commentLabel.htmlFor = 'youtube-account-comment-text';
  commentLabel.textContent = copy.commentLabel;
  const commentText = document.createElement('textarea');
  commentText.id = commentLabel.htmlFor;
  commentText.rows = 4;
  commentText.maxLength = 10000;
  const publishButton = document.createElement('button');
  publishButton.id = 'youtube-account-publish';
  publishButton.type = 'button';
  publishButton.textContent = copy.publish;
  const cancelButton = document.createElement('button');
  cancelButton.id = 'youtube-account-cancel';
  cancelButton.type = 'button';
  cancelButton.textContent = copy.cancel;
  editor.append(commentLabel, commentText, publishButton, cancelButton);
  actions.append(subscribeButton, likeButton, commentButton, editor);
  videoSection.append(videoHeading, videoName, videoStatus, actions);
  (videoRoot || root).append(videoSection);

  let signedIn = false;
  let busy = false;
  let pendingAuth = false;
  let selected = null;
  let state = null;
  let editing = false;
  let disposed = false;
  let listener = null;

  const available = accountPlugin &&
    ['beginSignIn', 'completeSignIn', 'getSession', 'getVideoState',
      'performAction', 'signOut'].every(key => typeof accountPlugin[key] === 'function');

  function message(text) {
    if (disposed) return;
    status.textContent = text;
    // This readable status is next to the actions; only the first is live.
    videoStatus.textContent = text;
  }

  sessionButton.addEventListener('click', () => {
    if (busy) return;
    if (signedIn) void signOut();
    else void beginSignIn();
  });
  subscribeButton.addEventListener('click', () => {
    if (busy || !state) return;
    void execute(state.subscribed === true ? 'unsubscribe' : 'subscribe');
  });
  likeButton.addEventListener('click', () => {
    if (busy || !state) return;
    void execute(state.rating === 'like' ? 'unlike' : 'like');
  });
  commentButton.addEventListener('click', () => {
    if (busy) return;
    editing = true;
    render();
    commentText.focus();
  });
  publishButton.addEventListener('click', () => {
    if (busy) return;
    const text = commentText.value.trim();
    if (!text) {
      message(copy.invalidComment);
      commentText.focus();
      return;
    }
    void execute('comment', text);
  });
  cancelButton.addEventListener('click', () => {
    editing = false;
    render();
    commentButton.focus();
  });

  function render() {
    if (disposed) return;
    introduction.hidden = signedIn;
    sessionButton.hidden = !available;
    sessionButton.textContent = signedIn ? copy.signOut : copy.signIn;
    sessionButton.setAttribute('aria-disabled', String(busy));
    noVideo.hidden = !signedIn || Boolean(selected);
    videoSection.hidden = !available || !signedIn || !selected;

    if (!available) {
      message(copy.notAvailable);
      return;
    }
    if (!selected || !signedIn) return;

    videoName.textContent = copy.activeVideo(selected.title);
    const hasState = state !== null;
    subscribeButton.hidden = !hasState || typeof state?.subscribed !== 'boolean';
    subscribeButton.textContent = state?.subscribed === true ? copy.unsubscribe : copy.subscribe;
    likeButton.hidden = !hasState;
    likeButton.textContent = state?.rating === 'like' ? copy.unlike : copy.like;
    commentButton.hidden = !hasState;
    editor.hidden = !hasState || !editing;
    for (const control of [subscribeButton, likeButton, commentButton, publishButton, cancelButton]) {
      control.setAttribute('aria-disabled', String(busy));
    }
  }

  async function refreshSession() {
    if (!available || disposed) return;
    try {
      const result = await accountPlugin.getSession();
      if (disposed) return;
      signedIn = result?.authenticated === true;
      render();
      if (signedIn && selected) await loadVideoState();
    } catch (error) {
      if (!disposed) message(youtubeAccountError(error?.message || 'NETWORK', lang));
    }
  }

  async function beginSignIn() {
    if (busy || disposed || !available) return;
    busy = true;
    message(copy.opening);
    render();
    try {
      // Do not open the browser unless the callback listener exists.
      await listenerReady;
      if (!listener || disposed) throw new Error('NETWORK');
      const start = await accountPlugin.beginSignIn();
      pendingAuth = true;
      const opened = await nativeActions?.openExternal?.(start?.url || '');
      if (!opened) throw new Error('NETWORK');
    } catch (error) {
      pendingAuth = false;
      message(error?.message === 'NETWORK' ? copy.noBrowser
        : youtubeAccountError(error?.message, lang));
    } finally {
      busy = false;
      render();
    }
  }

  async function completeSignIn(url) {
    if (!pendingAuth || disposed) return;
    pendingAuth = false;
    busy = true;
    render();
    try {
      const result = await accountPlugin.completeSignIn({ url });
      if (disposed) return;
      signedIn = result?.authenticated === true;
      state = null;
      editing = false;
      message(signedIn ? copy.signedInDone : copy.invalid);
      if (signedIn && selected) await loadVideoState();
    } catch (error) {
      if (!disposed) message(youtubeAccountError(error?.message, lang));
    } finally {
      busy = false;
      render();
    }
  }

  async function signOut() {
    if (busy || disposed) return;
    busy = true;
    render();
    try {
      await accountPlugin.signOut();
      signedIn = false;
      state = null;
      editing = false;
      pendingAuth = false;
      message(copy.signedOut);
    } catch (error) {
      message(youtubeAccountError(error?.message, lang));
    } finally {
      busy = false;
      render();
    }
  }

  async function loadVideoState() {
    if (disposed || !available || !signedIn || !selected) return;
    const id = selected.id;
    message(copy.waiting);
    try {
      const result = await accountPlugin.getVideoState({ videoId: id });
      if (disposed || selected?.id !== id) return;
      state = result;
      message('');
    } catch (error) {
      if (disposed || selected?.id !== id) return;
      if (error?.message === 'SESSION_EXPIRED') {
        signedIn = false;
        state = null;
      }
      message(youtubeAccountError(error?.message, lang));
    }
    render();
  }

  async function execute(action, text = '') {
    if (busy || !signedIn || !selected || disposed) return;
    const id = selected.id;
    busy = true;
    render();
    try {
      await accountPlugin.performAction({ action, videoId: id, ...(action === 'comment' ? { text } : {}) });
      if (disposed || selected?.id !== id) return;
      editing = false;
      if (action === 'comment') commentText.value = '';
      const confirmation = action === 'comment' ? copy.commentSent
        : action.includes('subscribe') ? copy.subscribedDone : copy.likedDone;
      await loadVideoState();
      // Refreshing remote state must not erase the success announcement.
      if (!disposed && selected?.id === id) message(confirmation);
    } catch (error) {
      if (!disposed) {
        if (error?.message === 'SESSION_EXPIRED') { signedIn = false; state = null; }
        message(youtubeAccountError(error?.message, lang));
      }
    } finally {
      busy = false;
      render();
      if (action === 'comment' && !editing && !disposed) commentButton.focus();
    }
  }

  function selectVideo(item) {
    const id = String(item?.id || '');
    if (!validVideoId(id)) return;
    selected = { id, title: String(item?.title || '') };
    state = null;
    editing = false;
    commentText.value = '';
    render();
    if (signedIn) void loadVideoState();
  }

  const listenerReady = !appPlugin?.addListener
    ? Promise.resolve(null)
    : appPlugin.addListener('appUrlOpen', ({ url }) => {
        if (!/^tifloacosta:\/\/youtube-auth(?:\?|$)/.test(String(url || ''))) return;
        void completeSignIn(url);
      }).then(handle => { listener = handle; return handle; }).catch(() => null);

  void refreshSession();

  return {
    selectVideo,
    dispose() {
      disposed = true;
      pendingAuth = false;
      void listenerReady.then(handle => handle?.remove?.());
    }
  };
}
