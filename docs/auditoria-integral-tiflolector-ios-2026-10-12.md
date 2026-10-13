# Auditoría integral TifloLector iOS — 12 de octubre de 2026

Estado: **NO APTO PARA PUBLICACIÓN**. Incidencia principal: #170. Esta auditoría separa la existencia de código, las pruebas estáticas/CI, las pruebas en iOS y el procesamiento posterior de Apple. No confundirlas.

## Resumen ejecutivo: fallo raíz

Hay **dos implementaciones distintas** de TifloLector:
1. **Ruta publicada en iOS:** `.github/workflows/ios-testflight.yml` ejecuta `ios-build/prepare-web.mjs`, copia `index.html` + `web-reading.js` del raíz a `ios-build/www` y lo empaqueta con Capacitor. Los parches `ios-build/patch-reading-native.mjs`, `ios-parity.js` y `ios-reader-selects.js` agregan comportamientos iOS.
2. **Implementación funcional avanzada del proyecto móvil:** `mobile/src/screens/reading-library.mjs`, `reading-book.mjs`, `reading-audio.mjs`, y controladores en `mobile/src/core`, `mobile/src/native`, con adaptadores de `shared/`. No es la ruta que se publica hoy en iOS. Sus plug-ins nativos de almacenamiento, DAISY, audio y acciones sobre documentos son predominantemente Android.

La build iOS **300071** empaquetó la ruta web. Pasar los comprobadores anteriores de cadenas/etiquetas no certificó equivalencia con el lector avanzado. Apple procesó esa build; no es la causa de la regresión. No publicar una nueva IPA por cambiar únicamente textos, aspecto o una validación superficial.

## Inventario por funcionalidad (evidencia y pendiente)

| Área | Observación verificable en el código iOS actual | Estado de aceptación |
| --- | --- | --- |
| Fuente canónica / identidad | iOS sigue empaquetando `web-reading.js`; existe un módulo de lectura distinto en `mobile/src`. | **Bloqueado**. Elegir arquitectura final, portar o unificar y evitar que el empaquetador rescate la vista anterior. |
| Importar TXT/HTML/RTF/Markdown/FB2 | `web-reading.js:documentFromFile` declara adaptadores y rutas. | Implementación visible; pruebas de importación en iPhone aún **pendientes**. |
| PDF con texto | Usa pdf.js cargado en tiempo de uso y reconoce falta de texto. | Ruta presente; comprobar PDF con/sin texto, contraseñas, cambios de página y audio en iPhone. |
| DOCX/PPTX/XLSX/EPUB/ODT | Usa `JSZip` desde CDN para abrir el contenedor y adaptadores de `shared/`; guarda el original en la base local como cadena de bytes. | Ruta presente; compatibilidad real y uso sin conexión **pendientes**. |
| DAISY 2.02 y DAISY 3 ZIP | El lector web iOS no reconoce ZIP DAISY en `documentFromFile` ni procesa sus NCX/NCC/SMIL. La implementación Android es distinta. | **Bloqueado**. Añadir importación, extracción local, navegación estructural, audio y sincronización cuando corresponda. |
| Audiolibro MP3 | `useMp3File` detecta `.mp3`/`audio/mpeg` y crea un elemento Audio; el propio lector avisa de que **no se guardan** en la biblioteca. M4A/multipistas y reproducción en segundo plano no están demostradas. | **Parcial**; verificar importador nativo, decodificación, reproducción, conservación, controles y persistencia. |
| Biblioteca: acciones visibles | El código creaba `detailsToggle` + `details`, pero `card.append(title)` descartaba ambos: los ajustes y Eliminar eran inaccesibles. Corregido en commit `678344e` con apertura/cierre/foco, y estimación bajo demanda. | **Código corregido, test estático aprobado; falta prueba real en iPhone**. |
| Acciones VoiceOver arriba/abajo sobre títulos | `ios-reader-selects.js` cambia controles ordenados por deslizadores. **No equivale a** acciones `UIAccessibilityCustomAction` por título. `TifloReadingAccessibility.setDocumentActions` solo se invoca desde módulo móvil no empaquetado. | **Bloqueado**. Necesario plugin iOS real, título asociado, foco/rotor y fallback de botones. |
| Reproducir/Pausa | `web-reading.js:updatePlaybackLabel` actualiza una misma instancia `reading-play` y sus atributos. | Código presente; comportamiento de TTS/MP3, estado VoiceOver y pausas deben probarse. |
| Porcentaje y tiempo | `wholeBookPercent` pondera palabras de todo el documento; `renderPosition` estima tiempos mediante palabras/minuto. MP3 usa duración del archivo. | Parcial; falta validar avance efectivo y salvar/restaurar posición tras pausas, cambio de bloque y traducción. |
| Ajustes Audio/Visual/General | `index.html` agrupa en `reading-settings-disclosure` inicialmente cerrado. Documentos tienen subajustes dinámicos. | Código presente; evitar duplicaciones entre vista web y `ios-parity.js`, verificar foco y cambios durante TTS. |
| Voces del iPhone | Plugin Swift `TifloReadingTtsPlugin` con `AVSpeechSynthesisVoice.speechVoices()`; puente `ios-reader-native.js` y parche en `patch-reading-native.mjs`. | Código de puente presente; validar lista real de voces, elección, continuidad y no regresión a «voces del navegador». |
| Traducción nativa | Plugin `TifloReadingLanguagePlugin.swift` utiliza Translation de Apple (iOS 18+); hay original/traducción, preparación de pareja y lectura traducida. | Comprobar que el resultado se presenta, foco y estados de idiomas/modelos; iOS 15–17 carece de ese servicio. |
| OCR | Usa pdf.js/Tesseract descargado de CDN, disparado tras PDF sin texto o imagen. | Pendiente prueba de permisos, sin conexión, archivos grandes, lectura resultante y avisos correctos. |
| Cola, marcas y buscar | `web-reading.js` tiene cola, marcadores, búsqueda y ordenación, pero falta equivalencia móvil y pruebas cruzadas. | Parcial. |
| Persistencia y migración | Biblioteca web usa `tifloacosta-reading-web` en IndexedDB; la biblioteca móvil usa otro contrato/backend. | **Bloqueado** para cambio de lector: preservar datos existentes sin desinstalar ni sobrescribir almacenamiento. Comprobar migración y copias. |
| Navegación estructural | Vista web tiene bloque/párrafo/frase. El lector móvil cuenta con más unidades semánticas, DAISY y navegación audio. | **Bloqueado** para paridad completa. |
| Idioma, foco y retorno | Varias capas `index.html`, `ios-parity.js`, `ios-reader-selects.js` y parche nativo afectan VoiceOver. | Requiere pruebas de navegación real, volver al botón origen y lectura durante reproducción. |
| Guía del lector y configuración | Hay menús/configuración pero no evidencia de guía íntegra para todas las funciones; revisar instrucciones y accesibilidad. | Pendiente revisión UX/lectores de pantalla. |

