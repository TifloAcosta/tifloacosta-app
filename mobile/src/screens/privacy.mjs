import { addExternalLink, addScreenHeader, clearScreen } from './shared.mjs';

export const PRIVACY_LABELS = Object.freeze({
  es: 'Privacidad y accesibilidad',
  en: 'Privacy and accessibility'
});

const PRIVACY_POLICY_URL = 'https://tifloacosta.com/privacidad/';

const COPY = Object.freeze({
  es: Object.freeze({
    intro: 'TifloAcosta está diseñada para ofrecer sus funciones principales sin obligarte a crear una cuenta.',
    localHeading: 'Biblioteca, lectura y datos locales',
    localBody: 'Los documentos y datos que importas o generas en Leer con TifloAcosta, incluido el texto reconocido mediante OCR y las traducciones locales, junto con tu posición de lectura, marcas, cola y ajustes del lector, se guardan en el espacio privado de la aplicación en este dispositivo. TifloAcosta no modifica ni elimina el archivo original cuando borras su copia de la biblioteca.',
    notificationsHeading: 'Notificaciones',
    notificationsBody: 'Las notificaciones son opcionales. Si decides activarlas, Android y el servicio de notificaciones OneSignal utilizan los identificadores técnicos necesarios para poder entregarlas. Puedes retirar el permiso desde la configuración de Android.',
    externalHeading: 'Contenido y servicios externos',
    externalBody: 'Al abrir una fuente, una red social, YouTube u otro servicio externo, sales de TifloAcosta y pasa a aplicarse la política de privacidad de ese servicio. La aplicación avisa antes de abandonar TifloAcosta cuando corresponde.',
    sharingHeading: 'Compartir y exportar',
    sharingBody: 'TifloAcosta solo envía un documento, enlace o contenido a otra aplicación cuando eliges expresamente una acción de compartir, guardar o exportar.',
    accessibilityHeading: 'Accesibilidad',
    accessibilityBody: 'La interfaz está preparada para TalkBack, texto ampliado, modo claro y oscuro y controles con nombres accesibles. La accesibilidad se considera parte funcional de la aplicación, no un añadido visual.',
    policyLabel: 'Política completa de privacidad de TifloAcosta'
  }),
  en: Object.freeze({
    intro: 'TifloAcosta is designed to provide its main features without requiring you to create an account.',
    localHeading: 'Library, reading and local data',
    localBody: 'Documents and data you import or create in Read with TifloAcosta, including text recognized through OCR and local translations, together with your reading position, marks, queue and reader settings, are stored in the app private space on this device. TifloAcosta does not modify or delete the original file when you remove its library copy.',
    notificationsHeading: 'Notifications',
    notificationsBody: 'Notifications are optional. If you choose to enable them, Android and the OneSignal notification service use the technical identifiers required to deliver them. You can withdraw permission from Android settings.',
    externalHeading: 'External content and services',
    externalBody: 'When you open a source, social network, YouTube or another external service, you leave TifloAcosta and that service privacy policy applies. The app warns you before leaving TifloAcosta where appropriate.',
    sharingHeading: 'Sharing and exporting',
    sharingBody: 'TifloAcosta only sends a document, link or content to another app when you explicitly choose a share, save or export action.',
    accessibilityHeading: 'Accessibility',
    accessibilityBody: 'The interface is designed for TalkBack, enlarged text, light and dark modes, and controls with accessible names. Accessibility is treated as a functional part of the app, not as a visual extra.',
    policyLabel: 'Complete privacy policy for TifloAcosta'
  })
});

function addSection(root, headingText, bodyText) {
  const section = document.createElement('section');
  section.className = 'content-card section-stack';

  const heading = document.createElement('h2');
  heading.textContent = headingText;

  const body = document.createElement('p');
  body.textContent = bodyText;

  section.append(heading, body);
  root.append(section);
}

export function renderPrivacy({ root, router, preferences = { lang: 'es' }, nativeActions, t }) {
  clearScreen(root);
  const lang = preferences.lang === 'en' ? 'en' : 'es';
  const copy = COPY[lang];

  addScreenHeader(root, {
    router,
    title: PRIVACY_LABELS[lang],
    backLabel: t('nav.back')
  });

  const intro = document.createElement('p');
  intro.className = 'content-card';
  intro.textContent = copy.intro;
  root.append(intro);

  addSection(root, copy.localHeading, copy.localBody);
  addSection(root, copy.notificationsHeading, copy.notificationsBody);
  addSection(root, copy.externalHeading, copy.externalBody);
  addSection(root, copy.sharingHeading, copy.sharingBody);
  addSection(root, copy.accessibilityHeading, copy.accessibilityBody);

  const policyActions = document.createElement('div');
  policyActions.className = 'action-group';
  addExternalLink(policyActions, {
    href: PRIVACY_POLICY_URL,
    label: copy.policyLabel,
    onOpen: nativeActions?.openExternal
  });
  root.append(policyActions);
}
