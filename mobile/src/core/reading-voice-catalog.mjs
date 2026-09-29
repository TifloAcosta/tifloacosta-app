import { Browser } from '@capacitor/browser';

export const READING_VOICE_PROVIDER_TYPES = Object.freeze({
  ANDROID_SYSTEM: 'android-system',
  TIFLOLECTOR_SERVICE: 'tiflolector-service'
});

export const READING_VOICE_PROVIDERS = Object.freeze([
  {
    id: 'acapela',
    name: 'Acapela TTS Voices',
    type: READING_VOICE_PROVIDER_TYPES.ANDROID_SYSTEM,
    url: 'https://play.google.com/store/apps/details?id=com.acapelagroup.android.tts',
    packageName: 'com.acapelagroup.android.tts'
  },
  {
    id: 'vocalizer',
    name: 'Vocalizer TTS',
    type: READING_VOICE_PROVIDER_TYPES.ANDROID_SYSTEM,
    url: 'https://play.google.com/store/apps/details?id=es.codefactory.vocalizertts',
    packageName: 'es.codefactory.vocalizertts'
  },
  {
    id: 'eloquence',
    name: 'Eloquence TTS',
    type: READING_VOICE_PROVIDER_TYPES.ANDROID_SYSTEM,
    url: 'https://play.google.com/store/apps/details?id=com.codefactoryglobal.eloquencetts',
    packageName: 'com.codefactoryglobal.eloquencetts'
  }
]);

const COPY = Object.freeze({
  es: {
    heading: 'Conseguir más voces',
    intro: 'Estos proveedores ofrecen voces o motores TTS compatibles con Android. Si instalas o compras una voz compatible, TifloLector podrá mostrarla junto con las demás voces disponibles en el sistema.',
    systemHeading: 'Voces compatibles con Android',
    systemDescription: 'Estas voces pueden utilizarse en TifloLector y también en otras aplicaciones que respeten el sistema TTS de Android.',
    visit: name => `Visitar ${name}`,
    nativeInstaller: 'Abrir también la gestión de voces de Android',
    futureHeading: 'Servicios de voz para TifloLector',
    futureDescription: 'La estructura queda preparada para añadir en el futuro servicios de voz que funcionen solo dentro de TifloLector, aunque Android no pueda utilizarlos como voces generales del sistema.',
    leaveNotice: name => `Vas a abandonar TifloAcosta para visitar ${name}. La prueba, compra, instalación, cuenta y cualquier pago se gestionan directamente con el proveedor. Cuando termines, vuelve a TifloLector para actualizar las voces disponibles.`,
    confirmExternalProvider: name => `Vas a abandonar TifloAcosta y abrir ${name} en la web. ¿Quieres continuar?`,
    close: 'Volver a las voces',
    unavailable: 'No se pudo abrir el destino externo.'
  },
  en: {
    heading: 'Get more voices',
    intro: 'These providers offer voices or TTS engines compatible with Android. If you install or buy a compatible voice, TifloLector can show it alongside the other voices available on the system.',
    systemHeading: 'Voices compatible with Android',
    systemDescription: 'These voices can be used in TifloLector and in other apps that respect Android system TTS.',
    visit: name => `Visit ${name}`,
    nativeInstaller: 'Also open Android voice management',
    futureHeading: 'Voice services for TifloLector',
    futureDescription: 'The structure is ready for future voice services that work only inside TifloLector, even when Android cannot use them as general system voices.',
    leaveNotice: name => `You are leaving TifloAcosta to visit ${name}. Trials, purchases, installation, accounts and any payments are handled directly by the provider. When you finish, return to TifloLector to refresh the available voices.`,
    confirmExternalProvider: name => `You are leaving TifloAcosta and opening ${name} on the web. Do you want to continue?`,
    close: 'Back to voices',
    unavailable: 'The external destination could not be opened.'
  }
});

export function readingVoiceCatalogCopy(language = 'es') {
  return COPY[String(language).toLowerCase().startsWith('en') ? 'en' : 'es'];
}

export function confirmExternalProvider(provider, language = 'es', confirmFn = globalThis.confirm) {
  if (!provider || typeof confirmFn !== 'function') return false;
  return confirmFn(readingVoiceCatalogCopy(language).confirmExternalProvider(provider.name));
}

export function createReadingVoiceCatalog({ root, client, returnFocus, openExternal = url => Browser.open({ url }) }) {
  const language = document.documentElement.lang || 'es';
  const copy = readingVoiceCatalogCopy(language);
  const section = document.createElement('section');
  section.className = 'reading-panel reading-voice-catalog';
  section.hidden = true;
  section.tabIndex = -1;
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');
  section.setAttribute('aria-labelledby', 'reading-voice-catalog-heading');

  const heading = document.createElement('h2');
  heading.id = 'reading-voice-catalog-heading';
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

  for (const provider of READING_VOICE_PROVIDERS.filter(item => item.type === READING_VOICE_PROVIDER_TYPES.ANDROID_SYSTEM)) {
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
      if (!confirmExternalProvider(provider, language)) return;
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
      queueMicrotask(() => heading.focus?.());
    },
    close() {
      section.hidden = true;
    },
    destroy() {
      section.remove();
    }
  };
}
