from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(path, old, new):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1. Warn accessibly before an external document link leaves TifloAcosta.
replace_once(
    'mobile/src/screens/reading-book.mjs',
    "  client,\n  bookId,\n  t,\n  setScreenCleanup,",
    "  client,\n  bookId,\n  t,\n  nativeActions,\n  setScreenCleanup,"
)

replace_once(
    'mobile/src/screens/reading-book.mjs',
    "  endOfDocument.append(endHeading, nextSuggestion, openNext, backToQueue);\n\n  root.append(\n",
    """  endOfDocument.append(endHeading, nextSuggestion, openNext, backToQueue);\n\n  const externalLinkDialog = document.createElement('section');\n  externalLinkDialog.className = 'reading-panel reading-external-link-dialog';\n  externalLinkDialog.hidden = true;\n  externalLinkDialog.tabIndex = -1;\n  externalLinkDialog.setAttribute('role', 'dialog');\n  externalLinkDialog.setAttribute('aria-modal', 'true');\n  const externalLinkHeading = document.createElement('h2');\n  externalLinkHeading.id = 'reading-external-link-heading';\n  externalLinkHeading.textContent = document.documentElement.lang === 'en'\n    ? 'Open external link'\n    : 'Abrir enlace externo';\n  externalLinkDialog.setAttribute('aria-labelledby', externalLinkHeading.id);\n  const externalLinkWarning = document.createElement('p');\n  externalLinkWarning.textContent = document.documentElement.lang === 'en'\n    ? 'This link opens content outside TifloAcosta.'\n    : 'Este enlace abre contenido fuera de TifloAcosta.';\n  const externalLinkOpen = document.createElement('button');\n  externalLinkOpen.type = 'button';\n  externalLinkOpen.textContent = document.documentElement.lang === 'en'\n    ? 'Open external link'\n    : 'Abrir enlace externo';\n  const externalLinkCancel = document.createElement('button');\n  externalLinkCancel.type = 'button';\n  externalLinkCancel.textContent = document.documentElement.lang === 'en' ? 'Cancel' : 'Cancelar';\n  externalLinkDialog.append(externalLinkHeading, externalLinkWarning, externalLinkOpen, externalLinkCancel);\n\n  root.append(\n"""
)

replace_once(
    'mobile/src/screens/reading-book.mjs',
    "    readerContainer,\n    panels,\n    endOfDocument\n  );",
    "    readerContainer,\n    panels,\n    externalLinkDialog,\n    endOfDocument\n  );"
)

replace_once(
    'mobile/src/screens/reading-book.mjs',
    "  let nextSuggestedBookId = '';\n  let completionGeneration = 0;\n\n  function focusCurrentSemanticUnit() {",
    """  let nextSuggestedBookId = '';\n  let completionGeneration = 0;\n  let pendingExternalUrl = '';\n  let externalLinkInvoker = null;\n\n  function closeExternalLinkWarning() {\n    externalLinkDialog.hidden = true;\n    pendingExternalUrl = '';\n    const invoker = externalLinkInvoker;\n    externalLinkInvoker = null;\n    if (invoker && invoker.isConnected !== false) queueMicrotask(() => invoker.focus());\n  }\n\n  function openExternalLinkWarning(url, invoker) {\n    const target = String(url ?? '').trim();\n    if (!target) return false;\n    pendingExternalUrl = target;\n    externalLinkInvoker = invoker && typeof invoker.focus === 'function' ? invoker : null;\n    externalLinkDialog.hidden = false;\n    queueMicrotask(() => externalLinkOpen.focus());\n    return true;\n  }\n\n  externalLinkOpen.addEventListener('click', () => {\n    const target = pendingExternalUrl;\n    closeExternalLinkWarning();\n    if (target) void nativeActions?.openExternal?.(target);\n  });\n  externalLinkCancel.addEventListener('click', closeExternalLinkWarning);\n  externalLinkDialog.addEventListener('keydown', event => {\n    if (event.key === 'Escape') {\n      event.preventDefault();\n      closeExternalLinkWarning();\n      return;\n    }\n    if (event.key !== 'Tab') return;\n    const first = externalLinkOpen;\n    const last = externalLinkCancel;\n    if (event.shiftKey && document.activeElement === first) {\n      event.preventDefault();\n      last.focus();\n    } else if (!event.shiftKey && document.activeElement === last) {\n      event.preventDefault();\n      first.focus();\n    }\n  });\n\n  function focusCurrentSemanticUnit() {"""
)

