export const PODCAST_LINKS = [
  ['Spotify', 'https://open.spotify.com/show/6z5BbrUhRuMANB5BFJfdfB'],
  ['Apple Podcasts', 'https://podcasts.apple.com/es/podcast/canal-tifloacosta/id1567846456'],
  ['iVoox', 'https://www.ivoox.com/podcast-canal-tifloacosta_sq_f11282163_1.html'],
  ['Podimo', 'https://podimo.com/es/shows/canal-tifloacosta'],
  ['radio.es', 'https://www.radio.es/podcast/canal-tifloacosta']
];

export function renderPodcast({ root, router, t }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.podcast.title');
  root.append(heading);

  const list = document.createElement('ul');
  for (const [label, href] of PODCAST_LINKS) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    li.append(link);
    list.append(li);
  }
  root.append(list);
}
