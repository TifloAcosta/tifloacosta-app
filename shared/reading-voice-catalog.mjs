export const READING_VOICE_PROVIDER_TYPES = Object.freeze({
  SYSTEM: 'system',
  EXTERNAL: 'external',
  TIFLOLECTOR_SERVICE: 'tiflolector-service'
});

const PLATFORM_COPY = Object.freeze({
  es: {
    generic: {
      heading: 'Conseguir más voces',
      intro: 'Aquí puedes consultar proveedores de voces compatibles con esta plataforma y, cuando esté disponible, servicios de voz propios de TifloLector.',
      systemHeading: 'Voces compatibles con el sistema',
      systemDescription: 'Las voces disponibles dependen de las opciones que ofrezca el sistema y de los proveedores instalados.',
      nativeInstaller: 'Abrir la gestión de voces del sistema',
      futureHeading: 'Servicios de voz para TifloLector',
      futureDescription: 'La estructura está preparada para incorporar servicios de voz que funcionen dentro de TifloLector aunque no sean voces generales del sistema.'
    },
    android: {
      intro: 'Estos proveedores ofrecen voces o motores TTS compatibles con Android. Si instalas o compras una voz compatible, TifloLector podrá mostrarla junto con las demás voces disponibles en el sistema.',
      systemHeading: 'Voces compatibles con Android',
      systemDescription: 'Estas voces pueden utilizarse en TifloLector y también en otras aplicaciones que respeten el sistema TTS de Android.',
      nativeInstaller: 'Abrir también la gestión de voces de Android'
    },
    web: {
      intro: 'La versión web utiliza las voces que el navegador y el sistema ponen a disposición de la Web Speech API.',
      systemHeading: 'Voces disponibles en el navegador',
      systemDescription: 'La lista depende del navegador, del sistema operativo y de las voces instaladas. No todas las voces del dispositivo tienen que estar disponibles en la web.',
      nativeInstaller: ''
    },
    ios: {
      intro: 'TifloLector para iOS utilizará las voces disponibles en el sistema y los servicios de voz que se incorporen de forma compatible con iPhone y iPad.',
      systemHeading: 'Voces compatibles con iOS',
      systemDescription: 'La disponibilidad dependerá de las voces instaladas y de las capacidades que ofrezca iOS.',
      nativeInstaller: 'Abrir la gestión de voces de iOS'
    },
    visit: name => `Visitar ${name}`,
    leaveNotice: name => `Vas a abandonar TifloAcosta para visitar ${name}. La prueba, compra, instalación, cuenta y cualquier pago se gestionan directamente con el proveedor. Cuando termines, vuelve a TifloLector para actualizar las voces disponibles.`,
    confirmExternalProvider: name => `Vas a abandonar TifloAcosta y abrir ${name} en la web. ¿Quieres continuar?`,
    close: 'Volver a las voces',
    unavailable: 'No se pudo abrir el destino externo.'
  },
  en: {
    generic: {
      heading: 'Get more voices',
      intro: 'Here you can find voice providers compatible with this platform and, when available, voice services made specifically for TifloReader.',
      systemHeading: 'System-compatible voices',
      systemDescription: 'Available voices depend on the operating system and installed providers.',
      nativeInstaller: 'Open system voice management',
      futureHeading: 'Voice services for TifloReader',
      futureDescription: 'The structure is ready for voice services that work inside TifloReader even when they are not general system voices.'
    },
    android: {
      intro: 'These providers offer voices or TTS engines compatible with Android. If you install or buy a compatible voice, TifloReader can show it alongside the other voices available on the system.',
      systemHeading: 'Voices compatible with Android',
      systemDescription: 'These voices can be used in TifloReader and in other apps that respect Android system TTS.',
      nativeInstaller: 'Also open Android voice management'
    },
    web: {
      intro: 'The web version uses voices exposed by the browser and operating system through the Web Speech API.',
      systemHeading: 'Voices available in the browser',
      systemDescription: 'The list depends on the browser, operating system and installed voices. Not every device voice has to be exposed to the web.',
      nativeInstaller: ''
    },
    ios: {
      intro: 'TifloReader for iOS will use voices available to the system and voice services added in a way that is compatible with iPhone and iPad.',
      systemHeading: 'Voices compatible with iOS',
      systemDescription: 'Availability will depend on installed voices and the capabilities exposed by iOS.',
      nativeInstaller: 'Open iOS voice management'
    },
    visit: name => `Visit ${name}`,
    leaveNotice: name => `You are leaving TifloAcosta to visit ${name}. Trials, purchases, installation, accounts and any payments are handled directly by the provider. When you finish, return to TifloReader to refresh the available voices.`,
    confirmExternalProvider: name => `You are leaving TifloAcosta and opening ${name} on the web. Do you want to continue?`,
    close: 'Back to voices',
    unavailable: 'The external destination could not be opened.'
  }
});

function languageKey(language='es') {
  return String(language).toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function readingVoiceCatalogCopy(language='es', platform='generic') {
  const base = PLATFORM_COPY[languageKey(language)];
  const selected = base[String(platform || 'generic').toLowerCase()] || base.generic;
  return {
    ...base.generic,
    ...selected,
    visit: base.visit,
    leaveNotice: base.leaveNotice,
    confirmExternalProvider: base.confirmExternalProvider,
    close: base.close,
    unavailable: base.unavailable
  };
}

export function normalizeVoiceProviders(providers=[], platform='generic') {
  const platformName = String(platform || 'generic').toLowerCase();
  return (Array.isArray(providers) ? providers : []).map(provider => {
    if (!provider || typeof provider !== 'object') return null;
    const id = String(provider.id || '').trim();
    const name = String(provider.name || '').trim();
    const url = String(provider.url || '').trim();
    if (!id || !name) return null;
    return {
      id,
      name,
      url,
      platform: String(provider.platform || platformName).toLowerCase(),
      type: String(provider.type || READING_VOICE_PROVIDER_TYPES.EXTERNAL),
      packageName: String(provider.packageName || '').trim()
    };
  }).filter(Boolean);
}

export function confirmExternalProvider(provider, language='es', confirmFn=globalThis.confirm) {
  if (!provider || typeof confirmFn !== 'function') return false;
  return confirmFn(readingVoiceCatalogCopy(language, provider.platform).confirmExternalProvider(provider.name));
}