replace_once(
    'mobile/src/screens/reading-book.mjs',
    """        if (link.external === true) {\n          const anchor = document.createElement('a');\n          anchor.href = String(link.href ?? '');\n          anchor.target = '_blank';\n          anchor.rel = 'noopener noreferrer';\n          anchor.textContent = label;\n          nav.append(anchor);\n          continue;\n        }\n""",
    """        if (link.external === true) {\n          const externalButton = document.createElement('button');\n          externalButton.type = 'button';\n          externalButton.textContent = label;\n          externalButton.addEventListener('click', event => {\n            openExternalLinkWarning(link.href, event.currentTarget);\n          });\n          nav.append(externalButton);\n          continue;\n        }\n"""
)

# 2. Complete per-book visual settings with foreground/background colours.
replace_once(
    'mobile/src/screens/reading-settings.mjs',
    "  'visual.readingWidth',\n  'visual.highContrast',",
    "  'visual.readingWidth',\n  'visual.foreground',\n  'visual.background',\n  'visual.highContrast',"
)

replace_once(
    'mobile/src/screens/reading-settings.mjs',
    "  readerContainer.style.setProperty('--reading-font-weight', String(effective['visual.fontWeight'] ?? 'normal'));\n  readerContainer.dataset.readingTheme",
    """  readerContainer.style.setProperty('--reading-font-weight', String(effective['visual.fontWeight'] ?? 'normal'));\n  const foreground = String(effective['visual.foreground'] ?? '').trim();\n  const background = String(effective['visual.background'] ?? '').trim();\n  readerContainer.style.setProperty('--reading-foreground', foreground || 'CanvasText');\n  readerContainer.style.setProperty('--reading-background', background || 'Canvas');\n  readerContainer.dataset.readingTheme"""
)

replace_once(
    'mobile/src/screens/reading-settings.mjs',
    """  const readingWidth = document.createElement('select');\n  option(readingWidth, 45, t('readingBook.widthNarrow'));\n  option(readingWidth, 72, t('readingBook.widthNormal'));\n  option(readingWidth, 100, t('readingBook.widthWide'));\n  const theme = document.createElement('select');\n""",
    """  const readingWidth = document.createElement('select');\n  option(readingWidth, 45, t('readingBook.widthNarrow'));\n  option(readingWidth, 72, t('readingBook.widthNormal'));\n  option(readingWidth, 100, t('readingBook.widthWide'));\n  const foreground = document.createElement('select');\n  option(foreground, '', document.documentElement.lang === 'en' ? 'System text colour' : 'Color de texto del sistema');\n  option(foreground, '#000000', document.documentElement.lang === 'en' ? 'Black' : 'Negro');\n  option(foreground, '#ffffff', document.documentElement.lang === 'en' ? 'White' : 'Blanco');\n  option(foreground, '#1f2937', document.documentElement.lang === 'en' ? 'Dark grey' : 'Gris oscuro');\n  option(foreground, '#ffff00', document.documentElement.lang === 'en' ? 'Yellow' : 'Amarillo');\n  const background = document.createElement('select');\n  option(background, '', document.documentElement.lang === 'en' ? 'System background' : 'Fondo del sistema');\n  option(background, '#ffffff', document.documentElement.lang === 'en' ? 'White' : 'Blanco');\n  option(background, '#000000', document.documentElement.lang === 'en' ? 'Black' : 'Negro');\n  option(background, '#fff7cc', document.documentElement.lang === 'en' ? 'Cream' : 'Crema');\n  option(background, '#111827', document.documentElement.lang === 'en' ? 'Dark' : 'Oscuro');\n  const theme = document.createElement('select');\n"""
)

replace_once(
    'mobile/src/screens/reading-settings.mjs',
    """    ['visual.paragraphSpacing', t('readingBook.paragraphSpacing'), paragraphSpacing],\n    ['visual.readingWidth', t('readingBook.readingWidth'), readingWidth],\n    ['visual.theme', t('readingBook.theme'), theme]\n""",
    """    ['visual.paragraphSpacing', t('readingBook.paragraphSpacing'), paragraphSpacing],\n    ['visual.readingWidth', t('readingBook.readingWidth'), readingWidth],\n    ['visual.foreground', document.documentElement.lang === 'en' ? 'Text colour' : 'Color del texto', foreground],\n    ['visual.background', document.documentElement.lang === 'en' ? 'Background colour' : 'Color del fondo', background],\n    ['visual.theme', t('readingBook.theme'), theme]\n"""
)

