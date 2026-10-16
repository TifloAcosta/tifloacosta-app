# Auditoría estructural iOS — 16 de octubre de 2026

Estado: **diagnóstico confirmado parcialmente; corrección funcional todavía no validada.** Esta rama es de trabajo, NO se debe mezclar ni publicar automáticamente como reparación.

## Evidencias comprobadas

- Capturas de las 19:37–19:38, IMG_0997.PNG y IMG_0998.PNG: TifloLector presenta `Recibidos por Compartir: 2` con dos botones `Importar Contenido.epub`. La portada presenta `Recibidos por Compartir: 4`: dos EPUB y dos accesos a vídeos compartidos. Por ello **App Group -> bandeja de pendientes sí funciona**, al menos para listar manifiestos; **no demuestra importación persistente**. Identidades UUID distintas pueden representar dos envíos del mismo nombre, y NO deben fusionarse o borrarse automáticamente.
- La portada presenta títulos/botones excesivamente altos y recortados, y el buscador se superpone con la hora del dispositivo. Es un fallo real de presentación, no de narración de VoiceOver.
- Rama realmente empaquetada: `preparacion-ios`, `ios-build/prepare-web.mjs`, `index.html`, `web-reading.js` y adaptaciones `ios-build`; **no** inferir el comportamiento de la app iOS a partir de `mobile/src`.
- Último commit investigado: `36499366c68fb76fff8dfbe26ec8bf4ec3c2f726`, build de la ejecución TestFlight número 97; GitHub Actions finalizó con éxito y confirmó disponibilidad Apple. Eso NO demuestra que las funciones estén correctas en el dispositivo.

## Causa de la asimetría de acciones VoiceOver

1. Vídeos utiliza `TifloNativeVideosController.swift`, celdas `UITableViewCell` y `accessibilityCustomActions` asociadas a cada celda. Es coherente con que el usuario obtenga acciones arriba/abajo.
2. La biblioteca TifloLector es HTML en WKWebView. `ios-reader-native.js` llama `registerLibraryTitles(..., nativeRowsOnFocus: false)`. `TifloReadingAccessibilityPlugin.swift` trata de deducir qué elemento web tiene el foco comparando cadenas de `accessibilityLabel`, adjuntando acciones a ese elemento; si falla o hay etiquetas iguales, no ofrece acciones.
3. `ios-appwide-native-actions.js` tiene `const inlineNativeCollections = true` y retorna antes de `showNativeActionList` para todas las colecciones web. Eso evita los antiguos modales a pantalla completa, pero también elimina el respaldo con controles UIKit reales. **Vídeos tiene un camino nativo independiente**, así que funciona de otro modo.
4. `ios-accessible-actions.js` solo registra vídeos HTML, podcasts, enlaces y recursos; no registra controles `Importar Contenido.epub` de la bandeja. Las acciones de documento se registran únicamente para títulos YA guardados en `#reading-library-list`. No confundir un documento recibido pendiente con un título importado, ni las acciones del rotor con deslizadores de ajuste.
5. Los tests `ios-global-voiceover-actions.test.mjs` y `tiflolector-regresiones-20261014.test.mjs` comprueban expresiones del código, pero **no comprueban que VoiceOver en un iPhone anuncie y ejecute cada acción**. Una compilación Xcode verde no cierra el defecto de accesibilidad.

**Conclusión:** el mecanismo de títulos HTML es insuficientemente verificable, mientras el patrón UIKit de Vídeos es observable. No se debe reactivar sin más el modal de biblioteca ni declarar arreglado el rotor por un cambio de etiqueta o un test estático.

## Causa de Compartir, y diferencia entre recepción/importación

