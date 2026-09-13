import { searchContent } from '../core/search.mjs';

const GROUP_ORDER = ['resource', 'news', 'video'];

export function renderSearch({ root, router, content, preferences, t }) {
  root.replaceChildren();

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.search.title');
  root.append(heading);

  const form = document.createElement('form');
  const label = document.createElement('label');
  label.htmlFor = 'global-search';
  label.textContent = t('search.label');
  const input = document.createElement('input');
  input.id = 'global-search';
  input.type = 'search';
  input.autocomplete = 'off';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = t('search.button');
  form.append(label, input, submit);
  root.append(form);

  const status = document.createElement('p');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  root.append(status);

  const resultsRoot = document.createElement('div');
  root.append(resultsRoot);

  function showResults(results) {
    resultsRoot.replaceChildren();
    status.textContent = t('search.results', results.length);
    if (!results.length) {
      const empty = document.createElement('p');
      empty.textContent = t('search.noResults');
      resultsRoot.append(empty);
      return;
    }

    for (const kind of GROUP_ORDER) {
      const group = results.filter(item => item.kind === kind);
      if (!group.length) continue;
      const section = document.createElement('section');
      const groupHeading = document.createElement('h2');
      groupHeading.textContent = t(`search.group${kind[0].toUpperCase()}${kind.slice(1)}`);
      section.append(groupHeading);
      const list = document.createElement('ul');
      for (const result of group) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.id = `result-${result.kind}-${result.id}`;
        button.textContent = result.title;
        button.addEventListener('click', () => router.navigate(result.route, { originId: button.id }));
        li.append(button);
        if (result.subtitle) {
          const subtitle = document.createElement('p');
          subtitle.textContent = result.subtitle;
          li.append(subtitle);
        }
        list.append(li);
      }
      section.append(list);
      resultsRoot.append(section);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    showResults(searchContent(content, input.value, preferences.lang));
  });
}
