import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderPlaceholder({ root, router, route, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t(`screen.${route}`), backLabel: t('nav.back') });
  addParagraph(root, t(`placeholder.${route}`), 'empty-state');
}
