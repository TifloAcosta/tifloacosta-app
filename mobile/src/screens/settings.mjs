function option(value, label, selected) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  item.selected = selected === value;
  return item;
}

function selectRow({ root, id, label, value, values, onChange }) {
  const wrapper = document.createElement('div');
  const fieldLabel = document.createElement('label');
  fieldLabel.htmlFor = id;
  fieldLabel.textContent = label;
  const select = document.createElement('select');
  select.id = id;
  for (const [optionValue, optionLabel] of values) select.append(option(optionValue, optionLabel, value));
  select.addEventListener('change', () => onChange(select.value));
  wrapper.append(fieldLabel, select);
  root.append(wrapper);
}

export function renderSettings({ root, router, preferences, t, onPreferencesChange }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.settings.title');
  root.append(heading);

  selectRow({
    root,
    id: 'setting-language',
    label: t('settings.language'),
    value: preferences.lang,
    values: [['es', t('settings.spanish')], ['en', t('settings.english')]],
    onChange: lang => onPreferencesChange({ lang })
  });
  selectRow({
    root,
    id: 'setting-text-size',
    label: t('settings.textSize'),
    value: preferences.textSize,
    values: [['normal', t('settings.normal')], ['large', t('settings.large')], ['xlarge', t('settings.xlarge')], ['max', t('settings.max')]],
    onChange: textSize => onPreferencesChange({ textSize })
  });
  selectRow({
    root,
    id: 'setting-theme',
    label: t('settings.theme'),
    value: preferences.theme,
    values: [['auto', t('settings.auto')], ['light', t('settings.light')], ['dark', t('settings.dark')]],
    onChange: theme => onPreferencesChange({ theme })
  });
  selectRow({
    root,
    id: 'setting-spacing',
    label: t('settings.spacing'),
    value: preferences.spacing,
    values: [['normal', t('settings.normal')], ['comfortable', t('settings.comfortable')], ['wide', t('settings.wide')]],
    onChange: spacing => onPreferencesChange({ spacing })
  });

  const wrapper = document.createElement('div');
  const bold = document.createElement('input');
  bold.type = 'checkbox';
  bold.id = 'setting-bold';
  bold.checked = preferences.bold;
  bold.addEventListener('change', () => onPreferencesChange({ bold: bold.checked }));
  const boldLabel = document.createElement('label');
  boldLabel.htmlFor = bold.id;
  boldLabel.textContent = t('settings.bold');
  wrapper.append(bold, boldLabel);
  root.append(wrapper);
}
