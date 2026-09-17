export function clearScreen(root) {
  root.replaceChildren();
}

export function addScreenHeader(root, { router, title, backLabel }) {
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back-button';
  back.textContent = backLabel;
  back.addEventListener('click', () => router.back());

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = title;

  root.append(back, heading);
  return { back, heading };
}

export function addExternalLink(parent, { href, label, onOpen = null }) {
  const link = document.createElement('a');
  link.className = 'action-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;

  if (typeof onOpen === 'function' && /^https?:\/\//i.test(String(href || ''))) {
    link.addEventListener('click', async event => {
      event.preventDefault();
      try {
        const handled = await onOpen(href);
        if (!handled) window.open(href, '_blank', 'noopener,noreferrer');
      } catch {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    });
  }

  parent.append(link);
  return link;
}

export function addShareButton(parent, { label, title = '', text = '', url = '', onShare = null }) {
  if (typeof onShare !== 'function' || (!title && !text && !url)) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'share-button';
  button.textContent = label;
  button.addEventListener('click', () => {
    void onShare({ title, text, url });
  });
  parent.append(button);
  return button;
}

export function addParagraph(parent, text, className = '') {
  const paragraph = document.createElement('p');
  if (className) paragraph.className = className;
  paragraph.textContent = text;
  parent.append(paragraph);
  return paragraph;
}