# 3. Make the global reader panel complete and immediately persistent.
replace_once(
    'mobile/src/screens/reading-library.mjs',
    "import { TifloReading } from '../native/reading-library-plugin.mjs';\n",
    "import { READING_SETTING_DEFAULTS, resolveReadingSettings } from '../core/reading-settings.mjs';\nimport { TifloReading } from '../native/reading-library-plugin.mjs';\n"
)

old_global = """  // Global reading settings follow filters.\n  const settingsSection = document.createElement('section');\n  const settingsHeading = document.createElement('h2');\n  settingsHeading.textContent = t('readingLibrary.settings') === 'readingLibrary.settings'\n    ? fallback(t, 'readingLibrary.settings', 'Ajustes de lectura', 'Reading settings')\n    : t('readingLibrary.settings');\n  const settingsToggle = makeButton(\n    fallback(t, 'readingLibrary.openSettings', 'Configurar voz y velocidad', 'Configure voice and speed'),\n    () => {\n      settingsPanel.hidden = !settingsPanel.hidden;\n      settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));\n      if (!settingsPanel.hidden) void loadGlobalSettings();\n    }\n  );\n  settingsToggle.setAttribute('aria-expanded', 'false');\n  const settingsPanel = document.createElement('div');\n  settingsPanel.hidden = true;\n\n  const voiceLabel = document.createElement('label');\n  voiceLabel.htmlFor = 'reading-library-global-voice';\n  voiceLabel.textContent = t('readingBook.voice');\n  const voiceSelect = document.createElement('select');\n  voiceSelect.id = 'reading-library-global-voice';\n\n  const rateLabel = document.createElement('label');\n  rateLabel.htmlFor = 'reading-library-global-rate';\n  rateLabel.textContent = t('readingBook.speed');\n  const rateSelect = document.createElement('select');\n  rateSelect.id = 'reading-library-global-rate';\n  for (const value of ['0.75', '1', '1.25', '1.5', '1.75', '2']) rateSelect.append(makeOption(value, `${value}×`));\n\n  const saveSettings = makeButton(fallback(t, 'readingLibrary.saveSettings', 'Guardar ajustes', 'Save settings'), async () => {\n    saveSettings.disabled = true;\n    const [voiceSaved, rateSaved] = await Promise.all([\n      client.setReadingSetting({ scope: 'global', key: 'speech.voice', value: voiceSelect.value }),\n      client.setReadingSetting({ scope: 'global', key: 'speech.rate', value: rateSelect.value })\n    ]);\n    saveSettings.disabled = false;\n    liveStatus.textContent = voiceSaved && rateSaved\n      ? t('readingBook.settingsSaved')\n      : fallback(t, 'readingLibrary.settingsFailed', 'No se pudieron guardar los ajustes.', 'The settings could not be saved.');\n  });\n\n  settingsPanel.append(voiceLabel, voiceSelect, rateLabel, rateSelect, saveSettings);\n  settingsSection.append(settingsHeading, settingsToggle, settingsPanel);\n  root.append(settingsSection);\n\n  async function loadGlobalSettings() {\n    const [settings, voices] = await Promise.all([\n      client.getReadingSettings(''),\n      client.listTtsVoices()\n    ]);\n    voiceSelect.replaceChildren();\n    voiceSelect.append(makeOption('', t('readingBook.voiceDefault')));\n    for (const voice of voices) {\n      const label = voice.name || voice.locale || voice.id;\n      voiceSelect.append(makeOption(voice.id, label));\n    }\n    voiceSelect.value = String(settings?.global?.['speech.voice'] || '');\n    const rate = String(settings?.global?.['speech.rate'] || '1');\n    rateSelect.value = [...rateSelect.options].some(option => option.value === rate) ? rate : '1';\n  }\n"""

