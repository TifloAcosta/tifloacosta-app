const COPY = {
  es: {
    title: 'Nueva versión disponible',
    available: 'Hay una actualización disponible para TifloAcosta.',
    availableVersion: 'La versión {version} está disponible para instalar.',
    now: 'Actualizar ahora',
    later: 'Más tarde',
    restart: 'Reiniciar para completar la actualización'
  },
  en: {
    title: 'New version available',
    available: 'A TifloAcosta update is available.',
    availableVersion: 'Version {version} is available to install.',
    now: 'Update now',
    later: 'Later',
    restart: 'Restart to complete the update'
  }
};

export function renderUpdate({ root, session, lang = 'es', onStart = () => {}, onDismiss = () => {}, onComplete = () => {} } = {}) {
  const state = session?.state?.() || { mode: 'none', info: null };
  const copy = lang === 'en' ? COPY.en : COPY.es;
  root.replaceChildren();

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = copy.title;
  root.append(heading);

  const version = String(state.info?.versionName || '').trim();
  const intro = document.createElement('p');
  intro.textContent = version
    ? copy.availableVersion.replace('{version}', version)
    : copy.available;
  root.append(intro);

  const updateButton = document.createElement('button');
  updateButton.type = 'button';
  updateButton.dataset.action = 'update';
  updateButton.textContent = copy.now;
  updateButton.addEventListener('click', async () => {
    updateButton.disabled = true;
    try {
      const result = await session.start();
      if (result?.started === true) onStart();
    } finally {
      updateButton.disabled = false;
    }
  });
  root.append(updateButton);

  if (state.mode !== 'immediate') {
    const laterButton = document.createElement('button');
    laterButton.type = 'button';
    laterButton.dataset.action = 'later';
    laterButton.textContent = copy.later;
    laterButton.addEventListener('click', () => {
      session.dismissForSession();
      onDismiss();
    });
    root.append(laterButton);
  }

  if (Number(state.info?.installStatus) === 11) {
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.dataset.action = 'complete';
    completeButton.textContent = copy.restart;
    completeButton.addEventListener('click', async () => {
      await session.complete();
      onComplete();
    });
    root.append(completeButton);
  }
}
