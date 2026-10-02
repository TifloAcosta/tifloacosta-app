# Convergencia Web / Android / iOS

## Objetivo

Convertir las capacidades implementadas durante la beta Android en una base común reutilizable por la web app y por la futura app iOS, evitando duplicar lógica y manteniendo adaptadores específicos para cada plataforma.

## Estado actual

La web clásica vive principalmente en archivos de la raíz del repositorio (`app.js`, `downloads.js`, `videos.js`, etc.).

La app móvil ya está modularizada en:

- `mobile/src/core`: lógica de aplicación reutilizable.
- `mobile/src/screens`: pantallas y presentación.
- `mobile/src/native`: puentes específicos de plataforma.
- `mobile/android`: implementación Android.

## Clasificación inicial

### Compartible directamente

- Gestión del foco accesible.
- Preferencias de idioma, tamaño, tema, espaciado y texto.
- Favoritos.
- Estado de novedades leídas.
- Búsqueda y clasificación de resultados.
- Organización de contenidos.
- Parte de Descargas: clasificación de URL, metadatos, validación y presentación.
- TifloLector: sesión de lectura, navegación, marcadores, búsqueda, cola, HTML y lógica de lectura.
- Pantallas de Actualidad, Vídeos, Podcast, Contacto, Privacidad y Configuración.
- Controles accesibles de vídeo.
- Identidad visual y estilos comunes.

### Compartible mediante adaptadores

- Guardar archivos.
- Abrir archivos externos.
- Compartir texto y archivos.
- Importar documentos.
- Acceso a archivos locales.
- Lectura de páginas remotas.
- Reproducción en segundo plano.
- Notificaciones.
- Actualizaciones de la aplicación.
- TTS.

### Específico de Android

- ML Kit OCR.
- ML Kit Translation.
- Media3 / controles multimedia Android.
- Servicios Android en segundo plano.
- Google Play In-App Updates.
- Código Java/Kotlin y permisos Android.

### Futuro adaptador iOS

- Vision / OCR equivalente.
- Traducción disponible en iOS o servicio alternativo.
- AVFoundation / controles multimedia.
- Compartición y selector de archivos nativos.
- Notificaciones push.
- Integración con App Store.

## Orden de trabajo

1. Extraer utilidades comunes sin cambiar comportamiento.
2. Mantener archivos de compatibilidad en `mobile/src/core` mientras se migra.
3. Hacer que Android consuma la capa compartida.
4. Hacer que la web consuma progresivamente la misma capa.
5. Añadir adaptadores web donde una API nativa no exista.
6. Añadir pruebas de paridad para impedir divergencias futuras.
7. Iniciar iOS sobre la misma base común.

## Primera extracción

El manejo de foco accesible se ha movido a `shared/focus.mjs`.

`mobile/src/core/focus.mjs` permanece como punto de compatibilidad y reexporta la implementación compartida.

## Próximos candidatos

1. Preferencias.
2. Favoritos.
3. Búsqueda.
4. Clasificación y presentación de descargas.
5. Sesión y navegación de TifloLector.
6. Controles accesibles de vídeo.
