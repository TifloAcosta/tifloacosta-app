(() => {
  'use strict';

  const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

  const copy = {
    es: {
      heading: 'Acciones de YouTube',
      details: 'Ver detalles',
      hideDetails: 'Ocultar detalles',
      connectInfo: 'Para suscribirte al canal, marcar Me gusta o comentar, conecta tu cuenta de YouTube.',
      signIn: 'Iniciar sesión en YouTube',
      subscribe: 'Suscribirme al canal TifloAcosta',
      subscribed: 'Ya estás suscrito al canal TifloAcosta',
      subscribeSuccess: 'Suscripción realizada. Ya estás suscrito al canal TifloAcosta.',
      like: 'Me gusta este vídeo',
      liked: 'Ya has marcado Me gusta en este vídeo',
      likeSuccess: 'Has marcado Me gusta en este vídeo.',
      comment: 'Comentar este vídeo',
      commentLabel: 'Escribe tu comentario para YouTube',
      publishComment: 'Publicar comentario',
      cancel: 'Cancelar',
      commentSuccess: 'Comentario publicado en YouTube.',
      logout: 'Cerrar sesión de YouTube en TifloAcosta',
      commentsDisabled: 'YouTube no permite comentarios en este vídeo.',
      videoNotFound: 'Este vídeo ya no está disponible para realizar esta acción.',
      sessionExpired: 'La sesión de YouTube ha caducado. Inicia sesión de nuevo para continuar.',
      genericError: 'No se pudo conectar con YouTube. Puedes seguir viendo el vídeo y volver a intentarlo.',
      published: 'Publicado',
      description: 'Descripción'
    },
    en: {
      heading: 'YouTube actions',
      details: 'View details',
      hideDetails: 'Hide details',
      connectInfo: 'To subscribe to the channel, like this video, or comment, connect your YouTube account.',
      signIn: 'Sign in to YouTube',
      subscribe: 'Subscribe to the TifloAcosta channel',
      subscribed: 'You are already subscribed to the TifloAcosta channel',
      subscribeSuccess: 'Subscription completed. You are now subscribed to the TifloAcosta channel.',
      like: 'Like this video',
      liked: 'You already liked this video',
      likeSuccess: 'You liked this video.',
      comment: 'Comment on this video',
      commentLabel: 'Write your comment for YouTube',
      publishComment: 'Publish comment',
      cancel: 'Cancel',
      commentSuccess: 'Comment published on YouTube.',
      logout: 'Sign out of YouTube in TifloAcosta',
      commentsDisabled: 'YouTube does not allow comments on this video.',
      videoNotFound: 'This video is no longer available for this action.',
      sessionExpired: 'Your YouTube session has expired. Sign in again to continue.',
      genericError: 'TifloAcosta could not connect to YouTube. You can keep watching the video and try again.',
      published: 'Published',
      description: 'Description'
    }
  };

  function initialState() {
    return {
      authenticated: false,
      csrf: '',
      subscribed: null,
      rating: 'none',
      canSubscribe: false,
      canLike: false,
      canComment: false,
      busy: '',
      error: ''
    };
  }

  function accountState(state, event) {
    const subscribed = Boolean(event.subscribed);
    const rating = event.rating === 'like' || event.rating === 'dislike' ? event.rating : 'none';
    return {
      ...state,
      subscribed,
      rating,
      canSubscribe: state.authenticated && !subscribed,
      canLike: state.authenticated && rating !== 'like',
      canComment: state.authenticated,
      busy: '',
      error: ''
    };
  }

  function reduce(state = initialState(), event = {}) {
    switch (event.type) {
      case 'SESSION':
        if (!event.authenticated) return initialState();
        return {
          ...initialState(),
          authenticated: true,
          csrf: typeof event.csrf === 'string' ? event.csrf : ''
        };
      case 'VIDEO_STATE':
        return accountState(state, event);
      case 'SUBSCRIBED':
        return { ...state, subscribed: true, canSubscribe: false, busy: '', error: '' };
      case 'LIKED':
        return { ...state, rating: 'like', canLike: false, busy: '', error: '' };
      case 'BUSY':
        return { ...state, busy: String(event.action || ''), error: '' };
      case 'ERROR':
        return { ...state, busy: '', error: String(event.code || 'YOUTUBE_ERROR') };
      case 'LOGOUT':
      case 'SESSION_EXPIRED':
        return initialState();
      default:
        return { ...state };
    }
  }

  function isValidVideoId(id) {
    return VIDEO_ID_RE.test(String(id || '').trim());
  }

  function detailsFromVideo(video = {}) {
    return {
      id: String(video.id || ''),
      title: String(video.title || ''),
      publishedAt: String(video.publishedAt || ''),
      description: String(video.description || ''),
      url: String(video.url || '')
    };
  }

  function copyFor(lang) {
    return copy[lang === 'en' ? 'en' : 'es'];
  }

  window.TifloYouTubeActionsCore = Object.freeze({
    initialState,
    reduce,
    isValidVideoId,
    detailsFromVideo,
    copyFor
  });
})();
