import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderDownloads({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('screen.downloads'),
    backLabel: t('nav.back')
  });
  addParagraph(root, t('downloads.intro'));

  for (const [route, id, label] of [
    ['downloads-link', 'downloads-open-link', t('downloads.link')],
    ['downloads-sounds', 'downloads-open-sounds', t('downloads.sounds')]
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.textContent = label;
    button.addEventListener('click', () => router.navigate(route, { originId: id }));
    root.append(button);
  }
}
