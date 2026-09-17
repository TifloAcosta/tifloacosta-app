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

export function renderSettings({ root, router, preferences, t, onPreferencesChange }) {
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
    onChange: spacing => onPreferencesChange({ spacing })
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
}
