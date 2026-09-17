import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

const PRINT_URL = 'https://www.amazon.es/s?k=9798185909218&i=stripbooks';
const KINDLE_URL = 'https://www.amazon.es/s?k=La+vida+vista+desde+donde+estoy+Tony+Acosta&i=digital-text';

export function renderBook({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.book'), backLabel: t('nav.back') });

  const title = document.createElement('h2');
  title.textContent = t('book.title');
  root.append(title);
  addParagraph(root, t('book.subtitle'), 'book-subtitle');
  addParagraph(root, t('book.description'));
  addParagraph(root, t('book.description2'));

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  addExternalLink(actions, { href: PRINT_URL, label: t('book.print') });
  addExternalLink(actions, { href: KINDLE_URL, label: t('book.kindle') });
  root.append(actions);
}
