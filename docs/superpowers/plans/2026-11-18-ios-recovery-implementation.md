# Recuperación iOS 500157 — Plan de implementación

> Para ejecutores: usar superpowers:executing-plans; cada tarea exige prueba fallida antes del cambio, prueba satisfactoria después y commit independiente.

**Objetivo:** preparar una nueva candidata privada de iOS desde la compilación pública 500157, preservando presentación y sumando funciones aprobadas.
**Arquitectura:** rama recovery/ios-public-500157-20261118 nacida del commit 440010a2643b88f359474819a6f3d5f11ec9406a. Integrar por componentes, nunca copiar ciegamente la rama experimental.
**Tecnologías:** SwiftUI, Swift, pruebas Node de contratos de fuentes, workflow macOS de Xcode.
**Especificación:** docs/superpowers/specs/2026-11-18-ios-public-recovery-design.md.

## Restricciones generales
- Sin Azure, sin cambios a la app pública, sin publicar o subir a TestFlight sin autorización.
- Mantener y comprobar datos de libros, posiciones y marcas.
- No asumir que la vista del commit 500157 coincide con lo aprobado; corregir orden de forma explícita.
- No mezclar la rama musical completa con la base: seleccionar archivos y adaptaciones necesarias.

## Riesgos que deben cubrir las pruebas
- Biblioteca vacía o filtrada: libros y mensajes coherentes, sin ocultarse tras ajustes.
- PDF OCR y texto con tildes: búsqueda sobre texto realmente disponible.
- Toque mágico repetido con VoiceOver: pausa y reanudación sin retroceso.
- DAISY pesado y con muchas pistas: integridad sin agotar memoria.
- Reproductor YouTube sin sesión o con vídeos no disponibles: informar y continuar cuando proceda.

### Tarea 1. Contratos de presentación TifloLector
**Archivos:** ios-app-native/Sources/NativeTifloLector.swift; ios-app-native/tests/reader-layout-recovery.test.mjs.
- [ ] Escribir pruebas que exijan Importar seguido de Mi biblioteca y luego filtros/carpetas/Ajustes, así como orden interno y control Buscar junto a Crear marca.
- [ ] Ejecutar y observar los fallos actuales.
- [ ] Reorganizar secciones y controles mínimos sin alterar datos de biblioteca.
- [ ] Ejecutar las pruebas nuevas y las existentes; commit.

### Tarea 2. Búsqueda interna y lectura por modalidad
**Archivos:** ios-app-native/Sources/NativeTifloLector.swift, NativeReaderAdvanced.swift y pruebas específicas.
- [ ] Pruebas de búsqueda por documento, coincidencias, navegación, foco, retorno a posición y PDF OCR; verificar fallos.
- [ ] Implementar controles y motor sobre texto extraído, sin confundir búsqueda global con interna.
- [ ] Pruebas de selector ajustable Voz TTS / Lectura visual / Línea braille y continuidad sin límite; verificar fallos.
- [ ] Adaptar presentación por modalidad y comprobar persistencia; commit.

### Tarea 3. Reproducción, marcas y ajustes
**Archivos:** NativeTifloLector.swift, NativeReaderSettings.swift y pruebas.
- [ ] Pruebas fallidas de reanudar sin retroceso, toque mágico alternante, guardado de posición/marcas y ajustes por documento.
- [ ] Implementar correcciones mínimas, velocidades 0,05 y navegación accesible; repetir pruebas y commit.
- [ ] Eliminar Azure Speech de la interfaz y dependencias de lectura; prueba negativa de ausencia de Azure y commit.

