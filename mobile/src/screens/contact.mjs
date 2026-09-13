export const CONTACT_LINKS = [
  ['whatsapp', 'https://wa.me/34603516398'],
  ['email', 'mailto:tifloacosta@gmail.com'],
  ['instagram', 'https://www.instagram.com/tifloacosta/'],
  ['facebookChannel', 'https://www.facebook.com/profile.php?id=61586738581998'],
  ['facebookTony', 'https://facebook.com/tony.acostaacosta']
];

export function renderContact({ root, router, t }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.contact.title');
  root.append(heading);

  const list = document.createElement('ul');
  for (const [labelKey, href] of CONTACT_LINKS) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    if (!href.startsWith('mailto:')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.textContent = t(`contact.${labelKey}`);
    li.append(link);
    list.append(li);
  }
  root.append(list);
}
