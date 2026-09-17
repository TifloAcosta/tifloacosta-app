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

export function addExternalLink(parent, { href, label }) {
  const link = document.createElement('a');
  link.className = 'action-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  parent.append(link);
  return link;
}

export function addParagraph(parent, text, className = '') {
  const paragraph = document.createElement('p');
  if (className) paragraph.className = className;
  paragraph.textContent = text;
  parent.append(paragraph);
  return paragraph;
}
