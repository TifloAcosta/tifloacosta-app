# Plan de implementación de la versión unificada

**Objetivo:** entregar en una sola rama y una sola futura versión Compartir con TifloAcosta, lector limpio común, correcciones de búsqueda/Actualidad/Vídeos, búsqueda única, paleta visual suavizada y paridad de bajo riesgo entre web/PWA y Android.

**Estrategia:** ejecutar por lotes pequeños con TDD. Cada lote comienza con regresiones que demuestran el comportamiento ausente y termina con las pruebas relacionadas en verde. No se publica ni integra en `main` durante la ejecución.

## Lote 1 — Lector limpio común

Archivos principales:
- `mobile/src/core/reader-service.mjs`
- `mobile/src/screens/reader.mjs`
- `mobile/src/app.mjs`
- `mobile/src/screens/share.mjs`
- `mobile/src/screens/actualidad.mjs`
- pruebas de reader/share/actualidad

Pasos:
1. Crear pruebas rojas para autoridad de petición, origen y render seguro.
2. Implementar servicio y pantalla comunes.
3. Enrutar Compartir web por el lector común.
4. Enrutar títulos de Actualidad por el mismo lector.
5. Comprobar foco y Volver por origen.

## Lote 2 — Buscar abre el resultado exacto

Archivos principales:
- `mobile/src/core/search.mjs`
- `mobile/src/screens/search.mjs`
- `mobile/src/app.mjs`
- `mobile/src/screens/videos.mjs`
- `mobile/src/screens/library.mjs`
- pruebas de búsqueda y destinos

Pasos:
1. Añadir pruebas rojas para vídeo, recurso, noticia y cualquier tipo adicional de Actualidad.
2. Conservar identidad y acción del resultado en el modelo de búsqueda.
3. Vídeo: abrir el elemento exacto en el reproductor de Vídeos.
4. Recurso: abrir el recurso exacto mediante la acción apropiada.
5. Noticia: abrirla en lector limpio.
6. Restaurar foco al resultado cuando corresponda.

## Lote 3 — Navegación de Vídeos en dos niveles

Archivos principales:
- `mobile/src/screens/videos.mjs`
- `mobile/src/screens/video-player.mjs`
- `mobile/src/app.mjs`
- `mobile/src/core/native-actions.mjs`
- i18n y pruebas de vídeos/back

Pasos:
1. Pruebas rojas: encabezado con `Volver a la pantalla principal`, cierre de reproductor vuelve al vídeo, Atrás de Android cierra primero reproductor.
2. Exponer estado/cierre del reproductor de forma controlada.
3. Registrar un manejador de Back de pantalla para Vídeos sin interferir con Compartir.
4. Verificar que un segundo Back desde la lista vuelve a Inicio.

## Lote 4 — Búsqueda única

Archivos principales:
- `videos.html`
- `videos.js` / `videos-core.js` según corresponda
- pruebas web de vídeos

Pasos:
1. Prueba roja que exija ausencia del buscador local y conservación de ordenación/paginación.
2. Retirar formulario Buscar/Limpiar de Vídeos web.
3. Eliminar referencias JS obsoletas sin romper ordenación ni paginación.
4. No añadir buscador local en Android.

## Lote 5 — Actualidad completa y búsqueda global

Archivos principales:
- `scripts/build-mobile-content.mjs`
- `actualidad.json`
- `actualidad-apps.json`
- `actualidad-media.json`
- `mobile/src/core/content-store.mjs`
- `mobile/src/core/search.mjs`
- `mobile/src/screens/actualidad.mjs`
- pruebas de contenido/búsqueda/Actualidad

Pasos:
1. Confirmar esquemas existentes de Apps accesibles y Escuchar y ver.
2. Pruebas rojas para que el contenido móvil incluya esas colecciones y Buscar las indexe.
3. Extender `mobile-content.json` y almacenamiento sin romper compatibilidad de caché.
4. Presentar tipos/secciones/filtros únicamente usando metadatos existentes.
5. Abrir cada resultado concreto mediante su acción correcta.

## Lote 6 — Paridad de bajo riesgo

Revisar Biblioteca, Vídeos, Contacto/privacidad/accesibilidad y Libro.

Pasos:
1. Añadir solo pruebas de diferencias concretas confirmadas en los datos/código.
2. Biblioteca: incorporar novedades/categorías solo si ya existen metadatos fiables.
3. Vídeos: añadir ordenación, no búsqueda.
4. Contenido estático: alinear información/contacto/accesibilidad sin duplicar texto innecesariamente.
5. Libro: corregir enlace regional rígido si existe destino neutro o dependiente de idioma ya definido.
6. Documentar cualquier diferencia aplazada por requerir backend/autenticación/decisión nueva.

## Lote 7 — Paleta roja unificada y suavizada

Archivos principales:
- `styles.css`
- `manifest.webmanifest`
- `mobile/src/styles.css`
- pruebas de tema/estilos

Pasos:
1. Definir una familia rojo teja/granate menos saturada.
2. Añadir prueba de tokens y contraste mínimo WCAG para combinaciones usadas con texto.
3. Aplicar los mismos tokens conceptuales en web y móvil.
4. Actualizar `theme_color` de PWA.
5. Verificar que alto contraste y foco no se alteran.

## Lote 8 — Limpieza, regresión y compilación Android

1. Retirar rutas/funciones duplicadas del lector antiguo que ya no tengan consumidores.
2. Ejecutar toda la suite móvil y web.
3. Ejecutar build del móvil y sincronización Android.
4. Ejecutar workflow Android completo y comprobar Gradle.
5. Realizar revisión final del diff.
6. Corregir cualquier hallazgo con prueba roja antes de la solución.
7. Generar un artefacto nuevo de validación desde el commit final.

## Lote 9 — Preparación del lanzamiento, sin publicarlo

1. Confirmar el próximo `versionCode` disponible en Play antes de modificarlo.
2. Pedir a Tony decisión final de versión comercial si sigue pendiente (1.0.4 frente a 1.1.0; por alcance de función nueva, 1.1.0 es la opción semántica natural, pero no se fija sin decisión).
3. Construir AAB con esa versión y comprobar que está preparado para el canal cerrado.
4. Entregar lista de pruebas manuales para probadores con distintos lectores de pantalla.
5. No subir a Google Play ni fusionar a `main` sin autorización explícita.