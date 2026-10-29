import { addScreenHeader, clearScreen } from './shared.mjs';
import { registerPlugin } from '@capacitor/core';

export const NativeFeatures = registerPlugin('TifloNativeFeatures');

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

function addAppInfo(root, appInfo, t) {
  const section = document.createElement('section');
  section.className = 'settings-section';

  const heading = document.createElement('h2');
  heading.textContent = t('settings.appInfo');
  section.append(heading);

  const unavailable = t('settings.unavailable');
  const version = document.createElement('p');
  version.textContent = `${t('settings.version')}: ${appInfo?.version || unavailable}`;
  section.append(version);

  const build = document.createElement('p');
  build.textContent = `${t('settings.build')}: ${appInfo?.build || unavailable}`;
  section.append(build);

  root.append(section);
}

export function renderSettings({
  root,
  router,
  preferences,
  notificationService,
  appInfo = { version: '', build: '' },
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

  // Diagnostic controls on this integration branch; hidden in the existing Play release.
  // Do not promote these before confirming migration of pre-existing books and progress.
  const nativePreview = document.createElement('section');
  nativePreview.className = 'settings-section';
  const previewTitle = document.createElement('h2');
  previewTitle.textContent = preferences.lang === 'en'
    ? 'Native features: integration validation'
    : 'Funciones nativas: validación de integración';
  nativePreview.append(previewTitle);
  const previewNotice = document.createElement('p');
  previewNotice.textContent = preferences.lang === 'en'
    ? 'Preview only. Existing reader books remain in your original library until migration is verified.'
    : 'Solo pruebas. Los libros existentes permanecen en su biblioteca original hasta comprobar la migración.';
  nativePreview.append(previewNotice);
  const previewStatus = document.createElement('p');
  previewStatus.setAttribute('role', 'status');
  previewStatus.setAttribute('aria-live', 'polite');
  nativePreview.append(previewStatus);
  for (const [method, es, en] of [
    ['openNativeReader', 'Probar TifloLector nativo', 'Test native TifloLector'],
    ['openNativeVideos', 'Probar vídeos nativos', 'Test native videos']
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = preferences.lang === 'en' ? en : es;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await NativeFeatures[method]();
        previewStatus.textContent = '';
      } catch {
        previewStatus.textContent = preferences.lang === 'en'
          ? 'This native preview is not available in this build.'
          : 'Esta vista previa nativa no está disponible en esta compilación.';
      } finally {
        button.disabled = false;
      }
    });
    nativePreview.append(button);
  }
  // Read-only preflight for manual upgrade QA. This never initiates migration.
  const inspect = document.createElement('button');
  inspect.type = 'button';
  inspect.textContent = preferences.lang === 'en'
    ? 'Check existing reading library (no changes)'
    : 'Comprobar biblioteca existente (sin cambios)';
  inspect.addEventListener('click', async () => {
    inspect.disabled = true;
    previewStatus.textContent = preferences.lang === 'en'
      ? 'Checking books and their original files…'
      : 'Comprobando libros y archivos originales…';
    try {
      const report = await NativeFeatures.inspectLegacyLibrary();
      const count = key => Number.isSafeInteger(report?.[key]) ? report[key] : 0;
      if (!report?.legacyDatabaseExists) {
        previewStatus.textContent = preferences.lang === 'en'
          ? 'No previous database detected. Nothing was modified.'
          : 'No se encontró una base de datos anterior. No se ha modificado nada.';
      } else {
        const counts = preferences.lang === 'en'
          ? `Books: ${count('books')}; bookmarks: ${count('marks')}; queue: ${count('queue')}; settings: ${count('settings')}. Missing book files: ${count('missingBookSources')}; audio tracks: ${count('missingAudioTracks')}; derived files: ${count('missingDerivedFiles')}; unsafe paths: ${count('unsafeStoredPaths')}.`
          : `Libros: ${count('books')}; marcas: ${count('marks')}; cola: ${count('queue')}; ajustes: ${count('settings')}. Faltan originales: ${count('missingBookSources')}; pistas de audio: ${count('missingAudioTracks')}; archivos derivados: ${count('missingDerivedFiles')}; rutas inseguras: ${count('unsafeStoredPaths')}.`;
        const finish = preferences.lang === 'en'
          ? 'No data was modified. Native migration is not yet complete.'
          : 'No se ha modificado ningún dato. La migración nativa aún no está terminada.';
        previewStatus.textContent = counts + ' ' + finish;
      }
    } catch {
      previewStatus.textContent = preferences.lang === 'en'
        ? 'Library verification failed. Existing files were not intentionally changed.'
        : 'No se pudo comprobar la biblioteca. No se han realizado cambios intencionados en los archivos.';
    } finally {
      inspect.disabled = false;
    }
  });
  nativePreview.append(inspect);
  root.append(nativePreview);

  const notificationCleanup = addNotificationSettings(root, notificationService, t, onAppResume);
  addAppInfo(root, appInfo, t);
  setScreenCleanup?.(notificationCleanup);
}
