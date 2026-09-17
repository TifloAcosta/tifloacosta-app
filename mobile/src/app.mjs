const root = document.querySelector('#app');

if (!root) throw new Error('Missing mobile app root');

root.innerHTML = '<h1 data-screen-heading tabindex="-1">TifloAcosta</h1>';