## Correcciones comprobables realizadas durante esta auditoría

1. **Suspender despliegues automáticos:** `.github/workflows/ios-testflight.yml` deja de lanzarse con cada push; solo se puede ejecutar expresamente. Esto impide subir por accidente versiones intermedias. Commit `579a1a0`.
2. **Restituir el panel de biblioteca realmente visible:** `web-reading.js` conecta `detailsToggle`, `details`, `aria-controls`, estado expandido, retorno de foco y estimación de tiempo. Commit `678344e`.
3. **Añadir pruebas de regresión estáticas:** `ios-build/test/tiflolector-structure.test.mjs` y ejecución separada `tiflolector-static-audit` en `.github/workflows/ios-check.yml`. No prueban un iPhone real, por lo que no autorizan entrega.
4. **Seguir bloqueando las compilaciones incompletas:** `ios-build/prepare-web.mjs` impide continuar cuando DAISY/acciones nativas faltan. **Importante:** el control actual comprueba señales de implementación, NO funcionalidad real, y debe completarse con tests y evidencias, no saltarse creando archivos vacíos.

## Hallazgos adicionales de pruebas y ramas no fusionadas

- **Biblioteca: prueba antigua invertida.** `test/web-reading-library.test.mjs` exigía expresamente `card.append(title)` y prohibía `card.append(title, detailsToggle, details)`. Esa expectativa ocultaba el fallo. Reescrita para exigir los controles visibles.
- **Caché desincronizada:** `index.html` solicitaba `web-reading.js?v=3.15`, pero `sw.js` conservaba la versión `3.12` e incluso forzaba `v=3.8` en peticiones. También `app.js` aparecía en versión vieja. Corregido en `sw.js` y pruebas asociadas; ello evita regresiones de caché en la web, aunque **no demuestra** por sí solo la causa de la regresión nativa TestFlight.
- **Borrado sin confirmación:** `deleteSavedBook` borraba inmediatamente. Añadida confirmación explícita, con cancelación segura cuando no exista diálogo.
- **Resultado CI tras reparar pruebas caducadas:** 5 comprobaciones estáticas nuevas más 32 pruebas existentes del lector web, con resultado correcto en el trabajo independiente `tiflolector-static-audit`. La tarea separada de empaquetado iOS **sigue fallando intencionadamente** en `prepare-web.mjs` por faltar DAISY y acciones nativas; no se ha producido una compilación apta.
- **Ramas con trabajo no consolidado:** `feat/ios-tiflolector-library-first-20261012`, `feat/ios-tiflolector-compact-library-20261012` y `feat/guia-accesible-tiflolector-20261012` contienen trabajo potencialmente útil (guía y biblioteca más directa) no presente íntegramente en `preparacion-ios`. No fusionar a ciegas porque la rama de biblioteca compacta también conserva partes viejas de la interfaz. Comparar funcionalidad y migrar conscientemente cada cambio.
- **Diferencia de modelos de datos:** la base web en IndexedDB no equivale al almacenamiento nativo Android. La actualización de TestFlight no debe borrar datos y el cambio de arquitectura exigirá una migración probada.

