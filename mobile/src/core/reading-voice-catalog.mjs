import { Browser } from '@capacitor/browser';
import {
  READING_VOICE_PROVIDER_TYPES,
  readingVoiceCatalogCopy,
  normalizeVoiceProviders,
  confirmExternalProvider
} from '../../../shared/reading-voice-catalog.mjs';

export { READING_VOICE_PROVIDER_TYPES, readingVoiceCatalogCopy, confirmExternalProvider };

export const READING_VOICE_PROVIDERS = Object.freeze(normalizeVoiceProviders([
  {
    id: 'acapela',
    name: 'Acapela TTS Voices',
    type: READING_VOICE_PROVIDER_TYPES.SYSTEM,
    platform: 'android',
    url: 'https://play.google.com/store/apps/details?id=com.acapelagroup.android.tts',
    packageName: 'com.acapelagroup.android.tts',
    languages: ['ar','ca','zh','cs','da','nl','en','fi','fr','de','el','hi','it','ja','ko','no','pl','pt','ru','es','sv','tr']
  },
  {
    id: 'vocalizer',
    name: 'Vocalizer TTS',
    type: READING_VOICE_PROVIDER_TYPES.SYSTEM,
    platform: 'android',
    url: 'https://play.google.com/store/apps/details?id=es.codefactory.vocalizertts',
    packageName: 'es.codefactory.vocalizertts',
    languages: ['en','es','ar','bn','ca','hr','eu','gl','nl','kn','pt','bg','fr','zh','cs','da','fi','de','el','he','hi','hu','id','ms','it','ja','ko','mr','no','pl','ro','ru','sk','sv','th','ta','te','tr','uk','val']
  },
  {
    id: 'eloquence',
    name: 'Eloquence TTS',
    type: READING_VOICE_PROVIDER_TYPES.SYSTEM,
    platform: 'android',
    url: 'https://play.google.com/store/apps/details?id=com.codefactoryglobal.eloquencetts',
    packageName: 'com.codefactoryglobal.eloquencetts',
    languages: ['en','es','de','fi','fr','it','pt']
  }
], 'android'));

function primaryLanguage(value='') {
  return String(value || '').trim().toLowerCase().split(/[-_]/)[0];
}

function languageName(code, uiLanguage='es') {
  try {
    return new Intl.DisplayNames([uiLanguage], { type:'language' }).of(primaryLanguage(code)) || primaryLanguage(code);
  } catch {
    return primaryLanguage(code);
  }
}

export function createReadingVoiceCatalog({
  root,
  client,
  returnFocus,
  providers = READING_VOICE_PROVIDERS,
  platform = 'android',
  openExternal = url => Browser.open({ url })
}) {
  const language = document.documentElement.lang || 'es';
  const copy = readingVoiceCatalogCopy(language, platform);
  const section = document.createElement('section');
  section.className = 'reading-panel reading-voice-catalog';
  section.hidden = true;
  section.tabIndex = -1;
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');
  section.setAttribute('aria-labelledby', 'reading-voice-catalog-heading');

  const heading = document.createElement('h2');
  heading.id = 'reading-voice-catalog-heading';
  heading.tabIndex = -1;
  heading.textContent = copy.heading;

  const intro = document.createElement('p');
  intro.textContent = copy.intro;

  const systemHeading = document.createElement('h3');
  systemHeading.textContent = copy.systemHeading;
  const systemDescription = document.createElement('p');
  systemDescription.textContent = copy.systemDescription;

  const providerFilterLabel = document.createElement('label');
  providerFilterLabel.htmlFor = 'reading-provider-language-filter';
  providerFilterLabel.textContent = language.startsWith('en') ? 'Language' : 'Idioma';
  const providerFilter = document.createElement('select');
  providerFilter.id = 'reading-provider-language-filter';

  const normalizedProviders = normalizeVoiceProviders(providers, platform);
  const providerLanguages = [...new Set(normalizedProviders.flatMap(provider => provider.languages || []).map(primaryLanguage).filter(Boolean))]
    .sort((a,b) => languageName(a, language).localeCompare(languageName(b, language)));

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = language.startsWith('en') ? 'All languages' : 'Todos los idiomas';
  providerFilter.append(allOption);
  for (const code of providerLanguages) {
    const item = document.createElement('option');
    item.value = code;
    item.textContent = languageName(code, language);
    providerFilter.append(item);
  }

  const providerList = document.createElement('div');
  providerList.className = 'section-stack';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  function renderProviders() {
    providerList.replaceChildren();
    const selected = primaryLanguage(providerFilter.value);
    const visible = selected
      ? normalizedProviders.filter(provider => (provider.languages || []).map(primaryLanguage).includes(selected))
      : normalizedProviders;
    if (!visible.length) {
      status.textContent = language.startsWith('en')
        ? `No voice providers are listed for ${languageName(selected, language)}.`
        : `No hay proveedores de voces registrados para ${languageName(selected, language)}.`;
      return;
    }
    status.textContent = selected
      ? (language.startsWith('en')
        ? `Showing providers for ${languageName(selected, language)}.`
        : `Mostrando proveedores para ${languageName(selected, language)}.`)
      : '';
    for (const provider of visible) {
      const card = document.createElement('section');
      card.className = 'content-card';
      const providerHeading = document.createElement('h4');
      providerHeading.textContent = provider.name;
      const notice = document.createElement('p');
      notice.textContent = copy.leaveNotice(provider.name);
      const visit = document.createElement('button');
      visit.type = 'button';
      visit.textContent = copy.visit(provider.name);
      visit.addEventListener('click', () => {
        if (!provider.url || !confirmExternalProvider(provider, language)) return;
        status.textContent = copy.leaveNotice(provider.name);
        void Promise.resolve(openExternal(provider.url)).catch(() => {
          status.textContent = copy.unavailable;
        });
      });
      card.append(providerHeading, notice, visit);
      providerList.append(card);
    }
  }

  providerFilter.addEventListener('change', renderProviders);
  renderProviders();

  const nativeInstaller = document.createElement('button');
  nativeInstaller.type = 'button';
  nativeInstaller.textContent = copy.nativeInstaller;
  nativeInstaller.hidden = !copy.nativeInstaller || typeof client?.openTtsVoiceInstaller !== 'function';
  nativeInstaller.addEventListener('click', () => {
    void (async () => {
      const result = await client.openTtsVoiceInstaller();
      if (!result?.opened) status.textContent = copy.unavailable;
    })();
  });

  const futureHeading = document.createElement('h3');
  futureHeading.textContent = copy.futureHeading;
  const futureDescription = document.createElement('p');
  futureDescription.textContent = copy.futureDescription;

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = copy.close;
  close.addEventListener('click', () => {
    section.hidden = true;
    returnFocus?.();
  });

  section.append(
    heading,
    intro,
    systemHeading,
    systemDescription,
    providerFilterLabel,
    providerFilter,
    providerList,
    nativeInstaller,
    futureHeading,
    futureDescription,
    status,
    close
  );
  root.append(section);

  return {
    setLanguageFilter(value='') {
      const normalized = primaryLanguage(value);
      providerFilter.value = [...providerFilter.options].some(option => option.value === normalized) ? normalized : '';
      renderProviders();
    },
    open() {
      section.hidden = false;
      queueMicrotask(() => heading.focus());
    },
    close() {
      section.hidden = true;
    },
    destroy() {
      section.remove();
    }
  };
}
