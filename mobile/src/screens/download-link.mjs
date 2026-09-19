import { addScreenHeader, clearScreen } from './shared.mjs';

export function renderDownloadLink({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('downloads.link'),
    backLabel: t('nav.back')
  });
}
