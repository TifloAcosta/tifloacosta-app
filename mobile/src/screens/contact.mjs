import { addExternalLink, addScreenHeader, clearScreen } from './shared.mjs';

const DIRECT_CONTACTS = [
  ['contact.whatsapp', 'https://wa.me/34603516398'],
  ['contact.email', 'mailto:tifloacosta@gmail.com']
];

const SOCIAL_CONTACTS = [
  ['contact.instagram', 'https://www.instagram.com/tifloacosta/'],
  ['contact.facebook', 'https://www.facebook.com/profile.php?id=61586738581998']
];

function localizedHeading(es, en) {
  return document.documentElement.lang === 'en' ? en : es;
}

function addContactSection(root, { title, contacts, nativeActions, t }) {
  const section = document.createElement('section');
  section.className = 'content-card section-stack';

  const heading = document.createElement('h2');
  heading.textContent = title;

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  for (const [key, href] of contacts) {
    addExternalLink(actions, { href, label: t(key), onOpen: nativeActions?.openExternal });
  }

  section.append(heading, actions);
  root.append(section);
}

export function renderContact({ root, router, nativeActions, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.contact'), backLabel: t('nav.back') });

  addContactSection(root, {
    title: localizedHeading('Contacto directo', 'Direct contact'),
    contacts: DIRECT_CONTACTS,
    nativeActions,
    t
  });

  addContactSection(root, {
    title: localizedHeading('Redes sociales', 'Social networks'),
    contacts: SOCIAL_CONTACTS,
    nativeActions,
    t
  });
}