new_global = """  // Global reading settings follow filters and are persisted immediately.\n  const settingsSection = document.createElement('section');\n  const settingsHeading = document.createElement('h2');\n  settingsHeading.textContent = t('readingLibrary.settings') === 'readingLibrary.settings'\n    ? fallback(t, 'readingLibrary.settings', 'Ajustes de lectura', 'Reading settings')\n    : t('readingLibrary.settings');\n  const settingsToggle = makeButton(\n    fallback(t, 'readingLibrary.openSettings', 'Configurar ajustes de lectura', 'Configure reading settings'),\n    () => {\n      settingsPanel.hidden = !settingsPanel.hidden;\n      settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));\n      if (!settingsPanel.hidden) void loadGlobalSettings();\n    }\n  );\n  settingsToggle.setAttribute('aria-expanded', 'false');\n  const settingsPanel = document.createElement('div');\n  settingsPanel.hidden = true;\n\n  function settingSelect(id, labelText, values) {\n    const label = document.createElement('label');\n    label.htmlFor = id;\n    label.textContent = labelText;\n    const control = document.createElement('select');\n    control.id = id;\n    for (const [value, optionLabel] of values) control.append(makeOption(String(value), optionLabel));\n    return { label, control };\n  }\n\n  const voiceLabel = document.createElement('label');\n  voiceLabel.htmlFor = 'reading-library-global-voice';\n  voiceLabel.textContent = t('readingBook.voice');\n  const voiceSelect = document.createElement('select');\n  voiceSelect.id = 'reading-library-global-voice';\n\n  const { label: rateLabel, control: rateSelect } = settingSelect(\n    'reading-library-global-rate', t('readingBook.speed'),\n    [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => [value, `${value}×`])\n  );\n  const { label: audioSpeedLabel, control: audioSpeedSelect } = settingSelect(\n    'reading-library-global-audio-speed',\n    document.documentElement.lang === 'en' ? 'Audiobook speed' : 'Velocidad de audiolibros',\n    [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map(value => [value, `${value}×`])\n  );\n  const { label: skipLabel, control: skipSelect } = settingSelect(\n    'reading-library-global-audio-skip',\n    document.documentElement.lang === 'en' ? 'Audio skip interval' : 'Intervalo de salto de audio',\n    [10, 30, 60].map(value => [value, `${value} s`])\n  );\n  const { label: textSizeLabel, control: textSizeSelect } = settingSelect(\n    'reading-library-global-text-size',\n    t('readingBook.textSize'),\n    [[0.75, '75 %'], [0.9, '90 %'], [1, '100 %'], [1.25, '125 %'], [1.5, '150 %'], [2, '200 %']]\n  );\n  const { label: fontFamilyLabel, control: fontFamilySelect } = settingSelect(\n    'reading-library-global-font-family',\n    t('readingBook.fontFamily'),\n    [['system', t('readingBook.fontSystem')], ['serif', t('readingBook.fontSerif')], ['sans-serif', t('readingBook.fontSans')], ['monospace', t('readingBook.fontMono')]]\n  );\n  const { label: fontWeightLabel, control: fontWeightSelect } = settingSelect(\n    'reading-library-global-font-weight',\n    t('readingBook.fontWeight'),\n    [['normal', t('readingBook.weightNormal')], ['medium', t('readingBook.weightMedium')], ['bold', t('readingBook.weightBold')]]\n  );\n  const { label: lineSpacingLabel, control: lineSpacingSelect } = settingSelect(\n    'reading-library-global-line-spacing', t('readingBook.lineSpacing'),\n    [1, 1.5, 2, 2.5].map(value => [value, String(value)])\n  );\n  const { label: paragraphSpacingLabel, control: paragraphSpacingSelect } = settingSelect(\n    'reading-library-global-paragraph-spacing', t('readingBook.paragraphSpacing'),\n    [0, 1, 2, 3].map(value => [value, String(value)])\n  );\n  const { label: readingWidthLabel, control: readingWidthSelect } = settingSelect(\n    'reading-library-global-reading-width', t('readingBook.readingWidth'),\n    [[45, t('readingBook.widthNarrow')], [72, t('readingBook.widthNormal')], [100, t('readingBook.widthWide')]]\n  );\n  const { label: foregroundLabel, control: foregroundSelect } = settingSelect(\n    'reading-library-global-foreground',\n    document.documentElement.lang === 'en' ? 'Text colour' : 'Color del texto',\n    [['', document.documentElement.lang === 'en' ? 'System text colour' : 'Color de texto del sistema'], ['#000000', document.documentElement.lang === 'en' ? 'Black' : 'Negro'], ['#ffffff', document.documentElement.lang === 'en' ? 'White' : 'Blanco'], ['#1f2937', document.documentElement.lang === 'en' ? 'Dark grey' : 'Gris oscuro'], ['#ffff00', document.documentElement.lang === 'en' ? 'Yellow' : 'Amarillo']]\n  );\n  const { label: backgroundLabel, control: backgroundSelect } = settingSelect(\n    'reading-library-global-background',\n    document.documentElement.lang === 'en' ? 'Background colour' : 'Color del fondo',\n    [['', document.documentElement.lang === 'en' ? 'System background' : 'Fondo del sistema'], ['#ffffff', document.documentElement.lang === 'en' ? 'White' : 'Blanco'], ['#000000', document.documentElement.lang === 'en' ? 'Black' : 'Negro'], ['#fff7cc', document.documentElement.lang === 'en' ? 'Cream' : 'Crema'], ['#111827', document.documentElement.lang === 'en' ? 'Dark' : 'Oscuro']]\n  );\n  const { label: themeLabel, control: themeSelect } = settingSelect(\n    'reading-library-global-theme', t('readingBook.theme'),\n    [['system', t('readingBook.themeSystem')], ['light', t('readingBook.themeLight')], ['dark', t('readingBook.themeDark')]]\n  );\n  const highContrast = document.createElement('input');\n  highContrast.type = 'checkbox';\n  highContrast.id = 'reading-library-global-high-contrast';\n  const highContrastLabel = document.createElement('label');\n  highContrastLabel.htmlFor = highContrast.id;\n  highContrastLabel.textContent = t('readingBook.highContrast');\n\n  const settingsStatus = document.createElement('p');\n  settingsStatus.setAttribute('role', 'status');\n  settingsStatus.setAttribute('aria-live', 'polite');\n  settingsStatus.setAttribute('aria-atomic', 'true');\n  const resetSettings = makeButton(\n    document.documentElement.lang === 'en' ? 'Reset global reading settings' : 'Restablecer ajustes generales de lectura',\n    () => { void resetReadingDefaults(); }\n  );\n\n  settingsPanel.append(\n    voiceLabel, voiceSelect, rateLabel, rateSelect, audioSpeedLabel, audioSpeedSelect, skipLabel, skipSelect,\n    textSizeLabel, textSizeSelect, fontFamilyLabel, fontFamilySelect, fontWeightLabel, fontWeightSelect,\n    lineSpacingLabel, lineSpacingSelect, paragraphSpacingLabel, paragraphSpacingSelect, readingWidthLabel, readingWidthSelect,\n    foregroundLabel, foregroundSelect, backgroundLabel, backgroundSelect, themeLabel, themeSelect,\n    highContrast, highContrastLabel, resetSettings, settingsStatus\n  );\n  settingsSection.append(settingsHeading, settingsToggle, settingsPanel);\n  root.append(settingsSection);\n\n  const globalSettingControls = new Map([\n    ['speech.voice', voiceSelect],\n    ['speech.rate', rateSelect],\n    ['audio.speed', audioSpeedSelect],\n    ['audio.skipSeconds', skipSelect],\n    ['visual.textSize', textSizeSelect],\n    ['visual.fontFamily', fontFamilySelect],\n    ['visual.fontWeight', fontWeightSelect],\n    ['visual.lineSpacing', lineSpacingSelect],\n    ['visual.paragraphSpacing', paragraphSpacingSelect],\n    ['visual.readingWidth', readingWidthSelect],\n    ['visual.foreground', foregroundSelect],\n    ['visual.background', backgroundSelect],\n    ['visual.highContrast', highContrast],\n    ['visual.theme', themeSelect]\n  ]);\n\n  for (const [key, control] of globalSettingControls) {\n    control.addEventListener('change', () => { void persistGlobalSetting(key, control); });\n  }\n\n  async function persistGlobalSetting(key, control) {\n    const value = control.type === 'checkbox' ? control.checked : control.value;\n    const saved = await client.setReadingSetting({ scope: 'global', key, value: String(value) });\n    settingsStatus.textContent = saved\n      ? t('readingBook.settingsSaved')\n      : fallback(t, 'readingLibrary.settingsFailed', 'No se pudieron guardar los ajustes.', 'The settings could not be saved.');\n    return saved;\n  }\n\n  async function resetReadingDefaults() {\n    resetSettings.disabled = true;\n    const results = await Promise.all(Object.entries(READING_SETTING_DEFAULTS).map(([key, value]) =>\n      client.setReadingSetting({ scope: 'global', key, value: String(value) })\n    ));\n    resetSettings.disabled = false;\n    await loadGlobalSettings();\n    settingsStatus.textContent = results.every(Boolean)\n      ? (document.documentElement.lang === 'en' ? 'Global reading settings reset.' : 'Ajustes generales de lectura restablecidos.')\n      : fallback(t, 'readingLibrary.settingsFailed', 'No se pudieron guardar los ajustes.', 'The settings could not be saved.');\n  }\n\n  async function loadGlobalSettings() {\n    const [settings, voices] = await Promise.all([\n      client.getReadingSettings(''),\n      client.listTtsVoices()\n    ]);\n    voiceSelect.replaceChildren();\n    voiceSelect.append(makeOption('', t('readingBook.voiceDefault')));\n    for (const voice of voices) {\n      const label = voice.name || voice.locale || voice.id;\n      voiceSelect.append(makeOption(voice.id, label));\n    }\n    const effective = resolveReadingSettings(settings?.global || {}, {}, { availableVoices: voices }).effective;\n    for (const [key, control] of globalSettingControls) {\n      if (control.type === 'checkbox') control.checked = Boolean(effective[key]);\n      else control.value = String(effective[key] ?? '');\n    }\n  }\n"""
replace_once('mobile/src/screens/reading-library.mjs', old_global, new_global)