## Conciliación de las nueve mejoras pendientes acordadas

Esta lista procede de los acuerdos con el usuario del 12/10 y debe preservarse **por completo**; no basta con registrar las incidencias recientes.

| N.º | Mejora pendiente | Comprobación de la ruta publicada en iOS / obligación |
| --- | --- | --- |
| 1 | **Acciones mediante gestos arriba/abajo de VoiceOver sobre cada título** | No existe plugin nativo en iOS para `UIAccessibilityCustomAction` por documento. **Bloqueado**. El botón convencional de acciones es un respaldo, no sustitución. |
| 2 | **Diccionario de pronunciación** (sustituciones específicas de palabras) | No aparece controlador de diccionario pronunciación en `web-reading.js` ni `ios-reader-native.js`. **Sin implementar** en iOS. Definir alcance por idioma/documento, guardar entradas y aplicarlas sin modificar el original. |
| 3 | **Navegación por capítulos y encabezamientos** además de frase/párrafo, y niveles DAISY | Lector web se limita a bloque/párrafo/frase; el móvil usa navegación semántica más amplia. **Sin paridad**. |
| 4 | **Seguimiento visual durante la lectura** (identificar el texto actual) | No se ha localizado resaltado automático sincronizado con TTS dentro del lector web. **Sin implementar**; debe ser opcional y no mover el foco de VoiceOver. |
| 5 | **Buscar y filtrar Mi biblioteca** | Existe búsqueda dentro del documento; la biblioteca web solo muestra hasta 100 libros recientes y no ofrece filtros en `preparacion-ios`. El desarrollo `feat/ios-tiflolector-library-first-20261012` tiene filtros y biblioteca visible, pero no está integrado en la ruta actual. **Pendiente de portar y probar**. |
| 6 | **Resaltados y notas asociadas a fragmentos** | Hay marcadores/etiquetas, pero no se ha verificado edición de notas ni resaltado libre con retorno a texto. **Pendiente**. |
| 7 | **Renombrar documentos** | `shared/web-reading-library-adapter.mjs` ya tenía `updateBookMetadata` y la pantalla móvil formulario; faltaba opción visible en iOS. **Implementada en la interfaz web de la rama iOS** (commits `bc17df5`, `9e926bc`), pendiente prueba real de conservación del foco y de metadatos. |
| 8 | **Traducción persistente, recuperable y exportable** | Traducción nativa con resultado original/traducción y almacenamiento derivado cuando el libro está guardado; `exportSavedBook` exporta el original, no una variante traducida elegida. **Parcial**, falta recorrer guardado, reapertura y exportación explícita de la traducción. |
| 9 | **OCR fiable, accesible y verificable** para PDF/imágenes | Existen rutas pdf.js/Tesseract de uso bajo demanda; dependen de librerías externas y no hay aceptación de casos reales con VoiceOver ni desconexión. **Parcial**. |

### Otras decisiones previas que no deben perderse

- Pantalla inicial de TifloLector: **Importar documento o imagen**, Ajustes de lectura **cerrados** con Audio y voz / Presentación visual / General y formatos dentro de General, **Mi biblioteca visible** con **Todos los documentos** preseleccionado y **Marcadores al final**. Evitar pegar texto y botones redundantes de regresar al inicio. La rama iOS actual **todavía no cumple por entero este orden**.
- Un solo botón cambiante **Reproducir/Pausa**. No copiar el HTML de la rama `feat/ios-tiflolector-library-first-20261012` sin revisión: contiene **dos botones distintos** en su versión antigua.
- Acceso a voces del **iPhone** y traducción **nativa**; controles ajustables accesibles durante TTS, conservar foco y progreso global.
- DAISY comprimido 2.02/3 con niveles, encabezamientos, capítulos/páginas/SMIL y audio; archivos MP3/M4A y multipistas con estructura y tiempos, sin prometer soporte no probado.
- **Guía accesible de uso** con capítulos desplegables, en la portada antes de las secciones. Existen ramas con guías de 16 capítulos, pero no se ha integrado su versión final de forma verificada en `preparacion-ios`.
- Conservar biblioteca y datos al actualizar y preservar las mejoras existentes de Novedades, TifloReproductor, Recursos y navegación general; **no fusionar archivos completos de otras ramas sin auditoría de compatibilidad**.

