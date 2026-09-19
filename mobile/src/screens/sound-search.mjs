import { addScreenHeader, clearScreen } from './shared.mjs';

export function renderSoundSearch({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('downloads.sounds'),
    backLabel: t('nav.back')
  });
}
