import { addScreenHeader, clearScreen } from './shared.mjs';

function addSelect(parent, { id, label, value, options, onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-field';
  const labelElement = document.createElement('label');
  labelElement.htmlFor = id;
  labelElement.textContent = label;
  const select = document.createElement('select');
  select.id = id;
  for (const option of options) {
    const element = document.createElement('option');
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value));
  wrapper.append(labelElement, select);
  parent.append(wrapper);
}

function notificationStatusText(state, t) {
  const keys = {
    unavailable: 'notifications.unavailable',
    'not-requested': 'notifications.notRequested',
    denied: 'notifications.denied',
    authorized: 'notifications.authorized'
  };
  return t(keys[state] || 'notifications.unavailable');
}

function addNotificationSettings(root, notificationService, t, onAppResume) {
  const section = document.createElement('section');
  section.className = 'settings-section';

  const heading = document.createElement('h2');
  heading.textContent = t('notifications.title');
  section.append(heading);

  const explanation = document.createElement('p');
  explanation.textContent = t('notifications.explanation');
  section.append(explanation);

  const status = document.createElement('p');
  status.className = 'muted';
  status.setAttribute('aria-live', 'polite');
  section.append(status);

  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  section.append(actions);
  root.append(section);

  async function renderState(nextState) {
    const state = nextState || await notificationService.status();
    status.textContent = notificationStatusText(state, t);
    actions.replaceChildren();

    if (state === 'not-requested') {
      const activate = document.createElement('button');
      activate.type = 'button';
      activate.textContent = t('notifications.activate');
      activate.addEventListener('click', async () => {
        activate.disabled = true;
        await renderState(await notificationService.requestFromUserAction());
      });
      actions.append(activate);
    } else if (state === 'denied') {
      const settings = document.createElement('button');
      settings.type = 'button';
      settings.textContent = t('notifications.openSettings');
      settings.addEventListener('click', () => {
        void notificationService.openSystemSettings();
      });
      actions.append(settings);
    }
  }

  const unregisterResume = typeof onAppResume === 'function'
    ? onAppResume(() => { void renderState(); })
    : null;

  void renderState();
  return () => {
    if (typeof unregisterResume === 'function') unregisterResume();
  };
}

export function renderSettings({
  root,
  router,
  preferences,
  notificationService,
  t,
  onPreferencesChange,
  onAppResume,
  setScreenCleanup
}) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.settings'), backLabel: t('nav.back') });

  addSelect(root, {
    id: 'mobile-language', label: t('settings.language'), value: preferences.lang,
    options: [
      { value: 'es', label: t('settings.spanish') },
      { value: 'en', label: t('settings.english') }
    ],
    onChange: lang => onPreferencesChange({ lang })
  });

  addSelect(root, {
    id: 'mobile-text-size', label: t('settings.textSize'), value: preferences.textSize,
    options: [
      { value: 'normal', label: t('settings.normal') },
      { value: 'large', label: t('settings.large') },
      { value: 'xlarge', label: t('settings.xlarge') },
      { value: 'max', label: t('settings.max') }
    ],
    onChange: textSize => onPreferencesChange({ textSize })
  });

  addSelect(root, {
    id: 'mobile-theme', label: t('settings.theme'), value: preferences.theme,
    options: [
      { value: 'auto', label: t('settings.auto') },
      { value: 'light', label: t('settings.light') },
      { value: 'dark', label: t('settings.dark') }
    ],
    onChange: theme => onPreferencesChange({ theme })
  });

  addSelect(root, {
    id: 'mobile-spacing', label: t('settings.spacing'), value: preferences.spacing,
    options: [
      { value: 'normal', label: t('settings.normal') },
      { value: 'comfortable', label: t('settings.comfortable') },
      { value: 'wide', label: t('settings.wide') }
    ],
    onChange: spacing => onPreferencesChange({ spacing: spacing })
  });

  const boldRow = document.createElement('div');
  boldRow.className = 'settings-field checkbox-field';
  const bold = document.createElement('input');
  bold.id = 'mobile-bold';
  bold.type = 'checkbox';
  bold.checked = preferences.bold;
  const boldLabel = document.createElement('label');
  boldLabel.htmlFor = bold.id;
  boldLabel.textContent = t('settings.bold');
  bold.addEventListener('change', () => onPreferencesChange({ bold: bold.checked }));
  boldRow.append(bold, boldLabel);
  root.append(boldRow);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = t('settings.reset');
  reset.addEventListener('click', () => onPreferencesChange(null, { reset: true }));
  root.append(reset);

  const notificationCleanup = addNotificationSettings(root, notificationService, t, onAppResume);
  setScreenCleanup?.(notificationCleanup);
}