- `ShareViewController.swift` guarda una entrada UUID con manifiesto y bytes en App Group. `TifloShareInboxPlugin.swift` muestra pendientes y solo los elimina después de `acknowledge`.
- `ios-share-inbox.js` muestra los mismos pendientes en portada y TifloLector. Si se pulsa `Importar en TifloLector: ...` desde PORTADA, el manejador solo cambia `location.hash = '#reading'`: **no importa en ese toque**, aunque el texto indique "Importar". Es un defecto funcional de interacción sin necesidad de atribuirlo a Apple.
- El botón dentro de TifloLector sí ejecuta `openItem -> fetch de bytes -> File -> importSharedFile -> comprobación hasSavedBook -> acknowledge`. No hay prueba real aún del eslabón exacto que impide el guardado; no borrar nada prematuramente.
- Los errores se reducen a un aviso genérico, sin fase de origen ni información suficiente para auditoría. El resultado final debe indicar claramente **Pendiente / Importando / Guardado / Error recuperable**.
- El CSS iOS define clases `.ios-share-inbox`, `.ios-share-inbox-items` y `.ios-share-inbox-item`, pero `ios-share-inbox.js` crea estos nodos solo con `id` sin aplicar las clases. Por tanto, las reglas específicas no alcanzan los botones de la bandeja. El resto del desajuste de presentación debe comprobarse por pantalla y tamaño de texto antes de atribuirlo solo a esa omisión.

## Requisitos de una única intervención correctiva coherente

1. **Fuente y estructura:** Una sola implementación iOS elegida y auditada, sin restaurar pantalla antigua, sin modal genérico superpuesto ni duplicar contenido. Secciones intactas: inicio, Novedades, Actualidad, Recursos, TifloLector, Descargas, Favoritos, Podcast y Vídeos.
2. **Acciones de documento fiables:** Para cada libro, el foco debe recaer en un control accesible estable con las acciones asociadas a ESE ID, siguiendo el principio que ya utiliza el controlador nativo de Vídeos. Si se opta por UIKit, que sea una sección real integrada, no una ventana adicional sobre la biblioteca web. El diseño y las preferencias deben permanecer equivalentes. Si el resultado final conserva WKWebView, demostrar físicamente que sus acciones aparecen; no darlo por supuesto.
3. **Controles ajustables:** Separar "rotor Acciones" para un título del ajuste de `input range` (velocidad, filtro, orden, voz, tamaño, porcentaje). Una elección se aplica, persiste y se anuncia con un solo control, sin elementos dobles.
4. **Compartir directo:** EPUB/archivos deben importarse y guardarse al activar una sola vez la acción de portada o TifloLector. Un enlace YouTube debe abrir su reproductor, no la biblioteca. Otros URL deben ir a su destino. Confirmar contenido disponible para lectura antes de eliminar manifiesto. Evitar pérdidas, operaciones duplicadas involuntarias y confundir recibido con guardado.
5. **Maquetación:** Validar zoom, viewport, safe areas de iOS, altura real de controles, tamaños dinámicos, bordes, foco visible y scroll sin superposiciones; aplicar y comprobar estilos en los nodos creados dinámicamente. No retirar texto o botones funcionales para ocultar el fallo.
6. **Datos:** No reinstalar, borrar ni migrar de modo destructivo. Conservar libros, audiolibros, DAISY, marcas, cola, progreso, ajustes y pendientes App Group.
7. **Pruebas:** Pruebas de ejecución de clasificación y flujo de estado, incluyendo error de almacenamiento e importación, idempotencia y persistencia; pruebas de renderizado sobre salida empaquetada (no solo existencia de cadenas) y batería de regresión para todas las secciones. **Prueba final obligatoria en iPhone con VoiceOver**, sobre documento ya guardado y documento compartido; probar subida y bajada con rotor Acciones, doble toque, confirmación de eliminación, cambios de ajustes, salida/retorno, contenidos múltiples.
8. **Publicación:** Solo después de corregir todas las causas verificadas y pasar las puertas anteriores: un único commit de integración a `preparacion-ios`, compilación, verificación de huella SHA, Apple TestFlight válido y asociado al probador, e instalación y aceptación final en dispositivo. No enviar builds con solo ajustes parciales ni dar por arreglado algo que solo supera tests de expresiones regulares.

## Decisión de seguridad de esta auditoría

No hay fundamento para afirmar que este problema carece de reparación: la sección Vídeos demuestra un patrón de acciones nativas viable, pero no basta con copiarlo sobre la interfaz de TifloLector. **Tampoco existe aún prueba para afirmar que una reparación definitiva esté hecha.** Hasta integrar diseño/flujo/pruebas, no publicar otra supuesta corrección.

Rastreo previo: incidencias #167 (rotor) y #170 (fuente canónica y aceptación iOS).