# 4. Let each audiobook override the 10/30/60 second skip interval at runtime.
replace_once(
    'mobile/src/screens/reading-audio.mjs',
    """  const speed = document.createElement('select');\n  speed.id = `reading-audio-speed-${book.id}`;\n  speedLabel.htmlFor = speed.id;\n  for (const value of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]) option(speed, value, `${value}×`);\n\n  const timerLabel = document.createElement('label');\n""",
    """  const speed = document.createElement('select');\n  speed.id = `reading-audio-speed-${book.id}`;\n  speedLabel.htmlFor = speed.id;\n  for (const value of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]) option(speed, value, `${value}×`);\n\n  const skipLabel = document.createElement('label');\n  skipLabel.textContent = document.documentElement.lang === 'en' ? 'Audio skip interval' : 'Intervalo de salto de audio';\n  const skipSelect = document.createElement('select');\n  skipSelect.id = `reading-audio-skip-${book.id}`;\n  skipLabel.htmlFor = skipSelect.id;\n  for (const value of [10, 30, 60]) option(skipSelect, value, `${value} s`);\n\n  const timerLabel = document.createElement('label');\n"""
)

replace_once(
    'mobile/src/screens/reading-audio.mjs',
    """    speedLabel,\n    speed,\n    timerLabel,\n""",
    """    speedLabel,\n    speed,\n    skipLabel,\n    skipSelect,\n    timerLabel,\n"""
)

