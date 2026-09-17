import { addExternalLink, addScreenHeader, clearScreen } from './shared.mjs';

const CONTACTS = [
  ['contact.whatsapp', 'https://wa.me/34603516398'],
  ['contact.email', 'mailto:tifloacosta@gmail.com'],
  ['contact.instagram', 'https://www.instagram.com/tifloacosta/'],
  ['contact.facebook', 'https://www.facebook.com/profile.php?id=61586738581998']
];

export function renderContact({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.contact'), backLabel: t('nav.back') });
  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  for (const [key, href] of CONTACTS) addExternalLink(actions, { href, label: t(key) });
  root.append(actions);
}
