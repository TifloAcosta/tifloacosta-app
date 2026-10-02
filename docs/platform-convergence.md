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


## TifloLector: núcleo compartido

Ya se han extraído a `shared/`:

- sesión de lector y sesión de lectura;
- modelo semántico y segmentación por frases;
- búsqueda dentro del documento;
- ajustes de lectura;
- modelo de texto y adaptación HTML;
- cliente abstracto de biblioteca;
- cola, marcas, progreso y metadatos a través del cliente de biblioteca;
- flujo OCR, con motor y versión parametrizables;
- traducción y cliente de traducción, con motor parametrizable;
- controlador de audiolibro;
- controlador TTS desacoplado de Android mediante inyección de adaptadores.

### Adaptadores que siguen siendo de plataforma

Android mantiene actualmente:

- almacenamiento e importación nativa de la biblioteca;
- ML Kit OCR;
- ML Kit Translation;
- TTS en segundo plano;
- reproducción multimedia y Media3;
- selector/compartición de archivos;
- gestión e instalación de voces del sistema Android.

La futura app iOS deberá implementar equivalentes para esas capacidades, reutilizando el mismo núcleo compartido.


## Traducción web

La web reutiliza `createReadingTranslationJob` y `createReadingTranslationClient` desde `shared/`.

El adaptador `shared/web-reading-translation-adapter.mjs`:
- utiliza las APIs `Translator` y `LanguageDetector` del navegador cuando están disponibles;
- prepara el par de idiomas mediante una acción explícita del usuario;
- traduce por lotes sin sustituir el documento original;
- permite alternar entre Original y Traducción conservando la posición;
- guarda contenido derivado en IndexedDB cuando el documento pertenece a la biblioteca;
- usa memoria de sesión cuando el documento todavía no está guardado;
- informa de forma accesible cuando el navegador no ofrece traducción integrada.

No se introduce un servicio propio de traducción en servidor. La futura implementación iOS podrá aportar otro adaptador conservando el mismo contrato compartido.
