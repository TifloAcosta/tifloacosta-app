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

## Verificación y distribución

La rama solo se integrará en `preparacion-ios` después de que pase el preflight de Xcode y se hayan resuelto los problemas detectados. Una vez integrado, el workflow de TestFlight podrá generar la siguiente compilación. No confundir compilación correcta con accesibilidad comprobada: esta última requiere prueba en iPhone.