replace_once(
    'mobile/src/screens/reading-audio.mjs',
    """  speed.addEventListener('change', () => {\n    void (async () => {\n      if (!controller) return;\n      const selected = Number(speed.value) || 1;\n      await saveBookSetting('audio.speed', selected);\n      const next = await controller.setSpeed(selected);\n      if (next) renderState(next);\n    })();\n  });\n\n  timer.addEventListener('change', () => {\n""",
    """  speed.addEventListener('change', () => {\n    void (async () => {\n      if (!controller) return;\n      const selected = Number(speed.value) || 1;\n      await saveBookSetting('audio.speed', selected);\n      const next = await controller.setSpeed(selected);\n      if (next) renderState(next);\n    })();\n  });\n\n  skipSelect.addEventListener('change', () => {\n    void (async () => {\n      const selected = Number(skipSelect.value) || 30;\n      const saved = await saveBookSetting('audio.skipSeconds', selected);\n      if (!saved) return;\n      effectiveSettings = { ...effectiveSettings, 'audio.skipSeconds': selected };\n      controller?.setSkipSeconds?.(selected);\n      applySkipLabels();\n    })();\n  });\n\n  timer.addEventListener('change', () => {\n"""
)

replace_once(
    'mobile/src/screens/reading-audio.mjs',
    """    applySkipLabels();\n    speed.value = String(effectiveSettings['audio.speed']);\n\n    controller = createReadingAudioController({\n""",
    """    applySkipLabels();\n    speed.value = String(effectiveSettings['audio.speed']);\n    skipSelect.value = String(effectiveSettings['audio.skipSeconds']);\n\n    controller = createReadingAudioController({\n"""
)

