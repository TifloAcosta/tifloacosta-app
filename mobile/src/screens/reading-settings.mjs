import { resolveReadingSettings } from '../core/reading-settings.mjs';

const VISUAL_KEYS = [
  'visual.textSize',
  'visual.fontFamily',
  'visual.fontWeight',
  'visual.lineSpacing',
  'visual.paragraphSpacing',
  'visual.readingWidth',
  'visual.highContrast',
  'visual.theme'
];

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'select:not([disabled])',
  'input:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function option(select, value, label) {
  const element = document.createElement('option');
  element.value = String(value);
  element.textContent = label;
  select.append(element);
}

function focusableElements(section) {
  return Array.from(section.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function configureDialog(section, heading, id) {
  heading.id = id;
  section.tabIndex = -1;
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');
  section.setAttribute('aria-labelledby', id);
}

export function applyReadingVisualSettings(readerContainer, settings) {
  const effective = settings?.effective || settings || {};
  readerContainer.style.setProperty('--reading-text-scale', String(effective['visual.textSize'] ?? 1));
  readerContainer.style.setProperty('--reading-line-spacing', String(effective['visual.lineSpacing'] ?? 1.5));
  readerContainer.style.setProperty('--reading-paragraph-spacing', `${effective['visual.paragraphSpacing'] ?? 1}em`);
  readerContainer.style.setProperty('--reading-width', `${effective['visual.readingWidth'] ?? 72}ch`);
  readerContainer.style.setProperty('--reading-font-family', String(effective['visual.fontFamily'] ?? 'system'));
  readerContainer.style.setProperty('--reading-font-weight', String(effective['visual.fontWeight'] ?? 'normal'));
  readerContainer.dataset.readingTheme = String(effective['visual.theme'] ?? 'system');
  readerContainer.dataset.highContrast = effective['visual.highContrast'] ? 'true' : 'false';
}

export function createReadingSettingsPanel({ root, readerContainer, client, bookId, speech, t, returnFocus }) {
  const voiceSection = document.createElement('section');
  voiceSection.className = 'reading-panel reading-voice-panel';
  voiceSection.hidden = true;
  const voiceHeading = document.createElement('h2');
  voiceHeading.textContent = t('readingBook.voiceAndSpeed');
  configureDialog(voiceSection, voiceHeading, 'reading-voice-heading');

  const voiceLabel = document.createElement('label');
  voiceLabel.textContent = t('readingBook.voice');
  const voiceSelect = document.createElement('select');
  voiceSelect.id = 'reading-voice';
  voiceLabel.htmlFor = voiceSelect.id;

  const rateLabel = document.createElement('label');
  rateLabel.textContent = t('readingBook.speed');
  const rate = document.createElement('input');
  rate.id = 'reading-rate';
  rate.type = 'range';
  rate.min = '0.5';
  rate.max = '2';
  rate.step = '0.1';
  rateLabel.htmlFor = rate.id;
  const rateValue = document.createElement('output');
  rateValue.htmlFor = rate.id;

  const voiceStatus = document.createElement('p');
  voiceStatus.setAttribute('role', 'status');
  voiceStatus.setAttribute('aria-live', 'polite');

  const voiceReturn = document.createElement('button');
  voiceReturn.type = 'button';
  voiceReturn.textContent = t('readingBook.returnToReading');

  voiceSection.append(voiceHeading, voiceLabel, voiceSelect, rateLabel, rate, rateValue, voiceStatus, voiceReturn);

  const visualSection = document.createElement('section');
  visualSection.className = 'reading-panel reading-visual-panel';
  visualSection.hidden = true;
  const visualHeading = document.createElement('h2');
  visualHeading.textContent = t('readingBook.visualSettings');
  configureDialog(visualSection, visualHeading, 'reading-visual-heading');

  const textSize = document.createElement('select');
  option(textSize, 0.9, t('readingBook.textSmall'));
  option(textSize, 1, t('readingBook.textNormal'));
  option(textSize, 1.25, t('readingBook.textLarge'));
  option(textSize, 1.5, t('readingBook.textExtraLarge'));
  option(textSize, 2, t('readingBook.textMaximum'));

  const fontFamily = document.createElement('select');
  option(fontFamily, 'system', t('readingBook.fontSystem'));
  option(fontFamily, 'serif', t('readingBook.fontSerif'));
  option(fontFamily, 'sans-serif', t('readingBook.fontSans'));
  option(fontFamily, 'monospace', t('readingBook.fontMono'));

  const fontWeight = document.createElement('select');
  option(fontWeight, 'normal', t('readingBook.weightNormal'));
  option(fontWeight, 'medium', t('readingBook.weightMedium'));
  option(fontWeight, 'bold', t('readingBook.weightBold'));

  const lineSpacing = document.createElement('select');
  option(lineSpacing, 1, '1'); option(lineSpacing, 1.5, '1.5'); option(lineSpacing, 2, '2'); option(lineSpacing, 2.5, '2.5');
  const paragraphSpacing = document.createElement('select');
  option(paragraphSpacing, 0, '0'); option(paragraphSpacing, 1, '1'); option(paragraphSpacing, 2, '2'); option(paragraphSpacing, 3, '3');
  const readingWidth = document.createElement('select');
  option(readingWidth, 45, t('readingBook.widthNarrow'));
  option(readingWidth, 72, t('readingBook.widthNormal'));
  option(readingWidth, 100, t('readingBook.widthWide'));
  const theme = document.createElement('select');
  option(theme, 'system', t('readingBook.themeSystem'));
  option(theme, 'light', t('readingBook.themeLight'));
  option(theme, 'dark', t('readingBook.themeDark'));

  const highContrast = document.createElement('input');
  highContrast.type = 'checkbox';

  const fields = [
    ['visual.textSize', t('readingBook.textSize'), textSize],
    ['visual.fontFamily', t('readingBook.fontFamily'), fontFamily],
    ['visual.fontWeight', t('readingBook.fontWeight'), fontWeight],
    ['visual.lineSpacing', t('readingBook.lineSpacing'), lineSpacing],
    ['visual.paragraphSpacing', t('readingBook.paragraphSpacing'), paragraphSpacing],
    ['visual.readingWidth', t('readingBook.readingWidth'), readingWidth],
    ['visual.theme', t('readingBook.theme'), theme]
  ];
  for (const [key, labelText, control] of fields) {
    const label = document.createElement('label');
    label.textContent = labelText;
    control.dataset.settingKey = key;
    label.append(control);
    visualSection.append(label);
  }
  const contrastLabel = document.createElement('label');
  contrastLabel.textContent = t('readingBook.highContrast');
  highContrast.dataset.settingKey = 'visual.highContrast';
  contrastLabel.prepend(highContrast);
  visualSection.append(contrastLabel);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = t('readingBook.resetBookSettings');
  visualSection.append(reset);

  const visualStatus = document.createElement('p');
  visualStatus.setAttribute('role', 'status');
  visualStatus.setAttribute('aria-live', 'polite');
  visualSection.append(visualStatus);

  const visualReturn = document.createElement('button');
  visualReturn.type = 'button';
  visualReturn.textContent = t('readingBook.returnToReading');
  visualSection.append(visualReturn);

  root.append(voiceSection, visualSection);

  let voices = [];
  let current = null;
  let destroyed = false;
  let lastInvoker = null;

  function rememberInvoker() {
    const active = document.activeElement;
    lastInvoker = active && typeof active.focus === 'function' ? active : null;
  }

  function trapDialogFocus(section, event) {
    if (section.hidden) return;
    if (event.key === 'Tab') {
      const controls = focusableElements(section);
      if (!controls.length) {
        event.preventDefault();
        section.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  async function saveBookSetting(key, value, targetStatus) {
    const ok = await client.setReadingSetting({ scope: 'book', bookId, key, value: String(value) });
    if (!ok || destroyed) return false;
    await loadSettings();
    targetStatus.textContent = t('readingBook.settingsSaved');
    return true;
  }

  function populateVoiceOptions() {
    voiceSelect.replaceChildren();
    option(voiceSelect, '', t('readingBook.voiceDefault'));
    for (const voice of voices) option(voiceSelect, voice.id, `${voice.name} — ${voice.locale}`);
  }

  function setControlValues() {
    if (!current) return;
    const effective = current.effective;
    voiceSelect.value = effective['speech.voice'] || '';
    rate.value = String(effective['speech.rate']);
    rateValue.value = String(effective['speech.rate']);
    rateValue.textContent = String(effective['speech.rate']);
    for (const [key,, control] of fields) control.value = String(effective[key]);
    highContrast.checked = Boolean(effective['visual.highContrast']);
    speech.setVoice(effective['speech.voice']);
    speech.setRate(effective['speech.rate']);
    applyReadingVisualSettings(readerContainer, current);
  }

  async function loadSettings() {
    const [stored, available] = await Promise.all([
      client.getReadingSettings(bookId),
      client.listTtsVoices()
    ]);
    if (destroyed) return null;
    voices = available;
    current = resolveReadingSettings(stored.global, stored.book, { availableVoices: voices });
    populateVoiceOptions();
    setControlValues();
    return current;
  }

  voiceSelect.addEventListener('change', () => { void saveBookSetting('speech.voice', voiceSelect.value, voiceStatus); });
  rate.addEventListener('change', () => { void saveBookSetting('speech.rate', rate.value, voiceStatus); });
  rate.addEventListener('input', () => { rateValue.textContent = rate.value; });

  for (const [key,, control] of fields) {
    control.addEventListener('change', () => { void saveBookSetting(key, control.value, visualStatus); });
  }
  highContrast.addEventListener('change', () => { void saveBookSetting('visual.highContrast', highContrast.checked, visualStatus); });

  reset.addEventListener('click', () => {
    void (async () => {
      const ok = await client.resetBookReadingSettings(bookId);
      if (ok) {
        await loadSettings();
        visualStatus.textContent = t('readingBook.settingsReset');
      }
    })();
  });

  function returnToReading() {
    closeAll();
    if (lastInvoker && lastInvoker.isConnected !== false) {
      lastInvoker?.focus();
      lastInvoker = null;
      return;
    }
    lastInvoker = null;
    returnFocus?.();
  }

  voiceReturn.addEventListener('click', returnToReading);
  visualReturn.addEventListener('click', returnToReading);
  voiceSection.addEventListener('keydown', event => trapDialogFocus(voiceSection, event));
  visualSection.addEventListener('keydown', event => trapDialogFocus(visualSection, event));

  function openVoice() {
    rememberInvoker();
    visualSection.hidden = true;
    voiceSection.hidden = false;
    void loadSettings();
    queueMicrotask(() => voiceSelect.focus());
  }
  function openVisual() {
    rememberInvoker();
    voiceSection.hidden = true;
    visualSection.hidden = false;
    void loadSettings();
    queueMicrotask(() => textSize.focus());
  }
  function closeAll() { voiceSection.hidden = true; visualSection.hidden = true; }
  function destroy() { destroyed = true; voiceSection.remove(); visualSection.remove(); }

  void loadSettings();
  return { openVoice, openVisual, closeAll, destroy, loadSettings, visualKeys: VISUAL_KEYS };
}
