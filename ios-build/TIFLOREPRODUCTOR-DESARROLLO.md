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

## Sigue 4 — controles reales YouTube IFrame API

- Se sustituyó la antigua pausa de toda la WKWebView por control del reproductor IFrame mediante la biblioteca pública `https://www.youtube.com/iframe_api`.
- El HTML empaquetado `native/tiflo-youtube-player.html` instancia `YT.Player` con `enablejsapi=1`, `playsinline=1` y sin reproducción automática.
- Se carga mediante `WKWebView.loadHTMLString(_:baseURL:)` con una base HTTPS identificada por el bundle ID. Esto sigue el mecanismo de Referer publicado por YouTube para WebViews con HTML local; no garantiza por sí solo que no ocurra el error 153 en todos los dispositivos.
- Botones nativos `Reproducir/Pausar`, `Retroceder 30 segundos`, `Avanzar 30 segundos`. Barra de posición nativa `UISlider` ajustable con VoiceOver.
- El texto de posición y duración procede de `getCurrentTime()` y `getDuration()`; no se anuncia cada segundo ni se inventan duraciones.
- La lógica rechaza saltos inválidos, limita los saltos a la duración real, y deja inactivas las funciones de posición hasta conocer una duración válida.
- Mensajes del IFrame al código Swift pasan por `WKScriptMessageHandler` y solo se aceptan cuando proceden del marco principal del HTML empaquetado.
- Los errores de YouTube, en particular el 153, desactivan controles que no funcionan y mantienen `Abrir en YouTube` como alternativa. Los bloqueos de reproducción automática remiten al botón dentro del reproductor de YouTube.
- Las pruebas incluyen ejecución real, simulada sin red, del controlador JavaScript para reproducir, pausar, buscar, verificar progreso y avisar errores 153.
- Pendiente: prueba física con VoiceOver en iPhone, comprobar reproducción dentro de la app, que los controles vuelven a recibir voz durante el vídeo, y respuesta al doble toque con dos dedos. No equivale a una validación real de accesibilidad ni a un permiso para publicar.

## Sigue 5 — preparación de inicio de sesión y errores VoiceOver

- El Worker ofrece `GET /native/capabilities` con versión de protocolo y funciones disponibles. Solo devuelve estados generales; nunca credenciales, claves ni cookies.
- Antes de presentar el consentimiento de Google, el cliente iOS comprueba por URLSession si el Worker publicado acepta el protocolo 1. Si aún no está disponible, anuncia la indisponibilidad sin pedir al usuario autenticarse en vano.
- Cuando el servidor rechaza un comentario, suscripción o «Me gusta», VoiceOver distingue sesión caducada, comentarios desactivados, cuentas no autorizadas, permisos insuficientes, límites temporales y vídeo desaparecido.
- Si una operación devuelve código 401, iOS borra la sesión local del llavero, muestra «Conectar mi cuenta de YouTube» y restaura el foco.
- Se amplían pruebas de seguridad y accesibilidad para el contrato de capacidades y se exige el esquema de retorno `tifloacosta` en el `Info.plist` de la app generada.
- El workflow de despliegue de Cloudflare añade una comprobación de `/native/capabilities` **posterior** a publicar el Worker: debe responder que ofrece el protocolo 1 y las tres operaciones. Esta comprobación NO despliega por sí misma cambios ni acredita un inicio de sesión real.
- Sigue siendo necesario publicar primero la API compatible y después la actualización de TestFlight. El servicio web existente no debe interrumpirse durante la transición.

## Verificación y distribución

La rama solo se integrará en `preparacion-ios` después de que pase el preflight de Xcode y se hayan resuelto los problemas detectados. Una vez integrado, el workflow de TestFlight podrá generar la siguiente compilación. No confundir compilación correcta con accesibilidad comprobada: esta última requiere prueba en iPhone.

## Sigue 6 — resultado del preflight y bloqueo de distribución prematura

- GitHub Actions 38162877682 (preflight iOS) completó correctamente, incluida la compilación de Xcode 26 Release sin firma y comprobaciones de integración, cifrado exento y esquema de retorno.
- GitHub Actions 38162877683 (Test YouTube actions): pasan 50 de 50 pruebas específicas del Worker. La suite general pasa 365 de 369: cuatro fallos en Descargas (dos), Novedades (uno) y Privacidad (uno), ajenos a los ficheros modificados para el reproductor. No considerar aprobado el conjunto.
- El workflow ios-testflight.yml tiene ahora una barrera anterior a numeración, firma y subida. Si existe el gestor nativo YouTube, comprueba HTTP 200, nativeAuth=true, protocol=1 y acciones like/subscribe/comment en el Worker publicado. Sin esos resultados no se envía ninguna nueva beta.
- Esta barrera NO despliega Cloudflare Worker. El despliegue tiene su workflow separado y deberá verificar su respuesta sin afectar la reproducción web/Android.
- La comprobación HTTP desde el entorno de revisión no resolvió el dominio youtube-auth.tifloacosta.com: no constituye prueba de indisponibilidad real ni de compatibilidad. El runner de GitHub hará la comprobación en la distribución.
- PR #148 permanece como borrador, sin integración en preparacion-ios. No se ha generado, firmado ni enviado nuevo IPA a TestFlight en este paso.
- Pendiente prueba física: continuidad del habla de VoiceOver, gesto mágico, controles de tiempo, retorno del foco, error 153, OAuth Google y acciones autenticadas sobre vídeo/canal real.
- El workflow ya contiene verificaciones del indicador de cifrado exento y mínimo iOS 15.0, sin garantizar que Apple no pida otras intervenciones.
