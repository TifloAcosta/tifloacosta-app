import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const expected = {
  "NativeYouTubeAccount.swift": [
    "        let localized = MusicLocalized.message(text)\n        message = localized\n        UIAccessibility.post(notification: .announcement, argument: localized)",
    "subscriptionsMessage = MusicLocalized.message(\"No hay canales suscritos en esta cuenta.\")"
  ],
  "NativeReaderExternalVoiceCredentials.swift": [
    "Text(MusicLocalized.message(phononInstalled ? \"Modelo inglés instalado\" : \"Modelo inglés sin instalar\"))",
    "Text(MusicLocalized.message(hasGeminiKey ? \"Clave guardada\" : \"Sin clave\"))"
  ]
};
const keys = ["Se ha cerrado la sesión de YouTube en TifloAcosta.","No fue posible iniciar la autorización de Google.","Google no devolvió una respuesta válida a TifloAcosta.","No se han concedido los permisos solicitados por YouTube. Revisa el consentimiento de Google.","Google no ha facilitado la autorización necesaria para mantener la sesión. Repite el acceso y acepta los permisos.","Google no pudo completar la autorización. Comprueba los permisos de la aplicación de TifloAcosta en Google.","La respuesta de Google no contiene la autorización esperada.","No fue posible abrir la identificación de Google.","Sesión de YouTube iniciada.","Escribe un comentario antes de publicarlo.","Se ha cancelado el inicio de sesión con Google.","No se pudo abrir o completar la identificación segura de Google. Comprueba la conexión e inténtalo de nuevo.","La autorización recibida por TifloAcosta ha caducado o no es válida. Inicia sesión nuevamente.","No se pudo validar la sesión de Google con el servicio de YouTube. Comprueba la conexión e inténtalo de nuevo.","Comentario publicado en YouTube.","Me gusta añadido.","Me gusta retirado.","Suscripción realizada.","Suscripción cancelada.","No hay canales suscritos en esta cuenta.","Modelo inglés instalado","Modelo inglés sin instalar","Clave guardada","Sin clave"];
test('YouTube account announcements and external voice credential states respect the application language', () => {
  for (const [file, snippets] of Object.entries(expected)) {
    const source = readFileSync(new URL(file, root), 'utf8');
    for (const snippet of snippets) assert.ok(source.includes(snippet), file + ': ' + snippet);
  }
  for (const language of ['en','fr','de','it','pt']) {
    const raw = readFileSync(new URL(language + '.lproj/Localizable.strings', root), 'utf8');
    for (const key of keys) assert.ok(raw.includes(JSON.stringify(key) + ' = '), language + ': ' + key);
  }
});