## Mejoras de interfaz recuperadas y validadas a nivel de código durante la auditoría

- **Mi biblioteca en la pantalla inicial de TifloLector:** la antigua vista `reading-library-web` ya no está escondida en un submenú. Se presenta después de ajustes generales cerrados. Commit `5d82738`. Esto preserva la ruta MP3 y el botón único reproducir/pausa, a diferencia del HTML antiguo de la rama de biblioteca.
- **Buscar y filtrar la biblioteca:** `reading-library-filter` ofrece Todos por defecto, recientes, en lectura, sin leer, leídos y cola, y `reading-library-query` filtra título o autor. `web-reading.js:renderLibrary()` usa `listBooks({query,status,sort})` o `listQueue()`. Commit `52ed74b`. La limitación a 100 resultados aún debe sustituirse por paginación antes de considerar óptima la biblioteca.
- **Volver del libro al título correcto:** al salir del lector, la ruta de retorno busca el mismo título por un ID estable; evita abrir una vista de biblioteca oculta. Commit `52ed74b`.
- **Guía de uso accesible:** rescatada la guía ES/EN con capítulos plegables en `tifloacosta-guide.js`, enlace de portada antes del menú de secciones y vista interna `#guide`; se diferencia expresamente las acciones convencionales de las nativas pendientes. Se incorporó a caché offline. Commits `d41a0b6`, `ce7559c`, `82127f1`.
- **Más comprobaciones** en `ios-build/test/tiflolector-structure.test.mjs` contra retrocesos de biblioteca, guía y borrado sin confirmación. Trabajo `tiflolector-static-audit` independiente del empaquetado bloqueado; ampliado a 8 pruebas estructurales más 32 web. **Estos tests no equivalen a validación con VoiceOver en un iPhone.**

Estos cambios se han efectuado en la rama de preparación de iOS, **sin habilitar su publicación**. Mantener abiertos los criterios críticos DAISY, audio persistente, rotor, diccionario, navegación avanzada, resaltado, exportación traducida, OCR en entorno real y preservación de datos.

## Plan de ejecución, orden obligatorio

1. **Unificar el producto:** fijar como contrato funcional el lector avanzado de `mobile/src`. Decidir cómo llevarlo a iOS sin depender de los plugins Android. No confundir frontend avanzado con funcionalidad nativa instalada.
2. **Preservar datos:** diseñar migración comprobable desde la base web `tifloacosta-reading-web` (con reversión/copia) si se cambia el motor de biblioteca; no borrar la app de pruebas.
3. **Habilitar importaciones:** TXT, HTML, EPUB, PDF, Office, OCR, MP3/M4A y ZIP DAISY 2/3 con pruebas de archivo válido, roto, con audio/texto, desconexión, libros largos y errores.
4. **Completar reproducción/audio:** reproducir/pausar único, voces nativas, posición del libro completo, marcas, velocidad, temporizador, capítulos/niveles disponibles, interrupciones, fondo y reanudación.
5. **Completar VoiceOver nativo:** acciones de título arriba/abajo realmente disponibles con foco VoiceOver, controles ajustables separados, menús plegados y retorno correcto al documento/sección.
6. **Revisar traducción, OCR, biblioteca, cola, búsqueda, eliminación, exportación, accesibilidad, idiomas, ayudas y estilos.**
7. **Automatizar pruebas no destructivas** con muestras, render DOM y compilación de simulador; confirmar fuente en IPA mediante hash/componente identificable. Hacer prueba funcional con VoiceOver en iPhone.
8. **Solo entonces habilitar distribución manual**, enviar la IPA y consultar App Store Connect hasta `VALID`, beta interna habilitada y grupo `Probadores TifloAcosta`. Informar disponibilidad únicamente tras esa verificación.

## Criterio de terminado

No se considera terminada la auditoría ni apta la entrega mientras haya bloqueos anteriores. **No existe una compilación que haya superado todos esos criterios en esta fecha.** El éxito de GitHub Actions, la compilación Xcode, el envío IPA o la confirmación de Apple por sí solos no demuestran que el lector final esté corregido.


