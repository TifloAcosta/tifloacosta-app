# Decisión de arquitectura iOS — 17 de octubre de 2026

## Decisión definitiva

La interfaz única de TifloAcosta para iPhone será la interfaz móvil incluida en `mobile/src`, empaquetada en `mobile/dist` mediante Capacitor y conectada a los módulos iOS nativos. La web pública se conserva como producto independiente; nunca debe ocupar el contenedor principal de la app iOS. Se puede compartir lógica, datos y servicios, pero no duplicar sistemas de navegación ni capas de pantallas.

Esta decisión NO declara preparada una actualización de TestFlight. La migración se completa cuando las pruebas de paridad y el paquete `.app` verificado satisfacen los criterios siguientes.

## Estado antes de migrar

En `preparacion-ios`, `ios-testflight.yml` utiliza `ios-build/prepare-web.mjs` y `ios-build/www`; el `index.html` empaquetado procede de la interfaz web pública. Se ha comprobado que la captura IMG_1024 muestra precisamente ese diseño web. La interfaz móvil distinta `mobile/src/index.html` + `mobile/src/app.mjs` no es hoy el origen del paquete TestFlight.

No afirmar que las dos páginas se renderizan simultáneamente; sí afirmar que existen dos implementaciones incompatibles y que la compilación usa la que se ha decidido retirar del iPhone.

## Reglas de migración

- Una sola raíz visual (`#app`), un único router móvil, una sola secuencia de foco y un único diseño de pantallas. Aplicar safe areas y escala de texto del sistema sin forzar tamaños superiores por defecto. Mantener ajustes graduables por usuario.
- El paquete iOS debe construirse a partir de `mobile/dist` y comprobarlo en el resultado de Xcode. Prohibido cargar `https://tifloacosta.com/` como shell o inyectar `index.html` de la raíz web.
- Mantener prestaciones probadas: Importar/Recibidos/App Group, EPUB y audio con títulos, enlaces YouTube, compartir, TifloLector con TTS/DAISY/marcas/cola/carpetas, controles ajustables y acciones VoiceOver, actualidad, recursos, vídeos y descargas.
- Los puentes nativos de `ios-build/native`, `share-extension` y los módulos del lector deben adaptarse a la única UI, no copiarse a otra página HTML en paralelo.
- La web pública (raíz del repositorio) no debe cambiar accidentalmente por trabajos exclusivos de iOS.
- Exigir prueba de imagen real, acciones de VoiceOver y pruebas automatizadas de navegación/estilos en iPhone antes de subir a TestFlight.
- Hasta validar la paridad, conservar intacta la ruta de publicación actual y no presentar el nuevo empaquetado como listo.

Seguimiento y tareas: https://github.com/TifloAcosta/tifloacosta-app/issues/210