replace_once(
    'mobile/src/core/reading-audio.mjs',
    "  const skipSeconds = supportedSkipSeconds(settings?.['audio.skipSeconds']);",
    "  let skipSeconds = supportedSkipSeconds(settings?.['audio.skipSeconds']);"
)

replace_once(
    'mobile/src/core/reading-audio.mjs',
    """  async function setSpeed(speed) {\n    await listenersReady;\n    const normalized = clamp(speed, AUDIO_SPEED_MIN, AUDIO_SPEED_MAX, state.speed);\n    if (destroyed || !client?.setAudioSpeed) return snapshot();\n    const result = await client.setAudioSpeed({ speed: normalized });\n    if (result && belongsToCurrentBook(result)) updateFromNative(result);\n    state.speed = normalized;\n    return snapshot();\n  }\n""",
    """  async function setSpeed(speed) {\n    await listenersReady;\n    const normalized = clamp(speed, AUDIO_SPEED_MIN, AUDIO_SPEED_MAX, state.speed);\n    if (destroyed || !client?.setAudioSpeed) return snapshot();\n    const result = await client.setAudioSpeed({ speed: normalized });\n    if (result && belongsToCurrentBook(result)) updateFromNative(result);\n    state.speed = normalized;\n    return snapshot();\n  }\n\n  function setSkipSeconds(value) {\n    skipSeconds = supportedSkipSeconds(value);\n    return skipSeconds;\n  }\n"""
)

replace_once(
    'mobile/src/core/reading-audio.mjs',
    """    nextTrack,\n    setSpeed,\n    refreshState,\n""",
    """    nextTrack,\n    setSpeed,\n    setSkipSeconds,\n    refreshState,\n"""
)

replace_once(
    'mobile/test/reading-audio.test.mjs',
    """test('position persistence is throttled but pause always forces an exact save', async () => {\n""",
    """test('audio coordinator updates the configured skip interval without recreating playback', async () => {\n  const { controller, calls, listeners } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 10000 } });\n  await controller.prepare();\n  await listeners.get('audioState')({\n    bookId: 'audio-1', trackIndex: 0, positionMs: 10000, durationMs: 120000, playing: false, speed: 1.25\n  });\n\n  assert.equal(controller.setSkipSeconds(60), 60);\n  await controller.skip(1);\n  assert.deepEqual(calls.at(-1), { method: 'skipAudio', options: { deltaMs: 60000 } });\n\n  assert.equal(controller.setSkipSeconds(45), 30);\n  await controller.skip(-1);\n  assert.deepEqual(calls.at(-1), { method: 'skipAudio', options: { deltaMs: -30000 } });\n});\n\ntest('position persistence is throttled but pause always forces an exact save', async () => {\n"""
)

# 5. Apply visual foreground/background only to the reading surface; high contrast remains authoritative.
replace_once(
    'mobile/src/styles.css',
    """  --reading-font-family: system;\n  --reading-font-weight: normal;\n  width: min(100%, var(--reading-width));\n""",
    """  --reading-font-family: system;\n  --reading-font-weight: normal;\n  --reading-foreground: CanvasText;\n  --reading-background: Canvas;\n  width: min(100%, var(--reading-width));\n"""
)

replace_once(
    'mobile/src/styles.css',
    """  line-height: var(--reading-line-spacing);\n  font-weight: var(--reading-font-weight);\n}\n""",
    """  line-height: var(--reading-line-spacing);\n  font-weight: var(--reading-font-weight);\n  color: var(--reading-foreground);\n  background: var(--reading-background);\n}\n"""
)

print('Final reading beta review patch applied successfully.')