## Continuación 13/10/2026 — restitución de funciones de TifloLector

### Cambios implementados en la ruta que se empaqueta para iOS (rama `preparacion-ios`)

| Función perdida | Evidencia actual | Qué falta |
| --- | --- | --- |
| Navegación por elementos semánticos | `shared/web-reading-navigation.mjs` recupera saltos anteriores/siguientes por **encabezado**, **encabezado principal nivel 1–2**, **párrafo**, **lista**, **cita** y **celda de tabla**; se conecta desde `web-reading.js` y `shared/web-entry.mjs`. `ios-parity.js` conserva esos valores como preferencias de documento. Pruebas funcionales de navegación bidireccional en Node. | No es navegación DAISY por capítulos/niveles SMIL; exige adaptación y pruebas iPhone. |
| Unidad predeterminada para documentos nuevos | Los modos adicionales están en `index.html` y `restoreWebSettings()`. Se mantiene la selección por documento. | Validar reajuste de controles VoiceOver y persistencia en el iPhone. |
| Mi biblioteca con muchos libros | Paginación de 30 títulos, páginas anterior/siguiente, estado «Página X de Y», filtros y búsqueda, cola paginada. El número de búsqueda protege frente a respuestas antiguas. | Verificar paginación con 31+ libros, foco y lector de pantalla real. |
| Tipos de marca | Recuperados **Marcador, Importante, Revisar después y Cita**, que ya existían en `reading-library-client.mjs` y la base local. Se puede guardar en la posición del libro y recuperar el punto desde el apartado Marcadores, con anuncio de estado. | Aún no hay subrayado de texto seleccionado ni notas libres vinculadas al fragmento. |
| MP3: navegación y controles | `web-reading.js` vuelve a mostrar los botones **retroceder/adelantar 10 segundos** al abrir MP3 y oculta controles exclusivos de textos; restaura los ajustes del lector cuando se abre un libro. Conserva etiquetas de salto al cambiar idioma. | El MP3 sigue sin guardarse en la biblioteca. Audios largos, interrupciones, controles del sistema, background y M4A deben probarse en el iPhone. |

Se añadieron `test/web-reading-navigation.test.mjs` y `test/web-reading-restored-features.test.mjs`, que se ejecutan con las demás pruebas de lector web. `ios-check.yml` también comprueba sintaxis de `web-reading.js`, `ios-parity.js`, módulo de navegación y guía. La tarea `tiflolector-static-audit` completó satisfactoriamente las comprobaciones en los últimos cambios. La tarea `ios-unsigned-build` **debe fallar** en «Preparar contenido web» porque continúa activo el bloqueo preventivo por DAISY ZIP y rotor nativo de VoiceOver. Esto **NO ES** un fallo que se deba solucionar retirando el bloqueo.

### Próximas prioridades que siguen abiertas

1. **DAISY 2.02/3 ZIP completo** (NCC/NCX/SMIL y audio): sin esto no hay paridad del lector móvil en iOS.
2. **Acciones de VoiceOver reales sobre los títulos** (rotor/deslizamientos, no sustituidas por el selector ajustable).
3. **Audiolibros persistentes** (MP3, M4A, multipista) y reanudación tras cerrar la app.
4. **Diccionario de pronunciación, seguimiento/resaltado opcional y notas editables** vinculadas a fragmentos.
5. **Traducción guardada, reabrible y exportable**, OCR y lectura PDF en pruebas reales.
6. **Migración segura de datos y origen único del lector**, prueba no destructiva en iPhone y comprobación de componentes dentro de IPA antes de autorizar envío.

**Política de distribución:** no habilitar el workflow automático. No crear nueva compilación ni comunicar disponibilidad hasta cerrar los criterios de aceptación y comprobar Apple/TestFlight de extremo a extremo.


### Cierre de protección del paquete iOS — 13/10/2026

Se reforzó `ios-build/prepare-web.mjs`: además de rechazar el formulario viejo, ahora exige los controles de filtro, búsqueda y paginación, tipos de marca, selector de encabezado principal, botón único de reproducir, navegación semántica, controles MP3 en modo audio y guía accesible. Verifica expresamente que **no** haya un segundo botón de Pausa, que la biblioteca incluya su menú de acciones y que el módulo de navegación esté físicamente dentro de `ios-build/www`. Suprimir cualquiera de estas señales aborta el empaquetado.

La barrera DAISY ZIP + plugin Swift de acciones nativas VoiceOver **permanece intacta**, por lo que este endurecimiento **no autoriza una compilación de TestFlight**. Se agregó prueba de regresión del guardián y comprobación sintáctica de `prepare-web.mjs` en el CI sin publicar.
