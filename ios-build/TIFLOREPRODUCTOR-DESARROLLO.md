# TifloReproductor para iOS — desarrollo incremental

Fecha: 11 de octubre de 2026. Rama de trabajo independiente de `preparacion-ios`.

## Orden de prioridades acordado

1. TifloReproductor propio de iOS.
2. Tiflolector iOS.
3. Recepción de contenido compartido y notificaciones iOS.

## Fase 1 — Base accesible (en revisión)

- Controlador nativo Swift dentro del paquete iOS. No afecta a Android ni a la web.
- Título del vídeo y detalles procedentes de Vídeos o Actualidad.
- Acciones nativas «Cerrar y volver», «Pausar/Reanudar», «Ver/Ocultar detalles» y «Abrir en YouTube».
- Primera adaptación del gesto mágico de VoiceOver.
- Reutilización del reproductor incrustado permitido por YouTube: no descargar ni extraer streams.
- Conservación del `Referer` de identificación para evitar el error 153.
- La pausa y la reanudación emplean las funciones públicas de WKWebView. Todavía no equivale a controlar el inicio o el desplazamiento temporal con la API IFrame.
- No alterar AVAudioSession sin pruebas reales: la continuidad del habla de VoiceOver sigue **sin verificar** y es criterio bloqueante para entregar como estable.

## Fase 2 — Transporte y VoiceOver

- Verificar en un iPhone con VoiceOver que navegar mientras el vídeo suena no silencia al lector.
- Investigar y corregir la interacción entre la reproducción embebida y el audio de VoiceOver sin sobreescribir a ciegas AVAudioSession.
- Integrar los controles de reproducir/pausar, avance, retroceso y posición con APIs documentadas y comprobar si son compatibles con el reproductor autorizado de YouTube.
- Mantener «Abrir en YouTube» cuando el vídeo no admita reproducción interna.
- Restaurar el foco al mismo botón al cerrar, también desde Actualidad.

## Fase 3 — Acciones autenticadas de YouTube

La web del repositorio contiene `youtube-actions.js` y el servicio `youtube-worker/` con OAuth, estado de la cuenta, Me gusta, suscripción y publicación de comentarios.

Para iOS aún hay que:

- Adaptar el retorno del flujo OAuth a la aplicación instalada, conservando vídeo y foco.
- Resolver la autorización de operaciones para el origen nativo sin relajar indiscriminadamente CORS/CSRF ni exponer secretos.
- Presentar acciones de cuenta con interfaz accesible: conectar, estado de sesión, Me gusta, suscripción, editor de comentarios, detalles y cierre de sesión.
- Ampliar cuidadosamente la suscripción a otros canales; la implementación actual solo suscribe al canal TifloAcosta.
- Asegurar que ver vídeos no requiere iniciar sesión y que un error de cuenta no detiene la reproducción.

## Avance del «sigue 2» — autorización y acciones en rama

- Se mantiene el único cliente Google existente y su redirección HTTPS al Worker.
- Nuevo inicio nativo con ASWebAuthenticationSession, desafío SHA-256 generado en iPhone y retorno por esquema tifloacosta.
- El Worker envía un ticket cifrado de 90 segundos ligado al desafío del dispositivo; la app lo canjea sin entregar la contraseña a TifloAcosta ni exponer tokens en JavaScript.
- El Worker devuelve una sesión opaca cifrada que el iPhone guarda en Keychain, accesible solo desde el componente nativo.
- Rutas nativas protegidas para estado, «Me gusta», suscripción al canal real y publicación explícita de comentarios.
- Se incorpora un grupo plegable de controles de cuenta en el reproductor nativo: conectar, consultar estado, suscribirse, Me gusta, escribir, publicar/cancelar y desconectar.
- No se cambia el flujo web publicado, ni la app Android. El Worker y el binario iOS **deberán distribuirse en orden coordinado** después de las pruebas.
- El ticket tiene caducidad corta y prueba de posesión del desafío, pero **sin almacenamiento persistente en el servidor no es estrictamente de un único uso**. Si el requisito de un solo canje resulta necesario se necesitará KV/Durable Object u otro almacenamiento.
- Desconectar elimina la credencial de Keychain, pero no revoca automáticamente el permiso de Google ni otros ejemplares de la sesión cifrada en el servidor. No afirmar lo contrario.

### Antes de publicar

- Preflight Xcode verde con los nuevos controles y AuthManager.
- Verificar el intercambio real OAuth Google/Worker/iPhone, el retorno al mismo vídeo y la conservación de VoiceOver.
- Actualizar la política de privacidad de iOS para explicar que se usa Google cuando el usuario conecta YouTube; revisar los metadatos de App Store.
- Corregir que VoiceOver deje de hablar durante la reproducción y completar controles de avance, retroceso y posición.
- Confirmar que la API productiva de Cloudflare Worker está publicada y responde antes de distribuir el IPA que la utiliza.

## Sigue 3 — interfaz desplazable y ensayo de audio VoiceOver

- Toda la pantalla nativa del reproductor usa una única zona desplazable: los botones, detalles, cuenta y comentario siguen visibles con letra grande.
- La zona de vídeo conserva al menos 225 puntos de alto (YouTube exige un mínimo de 200 por 200).
- El panel de cuenta ya no encierra botones en otra lista desplazable de altura fija.
- Al completar Me gusta o suscripción, cerrar el editor de comentario o desconectar, el foco vuelve a un control/estado estable.
- El nuevo botón «Audio compatible con VoiceOver» permite activar/desactivar una **prueba reversible** de AVAudioSession `.playback` con `.mixWithOthers`. Al cerrar el vídeo se restaura la categoría y opciones previas.
- Por defecto la prueba está activada solamente cuando VoiceOver funciona. Puede desactivarse desde el propio reproductor.
- **La prueba no constituye una garantía de que el vídeo permita hablar a VoiceOver en el dispositivo.** Si iOS/YouTube sigue silenciando la voz, no publicar como solucionado: comprobar en iPhone y ofrecer una ruta alternativa accesible.
- Las pruebas de Swift, código empaquetado y autorización siguen corriendo en preflight sin distribuir a TestFlight.

## Verificación y distribución

La rama solo se integrará en `preparacion-ios` después de que pase el preflight de Xcode y se hayan resuelto los problemas detectados. Una vez integrado, el workflow de TestFlight podrá generar la siguiente compilación. No confundir compilación correcta con accesibilidad comprobada: esta última requiere prueba en iPhone.
