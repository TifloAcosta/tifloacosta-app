(() => {
  'use strict';

  const core = window.TIFLO_APP_CORE;
  const list = document.querySelector('#news-list');
  const count = document.querySelector('#news-count');
  const langEs = document.querySelector('#lang-es');
  const langEn = document.querySelector('#lang-en');
  const resources = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];
  if (!core || typeof core.selectNewsItems !== 'function' || !list || !count) return;

  let videos = [];

  const labels = {
    es: {
      video: 'Vídeo',
      count: n => `${n} novedad${n === 1 ? '' : 'es'} reciente${n === 1 ? '' : 's'}.`
    },
    en: {
      video: 'Video',
      count: n => `${n} recent item${n === 1 ? '' : 's'}.`
    }
  };

  function currentLanguage() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function languageResources(lang) {
    return resources.filter(item => item && item.lang === lang);
  }

  function topResourceNodes(lang) {
    const resourceItems = languageResources(lang)
      .filter(item => item.new)
      .sort(core.compareNewsItems)
      .slice(0, 3);
    const existingNodes = Array.from(list.children);
    const nodes = new Map();
    resourceItems.forEach((item, index) => {
      const node = existingNodes[index];
      if (node && node.dataset.tifloNewsKind !== 'video') nodes.set(item.id, node);
    });
    return nodes;
  }

  function makeVideoNode(item) {
    const article = document.createElement('div');
    article.className = 'news-item';
    article.dataset.tifloNewsKind = 'video';
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.title;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    heading.append(link);
    const meta = document.createElement('p');
    meta.textContent = item.category;
    article.append(heading, meta);
    return article;
  }

  function makeResourceFallback(item) {
    const article = document.createElement('div');
    article.className = 'news-item';
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.title;
    heading.append(link);
    const meta = document.createElement('p');
    meta.textContent = item.category;
    article.append(heading, meta);
    return article;
  }

  function renderCombinedNews() {
    const lang = currentLanguage();
    const resourceNodes = topResourceNodes(lang);
    const items = core.selectNewsItems(languageResources(lang), videos, labels[lang].video, 3);
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
      if (item.newsKind === 'video') {
        fragment.append(makeVideoNode(item));
        return;
      }
      fragment.append(resourceNodes.get(item.id) || makeResourceFallback(item));
    });

    list.replaceChildren(fragment);
    count.textContent = labels[lang].count(items.length);
  }

  async function loadVideos() {
    try {
      const response = await fetch('videos.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      videos = Array.isArray(data.videos) ? data.videos : [];
      renderCombinedNews();
    } catch (error) {
      videos = [];
    }
  }

  [langEs, langEn].filter(Boolean).forEach(button => {
    button.addEventListener('click', renderCombinedNews);
  });

  void loadVideos();
})();
