# Configuración de OAuth de YouTube para TifloAcosta

Fecha: 20 de septiembre de 2026

## Objetivo

Configurar el Worker `tifloacosta-youtube-actions` para que las personas usuarias puedan autorizar su cuenta de YouTube y, desde TifloAcosta, suscribirse al canal, marcar Me gusta y publicar comentarios sin exponer credenciales ni tokens en el sitio público.

## Arquitectura que debe conservarse

- `https://tifloacosta.com` continúa servido directamente por GitHub Pages.
- No crear rutas de Workers sobre `tifloacosta.com/*`.
- El Worker de Descargas y `https://download.tifloacosta.com` no se modifican.
- El nuevo servicio usa exclusivamente `https://youtube-auth.tifloacosta.com`.
- El frontend solo conoce la URL pública del Worker.

## 1. Google Cloud

En el mismo proyecto de Google Cloud que se elija para esta función:

1. Activar YouTube Data API v3.
2. Configurar la pantalla de consentimiento OAuth con el nombre público de TifloAcosta y la información requerida por Google.
3. Añadir la URL pública de privacidad de TifloAcosta:
   `https://tifloacosta.com/privacidad/`
4. Crear un cliente OAuth 2.0 de tipo Aplicación web.
5. Registrar exactamente como URI de redirección autorizada:
   `https://youtube-auth.tifloacosta.com/auth/callback`
6. No colocar el secreto del cliente en GitHub, JavaScript, HTML ni archivos públicos.

El único alcance de YouTube solicitado por esta fase es:

`https://www.googleapis.com/auth/youtube.force-ssl`

Aunque Google puede describir este permiso de forma amplia, el código de TifloAcosta queda limitado a consultar/crear la suscripción al canal TifloAcosta, consultar/marcar Me gusta y crear un comentario superior en el vídeo activo.

## 2. Secretos del Worker

Configurar como secretos de Cloudflare Workers, nunca como variables públicas del repositorio:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `YOUTUBE_SESSION_SECRET`

`YOUTUBE_SESSION_SECRET` debe ser un valor aleatorio suficientemente largo y exclusivo de este servicio.

Las variables no secretas ya previstas en `wrangler.toml` son:

- `ALLOWED_ORIGIN = "https://tifloacosta.com"`
- `APP_RETURN_URL = "https://tifloacosta.com/videos.html"`

## 3. Dominio de Cloudflare

El Worker debe publicarse como custom domain:

`youtube-auth.tifloacosta.com`

No añadir ni modificar registros proxy para el dominio raíz. No cambiar los registros actuales de GitHub Pages ni el Worker de Descargas.

## 4. Comprobaciones antes de enlazarlo públicamente

Comprobar, por este orden:

1. `GET https://youtube-auth.tifloacosta.com/health` responde con el servicio correcto y sin datos sensibles.
2. El origen `https://tifloacosta.com` recibe CORS con credenciales y otros orígenes no son autorizados.
3. `GET /session` sin sesión devuelve estado no autenticado.
4. `/auth/start` redirige a Google usando `state`, PKCE y el alcance previsto.
5. Un callback con `state` incorrecto es rechazado y no crea sesión.
6. Un callback correcto vuelve a `https://tifloacosta.com/videos.html`.
7. Después de autorizar, `/state` informa de suscripción y valoración sin exponer tokens.
8. `/subscribe`, `/like`, `/comment` y `/logout` exigen sesión, origen permitido y CSRF.
9. Ninguna respuesta de error entrega cuerpos internos de Google, secretos o tokens.

## 5. Prueba funcional de cuenta

Usar inicialmente una cuenta de prueba autorizada para comprobar:

- usuario no suscrito: aparece `Suscribirme al canal TifloAcosta` y una pulsación realiza la suscripción;
- usuario ya suscrito: se muestra el estado y no aparece un botón para cancelar;
- Me gusta: se aplica una vez y luego se muestra como estado;
- comentario: solo se publica después de pulsar expresamente `Publicar comentario`;
- comentarios desactivados: se muestra un mensaje comprensible y el vídeo sigue funcionando;
- cerrar sesión: elimina la sesión de TifloAcosta sin cerrar Google o la app oficial de YouTube.

## 6. Pruebas de accesibilidad obligatorias

Antes de considerar terminada la función, comprobar por separado:

- Windows con JAWS;
- Windows con NVDA;
- iPhone con VoiceOver;
- Android con TalkBack.

En cada plataforma verificar reproducción sin login, acceso a detalles, OAuth, regreso al mismo vídeo, orden de acciones, suscripción, Me gusta, comentario, mensajes `aria-live`, cierre de sesión y conservación del foco/contexto.

## 7. Publicación

No integrar la rama en `main` ni desplegar el Worker de producción hasta que:

- las pruebas automáticas estén verdes;
- se haya configurado la aplicación OAuth en Google;
- la política de privacidad pública describa la conexión con YouTube;
- las pruebas manuales accesibles requeridas estén registradas;
- se haya comprobado que Descargas, Actualidad y el reproductor existente continúan funcionando.
