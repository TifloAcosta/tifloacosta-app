const AMAZON_PRINT = 'https://www.amazon.es/s?k=9798185909218&i=stripbooks';
const AMAZON_KINDLE = 'https://www.amazon.es/s?k=La+vida+vista+desde+donde+estoy+Tony+Acosta&i=digital-text';

export function renderBook({ root, router, t }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.book.title');
  root.append(heading);

  const title = document.createElement('h2');
  title.textContent = t('book.title');
  root.append(title);
  for (const key of ['book.subtitle', 'book.description']) {
    const p = document.createElement('p');
    p.textContent = t(key);
    root.append(p);
  }
  for (const [href, label] of [[AMAZON_PRINT, 'book.amazon'], [AMAZON_KINDLE, 'book.kindle']]) {
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = t(label);
    p.append(link);
    root.append(p);
  }
}