### Tarea 3B. Recuperación accesible de Gemini y Phonon
**Archivos:** ajustes y motor iOS TifloLector, servicios de credenciales, pruebas; comparar flujos ya implementados en Android.
- [ ] Auditar si hubo una implementación iOS posterior a la versión pública y verificar su origen antes de reutilizarla; no trasladar sin más código de Android o web.
- [ ] Crear pruebas de selección de motor: voces iOS predeterminadas, Gemini solo con credencial válida, Phonon solo con modelo compatible instalado.
- [ ] Gemini: guía sencilla por pasos para abrir el servicio oficial, crear/copiar la clave, volver, «Pegar clave» desde portapapeles, guardar de forma segura y comprobar conexión/voz con mensajes VoiceOver; confirmar antes de eliminar. No pronunciar ni mostrar el secreto en avisos.
- [ ] Abrir la página oficial en el navegador integrado del sistema con control accesible «Cerrar/Volver a TifloLector»; al regresar, dirigir el foco de accesibilidad al cuadro «Clave API de Gemini» y situar «Pegar clave copiada» inmediatamente después. Probar con VoiceOver todo el trayecto Google → copia → retorno → pegado sin necesidad de recorrer de nuevo los ajustes.
- [ ] Advertir claramente que la creación de clave puede requerir cuenta y condiciones de Google, y que las pruebas y el uso podrían consumir cuota/costes, sin prometer gratuidad.
- [ ] Phonon: verificar compatibilidad iOS/modelos/licencia, selección y muestra accesibles, mensajes claros si falta un modelo; no pedir clave API de Phonon.
- [ ] Comprobar experiencia completa con lector de pantalla y errores previsibles; ejecutar pruebas y commit antes de compilar.

### Tarea 4. DAISY e integración con Compartir
**Archivos:** exportadores iOS, NativeDaisyNCX.swift, Share Extension, pruebas de exportación.
- [ ] Registrar fallos de DAISY incompleto, ZIP de MP3 y diferenciación EPUB/DAISY importado.
- [ ] Exportar original, DAISY de texto+audio+SMIL+NCX, ZIP MP3 Voice Dream y hoja Compartir accesible.
- [ ] Añadir «Compartir documento» a las acciones de accesibilidad de la obra y al menú de acciones; al compartir DAISY, entregar el ZIP íntegro y no una pista suelta.
- [ ] Tras generar DAISY, ofrecer explícitamente «Compartir» o «No compartir y volver a la biblioteca»; ambas opciones accesibles con VoiceOver y sin nueva exportación involuntaria.
- [ ] Validar estructura ZIP en automatización y reproductor externo; commit.

### Tarea 5. Vídeos, Actualidad y elementos comunes
**Archivos:** NativeYouTubePlayer.swift, NativeScreens.swift y pruebas.
- [ ] Escribir prueba de avance entre elementos de lista real de YouTube, orden, pausa y foco.
- [ ] Integrar reproducción continua; probar con condiciones de error.
- [ ] Al terminar cada vídeo de una lista, iniciar el siguiente sin pulsar Reproducir de nuevo; conservar Pausa y la navegación manual y evitar saltos automáticos al final, al cancelar o tras un error.
- [ ] Validar fechas de canales, traducción y retorno; incorporar solo faltantes y commit.

### Tarea 6. Incorporación selectiva Mi Música
**Archivos:** NativeMyMusic.swift, NativeMusicPlayer.swift, recursos, entrada de navegación, pruebas.
- [ ] Identificar diferencias funcionales entre commit 500157 y feature/mi-musica.
- [ ] Probar importación, biblioteca, listas, carpetas inteligentes y respaldo/restauración.
- [ ] Integrar solamente componentes necesarios, sin reemplazar pantallas de TifloLector.
- [ ] Ejecutar pruebas de regresión y commit.

### Tarea 7. Validación y candidata
- [ ] Ejecutar suite iOS Node completa y revisar errores.
- [ ] Ejecutar compilación SwiftUI y controles de firma mediante CI de compilación, sin upload.
- [ ] Documentar SHA, versiones, pruebas y pendientes físicos.
- [ ] Presentar candidata a Tony para autorización separada de envío a grupo interno TestFlight.
