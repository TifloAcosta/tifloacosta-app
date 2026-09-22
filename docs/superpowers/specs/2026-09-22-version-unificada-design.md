# Diseño de la versión unificada de TifloAcosta

Fecha: 2026-09-22
Estado: aprobado en conversación
Rama: `feature/compartir-con-tifloacosta`

## Objetivo

Preparar una única nueva versión de TifloAcosta que consolide la nueva función Compartir con TifloAcosta, el lector limpio común, las correcciones detectadas en la beta Android y las diferencias de bajo riesgo que conviene unificar con la web/PWA.

La publicación en Google Play y la integración en `main` quedan fuera de este paso: primero se implementa, prueba y compila en la rama aislada.

## 1. Un solo lector limpio

Existirá un único motor de lectura limpia reutilizado por:

- Actualidad: activar el título de una noticia abre su contenido limpio dentro de TifloAcosta.
- Buscar: activar un resultado de noticia abre esa noticia concreta en el lector limpio.
- Compartir con TifloAcosta: una página web compartida usa el mismo lector.

El lector conserva encabezados, párrafos, listas y enlaces útiles, elimina ruido y contenido remoto ejecutable y mantiene la navegación y el foco según el origen. La fuente original se conserva como alternativa, no como vía principal de lectura.

## 2. Una sola búsqueda global

La aplicación tendrá una única zona de búsqueda: Buscar.

- No se añadirá un buscador específico dentro de Vídeos en Android.
- El buscador específico de `videos.html` se retira de la web/PWA.
- Ordenar vídeos por fecha puede mantenerse porque no constituye otra búsqueda.
- La búsqueda global conserva la identidad del resultado hasta abrirlo.
- Vídeo -> abre el vídeo concreto.
- Documento -> abre el documento concreto.
- Noticia -> abre la noticia concreta en lector limpio.
- Si Actualidad incorpora Apps accesibles o Escuchar y ver, esos contenidos también se indexan en Buscar y se abre el elemento concreto.

## 3. Navegación de Vídeos en dos niveles

La pantalla Vídeos distingue claramente dos acciones:

1. `Volver a la pantalla principal`: abandona la sección Vídeos.
2. `Cerrar vídeo y volver a la lista de vídeos`: abandona solo la reproducción actual.

Mientras haya un vídeo abierto:

- el botón Cerrar pausa la reproducción, oculta el reproductor y devuelve el foco al vídeo concreto en la lista;
- el botón/gesto Atrás de Android hace primero exactamente lo mismo;
- solo un Atrás posterior, ya desde la lista, abandona Vídeos hacia Inicio.

Si el vídeo se abrió desde Buscar, al cerrar el reproductor se permanece en la lista de Vídeos y el foco queda en ese vídeo.

## 4. Correcciones de beta integradas

Se incorporan en esta misma entrega, no como versión separada:

- títulos de Actualidad activables mediante el lector limpio;
- resultados de Buscar que abren el elemento exacto en lugar de limitarse a la sección;
- vídeo, documento y noticia cubiertos por la misma regla de identidad;
- navegación de reproductor corregida como se describe arriba.

## 5. Identidad visual unificada

Web/PWA y Android adoptan la misma familia de rojo TifloAcosta, menos saturada y menos agresiva que la actual.

Requisitos:

- definir la paleta mediante variables/tokens centralizados;
- mantener contraste suficiente con texto blanco y fondos correspondientes;
- no degradar modo de alto contraste ni indicadores de foco;
- actualizar el color de tema PWA para coincidir con la nueva identidad;
- verificar contraste de forma automatizada cuando sea posible.

## 6. Paridad funcional de bajo riesgo

Antes de cerrar la entrega se auditan e integran, cuando puedan reutilizar la arquitectura existente sin abrir subsistemas nuevos:

- Actualidad: Noticias, Apps accesibles y Escuchar y ver, con filtros útiles equivalentes cuando los datos ya existan en el repositorio;
- Biblioteca: Novedades/categorías cuando los metadatos actuales permitan hacerlo sin inventar clasificación;
- Vídeos: ordenación del catálogo, sin buscador local;
- información, privacidad, accesibilidad y contacto: trasladar a Android los contenidos estáticos relevantes que ya mantiene la web;
- Mi libro: alinear información y presentación accesible y evitar enlaces regionales rígidos cuando exista una alternativa neutra/idiomática.

Si una diferencia de paridad requiere un nuevo backend, autenticación, migración de datos o decisión de producto no aprobada, se documenta y se aplaza en vez de improvisarla.

## 7. Elementos expresamente fuera de esta entrega

- Notificaciones nativas Android: requieren un trabajo de integración más profundo y quedan para una tarea posterior.
- Acciones autenticadas de YouTube dependientes de la verificación OAuth de Google.
- Cambios que imiten mecanismos exclusivos de PWA como instalar aplicación, service worker o buscar actualizaciones desde la propia web.
- Publicación en Google Play hasta autorización explícita.

## 8. Accesibilidad

La entrega debe conservar o mejorar:

- encabezados semánticos;
- nombres de botones inequívocos;
- foco restaurado al elemento de origen;
- estados dinámicos anunciados sin duplicaciones;
- listas y enlaces navegables por lector de pantalla;
- ausencia de reproducción o descarga automática.

La comprobación manual final debe hacerse con el lector de pantalla que utilice cada probador, no únicamente TalkBack; cuando sea posible se comparará TalkBack con Jieshuo, AccessiMind u otros lectores disponibles.

## 9. Criterio de salida

La versión no se considerará preparada para integración hasta que:

- las pruebas de regresión nuevas fallen antes de cada corrección relevante y pasen después;
- pase la suite completa de la web y del móvil;
- Android sincronice y compile correctamente en GitHub Actions;
- exista un artefacto de validación nuevo generado desde el commit final;
- se hayan revisado los cambios para detectar regresiones y restos de implementaciones duplicadas;
- las pruebas manuales pendientes queden claramente enumeradas para los probadores.

El nombre comercial de la versión y el `versionCode` definitivo se fijarán justo antes de preparar el lanzamiento, sin reutilizar un código ya subido a Google Play.