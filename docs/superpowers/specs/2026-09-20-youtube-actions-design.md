# Diseño: acciones de YouTube dentro de TifloAcosta

Fecha: 20 de septiembre de 2026

## Objetivo

Añadir al reproductor de vídeos de TifloAcosta acciones autenticadas de YouTube —suscribirse al canal, marcar Me gusta y publicar un comentario— sin alterar el funcionamiento actual del catálogo, del reproductor, de los controles accesibles, de Descargas, de Actualidad ni de la navegación general.

Ver un vídeo seguirá siendo siempre público y no requerirá iniciar sesión.

## Principios no negociables

1. El reproductor actual no se reemplaza ni se reestructura.
2. La reproducción, Retroceder 1 minuto, Reproducir/Pausar, Avanzar 1 minuto, Cerrar reproductor y Abrir en YouTube seguirán funcionando aunque Google, OAuth o el Worker fallen.
3. `tifloacosta.com` seguirá servido directamente por GitHub Pages. No se volverá a poner el dominio principal detrás del proxy de Cloudflare.
4. El nuevo backend de YouTube usará un subdominio independiente, previsto como `https://youtube-auth.tifloacosta.com`.
5. El Worker de Descargas y `download.tifloacosta.com` no se modificarán.
6. Ningún secreto de Google ni token de usuario se incluirá en el JavaScript público de TifloAcosta.
7. No se añadirá una opción para cancelar la suscripción al canal desde TifloAcosta.
8. No se añadirá una opción para marcar No me gusta ni para retirar un Me gusta en esta fase.
9. Un comentario nunca se publicará sin una acción explícita final del usuario.

## Experiencia del usuario

### Usuario sin autorización de TifloAcosta para YouTube

El usuario puede abrir y reproducir cualquier vídeo exactamente como ahora.

Debajo de los controles actuales aparecerá un bloque independiente de acciones de YouTube. Mostrará:

- `Ver detalles`.
- Un texto breve que explique que para suscribirse, dar Me gusta o comentar hay que conectar la cuenta de YouTube.
- `Iniciar sesión en YouTube`.

No se afirmará si el usuario está o no suscrito mientras TifloAcosta no tenga autorización para consultarlo.

### Usuario ya autorizado

Al abrir un vídeo, TifloAcosta comprobará la sesión con el Worker. Si sigue válida, no mostrará `Iniciar sesión en YouTube`.

Mostrará directamente las acciones correspondientes al estado real de la cuenta:

#### Suscripción

Esta acción será la primera y la más visible del bloque autenticado.

Si el usuario no está suscrito:

- Botón: `Suscribirme al canal TifloAcosta`.
- Una sola pulsación realiza la suscripción.
- Tras completarse, el botón desaparece.
- Se anuncia mediante una región `aria-live`: `Suscripción realizada. Ya estás suscrito al canal TifloAcosta.`
- El foco permanece en el mismo bloque de acciones.

Si ya está suscrito:

- Se muestra el estado: `Ya estás suscrito al canal TifloAcosta`.
- No se muestra ningún control para cancelar la suscripción.

#### Me gusta

Si todavía no ha marcado Me gusta:

- Botón: `Me gusta este vídeo`.
- Tras la acción se anuncia: `Has marcado Me gusta en este vídeo.`
- El control pasa a estado informativo y no ofrece una acción accidental para retirar el Me gusta.

Si ya había marcado Me gusta:

- Se muestra: `Ya has marcado Me gusta en este vídeo`.

Si la cuenta tuviera otro estado de valoración, TifloAcosta no ofrecerá un control de No me gusta; únicamente permitirá marcar Me gusta si corresponde.

#### Comentar

- Botón: `Comentar este vídeo`.
- Al activarlo aparece un campo de edición claramente etiquetado.
- Se muestran `Publicar comentario` y `Cancelar`.
- `Publicar comentario` solo se habilita con texto no vacío.
- Antes de enviar, la acción sigue siendo explícita: escribir no publica.
- Tras éxito: `Comentario publicado en YouTube.`
- Si YouTube no permite comentarios en ese vídeo o rechaza la operación, se anuncia el motivo en lenguaje claro y el resto del reproductor sigue funcionando.

#### Cerrar sesión

- Control: `Cerrar sesión de YouTube en TifloAcosta`.
- Elimina la sesión de TifloAcosta para ese navegador.
- No cierra la sesión global de Google ni de la aplicación oficial de YouTube.
- No elimina por sí mismo la autorización concedida en la cuenta de Google; una futura conexión puede volver a utilizar una autorización todavía válida según el comportamiento de Google.

## Ver detalles

`Ver detalles` no requiere autenticación y no depende del Worker.

Usará los datos que ya tiene el catálogo de TifloAcosta para mostrar de forma accesible, como mínimo:

- título;
- fecha de publicación;
- descripción disponible;
- enlace `Abrir este vídeo en YouTube`.

