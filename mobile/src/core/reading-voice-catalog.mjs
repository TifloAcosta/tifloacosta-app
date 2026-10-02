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
    packageName: 'com.acapelagroup.android.tts'
  },
  {
    id: 'vocalizer',
    name: 'Vocalizer TTS',
    type: READING_VOICE_PROVIDER_TYPES.SYSTEM,
    platform: 'android',
    url: 'https://play.google.com/store/apps/details?id=es.codefactory.vocalizertts',
    packageName: 'es.codefactory.vocalizertts'
  },
  {
    id: 'eloquence',
    name: 'Eloquence TTS',
    type: READING_VOICE_PROVIDER_TYPES.SYSTEM,
    platform: 'android',
    url: 'https://play.google.com/store/apps/details?id=com.codefactoryglobal.eloquencetts',
    packageName: 'com.codefactoryglobal.eloquencetts'
  }
], 'android'));

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

  const providerList = document.createElement('div');
  providerList.className = 'section-stack';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  for (const provider of normalizeVoiceProviders(providers, platform)) {
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
    providerList,
    nativeInstaller,
    futureHeading,
    futureDescription,
    status,
    close
  );
  root.append(section);

  return {
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
