export function renderUpdate({ root, session, t, onDismiss = () => {}, onComplete = () => {} } = {}) {
  const state = session?.state?.() || { mode: 'none', info: null };
  root.replaceChildren();

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('update.title');
  root.append(heading);

  const version = String(state.info?.versionName || '').trim();
  const intro = document.createElement('p');
  intro.textContent = version
    ? t('update.availableVersion').replace('{version}', version)
    : t('update.available');
  root.append(intro);

  const updateButton = document.createElement('button');
  updateButton.type = 'button';
  updateButton.dataset.action = 'update';
  updateButton.textContent = t('update.now');
  updateButton.addEventListener('click', async () => {
    updateButton.disabled = true;
    try {
      await session.start();
    } finally {
      updateButton.disabled = false;
    }
  });
  root.append(updateButton);

  if (state.mode !== 'immediate') {
    const laterButton = document.createElement('button');
    laterButton.type = 'button';
    laterButton.dataset.action = 'later';
    laterButton.textContent = t('update.later');
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
    completeButton.textContent = t('update.restart');
    completeButton.addEventListener('click', async () => {
      await session.complete();
      onComplete();
    });
    root.append(completeButton);
  }
}