Esta función no debe introducir una segunda copia del catálogo ni otra fuente de verdad.

## Arquitectura

### Frontend existente

`videos.html` y `videos.js` conservan el reproductor actual. Se añade un módulo de acciones de YouTube separado para reducir el riesgo de regresiones.

Preferencia de estructura:

- `youtube-actions.js`: estado de interfaz y llamadas al backend.
- `youtube-actions-core.js`: funciones puras y comprobables cuando sea útil.
- estilos añadidos de forma aislada, sin cambiar reglas generales del reproductor.

El reproductor solo pasa al módulo el `videoId` activo y los datos públicos necesarios.

### Worker independiente

Nuevo directorio previsto:

`youtube-worker/`

Nuevo Worker previsto:

`tifloacosta-youtube-actions`

Dominio previsto:

`youtube-auth.tifloacosta.com`

No se añadirá ninguna ruta del Worker sobre `tifloacosta.com/*`.

### Endpoints previstos

- `GET /health`: salud del servicio, sin datos privados.
- `GET /auth/start`: inicia OAuth y redirige a Google.
- `GET /auth/callback`: valida la respuesta de Google, crea la sesión y vuelve a TifloAcosta.
- `GET /session`: informa si existe una sesión válida.
- `GET /state?videoId=...`: devuelve suscripción al canal TifloAcosta y valoración del vídeo para la cuenta autenticada.
- `POST /subscribe`: suscribe al canal TifloAcosta si todavía no existe la suscripción.
- `POST /like`: marca Me gusta sobre el vídeo indicado.
- `POST /comment`: publica un comentario superior en el vídeo indicado.
- `POST /logout`: elimina la sesión local de TifloAcosta.

Las rutas exactas pueden agruparse durante la implementación si eso reduce código sin cambiar el contrato funcional.

## OAuth y permisos

Se usará OAuth 2.0 de Google con flujo de aplicación web del lado servidor.

Como la publicación de comentarios de YouTube requiere `https://www.googleapis.com/auth/youtube.force-ssl`, se utilizará ese permiso como único alcance de YouTube para esta fase, en lugar de solicitar varios permisos superpuestos.

La pantalla de consentimiento de Google puede describir ese permiso de forma más amplia que las tres acciones que implementa TifloAcosta. La aplicación, sin embargo, limitará su código a:

- comprobar y crear la suscripción al canal TifloAcosta;
- consultar y establecer Me gusta en el vídeo activo;
- crear un comentario superior en el vídeo activo.

No se implementarán operaciones para borrar vídeos, modificar vídeos, gestionar subtítulos ni otras capacidades que ese permiso pudiera permitir técnicamente.

## Sesión y secretos

Secretos previstos en el Worker:

- `GOOGLE_CLIENT_ID`.
- `GOOGLE_CLIENT_SECRET`.
- `YOUTUBE_SESSION_SECRET`.

La URI de retorno de Google será la del Worker, por ejemplo:

`https://youtube-auth.tifloacosta.com/auth/callback`

La sesión se mantendrá mediante una cookie cifrada, `HttpOnly`, `Secure`, de host exclusivo del subdominio del Worker, preferiblemente con prefijo `__Host-`.

El contenido mínimo de sesión será el necesario para renovar la autorización y proteger la sesión. El navegador no expondrá el token de actualización al JavaScript de TifloAcosta.

El flujo OAuth utilizará `state` y PKCE. El estado temporal de OAuth se conservará también en cookie segura de corta duración.

Si una autorización existente no devuelve un token renovable y no existe sesión utilizable, el Worker podrá solicitar un nuevo consentimiento de Google únicamente cuando sea necesario.

## CORS y protección frente a solicitudes cruzadas

El Worker aceptará credenciales desde el origen de producción:

`https://tifloacosta.com`

No se usará `Access-Control-Allow-Origin: *` en rutas autenticadas.

Las llamadas autenticadas del frontend usarán `credentials: include`.

Las operaciones `POST` comprobarán el origen permitido y usarán protección CSRF asociada a la sesión.

## Conservación del vídeo durante OAuth

Si el usuario inicia OAuth desde un vídeo concreto:

1. TifloAcosta guarda temporalmente el `videoId` activo en `sessionStorage`.
2. Se navega al Worker y a Google.
3. Google vuelve al Worker.
4. El Worker redirige de nuevo a `https://tifloacosta.com/videos.html`.
5. El frontend recupera el `videoId` pendiente y vuelve a abrir ese mismo vídeo.
6. El foco se sitúa en el bloque de acciones o en el título del reproductor según resulte más estable con JAWS, NVDA y VoiceOver.

Esto evita obligar al usuario a buscar de nuevo el vídeo tras autorizar la cuenta.

## Accesibilidad

El bloque de acciones deberá cumplir:

