import { readFile, writeFile } from 'node:fs/promises';

const path = 'actualidad-core.js';
let text = await readFile(path, 'utf8');

const oldHelper = `  function currentLanguage() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }
`;
const newHelper = `  function focusTopBackOrHeading(section, headingSelector) {
    const backButton = section?.querySelector('[data-isolated-back="top"] button');
    if (backButton) {
      focusElement(backButton);
      return;
    }
    focusElement(document.querySelector(headingSelector));
  }

  function currentLanguage() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }
`;
if (!text.includes(oldHelper)) throw new Error('Expected focus helper insertion point not found');
text = text.replace(oldHelper, newHelper);

const oldFocus = `    const focusTargets = {
      'actualidad-home': '#actualidad-heading',
      'news-browser': '#news-heading',
      'apps-browser': '#apps-heading',
      'media-browser': '#media-heading',
      'media-accessibility': '#media-accessibility-heading',
      'media-technology': '#media-technology-heading'
    };
    focusElement(document.querySelector(focusTargets[state.view] || '#main'));
`;
const newFocus = `    const focusTargets = {
      'actualidad-home': [null, '#actualidad-heading'],
      'news-browser': [news, '#news-heading'],
      'apps-browser': [apps, '#apps-heading'],
      'media-browser': [media, '#media-heading'],
      'media-accessibility': [mediaAccessibility, '#media-accessibility-heading'],
      'media-technology': [mediaTechnology, '#media-technology-heading']
    };
    const [section, headingSelector] = focusTargets[state.view] || [null, '#main'];
    if (section) focusTopBackOrHeading(section, headingSelector);
    else focusElement(document.querySelector(headingSelector));
`;
if (!text.includes(oldFocus)) throw new Error('Expected focus target block not found');
text = text.replace(oldFocus, newFocus);

await writeFile(path, text);
