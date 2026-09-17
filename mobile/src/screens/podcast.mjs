import { addExternalLink, addScreenHeader, clearScreen } from './shared.mjs';

const PLATFORMS = [
  ['podcast.spotify', 'https://open.spotify.com/show/6z5BbrUhRuMANB5BFJfdfB'],
  ['podcast.apple', 'https://podcasts.apple.com/es/podcast/canal-tifloacosta/id1567846456'],
  ['podcast.ivoox', 'https://www.ivoox.com/podcast-canal-tifloacosta_sq_f11282163_1.html'],
  ['podcast.podimo', 'https://podimo.com/es/shows/canal-tifloacosta'],
  ['podcast.radio', 'https://www.radio.es/podcast/canal-tifloacosta']
];

export function renderPodcast({ root, router, nativeActions, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.podcast'), backLabel: t('nav.back') });
  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  for (const [key, href] of PLATFORMS) {
    addExternalLink(actions, { href, label: t(key), onOpen: nativeActions?.openExternal });
  }
  root.append(actions);
}