- controles nativos `button`, `label` y `textarea`;
- textos visibles que no dependan de color o iconos;
- estados anunciados con `aria-live` sin repetir mensajes innecesariamente;
- gestión explícita del foco después de suscripción, Me gusta, comentario, cancelación, errores y regreso de OAuth;
- ningún salto al principio de la página tras una acción;
- español e inglés con textos equivalentes;
- funcionamiento con JAWS, NVDA y VoiceOver;
- el reproductor seguirá aislado del catálogo mientras esté abierto, manteniendo la corrección ya publicada para Windows.

## Tratamiento de errores

Los fallos de autenticación o de YouTube nunca bloquearán el vídeo.

Ejemplos de mensajes:

- `No se pudo conectar con YouTube. Puedes seguir viendo el vídeo y volver a intentarlo.`
- `YouTube no permite comentarios en este vídeo.`
- `No se pudo completar la suscripción. No se ha realizado ningún cambio.`
- `La sesión de YouTube ha caducado. Inicia sesión de nuevo para continuar.`

No se mostrarán cuerpos de error técnicos, tokens ni datos sensibles al usuario.

## Privacidad y cumplimiento

Antes de abrir el acceso público se revisará que TifloAcosta disponga de una URL pública adecuada para la política de privacidad y de los datos requeridos por la pantalla de consentimiento de Google.

La interfaz explicará que la conexión con YouTube se usa exclusivamente para ejecutar las acciones que el usuario solicite.

TifloAcosta no pedirá ni recibirá la contraseña de Google o YouTube.

## Pruebas obligatorias antes de integrar

### Regresiones existentes

Deben seguir pasando todas las pruebas actuales, incluyendo:

- catálogo de vídeos;
- reproductor incrustado;
- Retroceder 1 minuto;
- Reproducir/Pausar;
- Avanzar 1 minuto;
- cierre y restauración de foco;
- aislamiento del reproductor en Windows;
- Descargas;
- Actualidad;
- compilación de Pages.

### Nuevas pruebas del frontend

Como mínimo:

- usuario no autenticado: ver vídeo sin login y mostrar únicamente la conexión a YouTube;
- usuario autenticado y no suscrito: mostrar `Suscribirme al canal TifloAcosta`;
- usuario ya suscrito: no ofrecer suscripción de nuevo;
- suscripción correcta: mantener foco y anunciar estado;
- Me gusta ya existente y Me gusta nuevo;
- comentario vacío no publicable;
- comentario publicado y error de comentarios desactivados;
- logout vuelve al estado no autenticado;
- error del Worker no afecta al reproductor.

### Nuevas pruebas del Worker

Con la API de YouTube simulada en CI:

- creación y validación de `state` y PKCE;
- callback inválido rechazado;
- cookie de sesión protegida;
- CORS solo para el origen permitido;
- CSRF requerido en escrituras;
- consulta de suscripción;
- suscripción idempotente;
- consulta y establecimiento de Me gusta;
- publicación de comentario;
- expiración o revocación de token;
- logout elimina la sesión;
- ninguna respuesta expone refresh tokens o secretos.

No se usarán cuentas personales reales de Google en CI.

## Estrategia de despliegue

1. Desarrollar todo en rama independiente.
2. Crear y probar el Worker sin enlazarlo todavía desde la interfaz pública.
3. Validar `/health`, OAuth y operaciones con una cuenta de prueba autorizada.
4. Añadir el bloque de acciones al reproductor manteniendo intactos sus controles actuales.
5. Ejecutar la suite completa.
6. Integrar únicamente con todas las pruebas verdes.
7. Publicar Pages y Worker por separado.
8. Hacer prueba manual accesible en Windows y iPhone antes de considerar cerrada la función.

## Fuera de alcance en esta fase

- cancelar suscripción;
- retirar Me gusta o marcar No me gusta;
- responder a comentarios existentes;
- moderar, editar o borrar comentarios;
- subir o modificar vídeos;
- administrar listas de reproducción;
- iniciar o cerrar la sesión global de Google o de la aplicación oficial de YouTube;
- cambiar la arquitectura de Descargas;
- volver a poner `tifloacosta.com` detrás del proxy de Cloudflare.

## Criterio de éxito

La función se considera lista cuando una persona puede:

1. abrir y ver un vídeo sin iniciar sesión;
2. autorizar YouTube solo cuando intenta usar una acción de cuenta;
3. regresar al mismo vídeo tras OAuth;
4. suscribirse al canal TifloAcosta con una sola acción clara;
5. saber inmediatamente si ya está suscrita;
6. marcar Me gusta;
7. publicar un comentario mediante confirmación explícita;
8. cerrar la sesión de YouTube en TifloAcosta;
9. realizar todo lo anterior con lector de pantalla sin perder foco;
10. seguir usando el reproductor actual aunque el servicio de YouTube autenticado falle.
