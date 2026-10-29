# TifloLector — fase final, bloque 6 de 7: OCR avanzado (prototipo 0.17)

Esta rama depende de los bloques 1–5. PR en borrador; no hay publicación ni fusión en la app de Google Play.

Se mantienen las carpetas de usuario vacías, cola, DAISY, libros electrónicos y reproducción en segundo plano de 0.16. Las nuevas operaciones se abren desde **Detalles y herramientas de cada documento**, sin controles nuevos en la portada.

## PDF grandes y reanudación

- El importador de PDF trabaja ahora con un archivo original almacenado en disco (hasta **400 MB**). Los documentos de hasta 40 MB que caben en el reconocimiento habitual siguen importándose y reconociéndose automáticamente. PDF más grandes, o con más de 250 páginas, se conservan íntegros para OCR avanzado en lugar de rechazarse.
- **Reconocer PDF por lotes** analiza hasta **4000 páginas**, de una en una, extrayendo primero texto digital de PDFBox. Solo renderiza y aplica ML Kit OCR latino a páginas prácticamente sin texto seleccionable. Evita rasterizar todas las páginas simultáneamente, usa PDFBox con almacenamiento temporal en disco y conserva el original intacto.
- Cada página terminada se guarda en un **archivo de checkpoint privado individual**, junto con el total de páginas. Tras cancelar el trabajo, salir de la pantalla o cerrar el proceso, **Reanudar OCR** omite las páginas completadas. Los archivos temporales a medio escribir no cuentan como páginas terminadas. Cada 10 páginas se conserva también una versión parcial del texto accesible para su lectura. La escritura final sustituye el texto parcial, pero nunca el PDF original.
- El contador de progreso informa de páginas terminadas y total. El OCR es opcional y se inicia con un botón; la copia del original no espera a que termine el OCR.

## Imágenes dentro de documentos

- **Reconocer imágenes incrustadas** disponible para EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS y ODP no protegidos. Inspecciona los recursos de imagen en el ZIP de cada formato sin extraer ni ejecutar macros. Reconoce JPEG/PNG/WebP/BMP aptos mediante ML Kit latino.
- Límite de 600 imágenes por documento, 12 MB por imagen y 150 MB de entradas legibles por operación. Los resultados se añaden al texto extraído con un rótulo, usando como base inalterable el texto anterior al primer proceso; no duplica los párrafos reconocidos al reanudar.
- Las imágenes vacías o decorativas no producen texto inventado. Portadas y miniaturas se omiten. JPG/PNG/HEIC sueltos y PDFs pequeños siguen usando la vía OCR antigua.

## Verificación y limitaciones

Pruebas unitarias: rutas permitidas por formato, rechazo de rutas de ZIP inseguras y SVG, reutilización de checkpoints de páginas ya reconocidas y límites explícitos. La compilación valida dependencias, no la fidelidad del OCR.

**Falta probar en Pixel con TalkBack:** un PDF grande y escaneado de más de 250 páginas, cancelar sobre página 20, salir de la aplicación, regresar y reanudar desde la página 21; comprobar texto parcial, guardado de progreso, desplazamiento de archivos y espacio libre. Repetir con PDF híbrido, EPUB ilustrado, PPTX con imágenes, DOCX y XLSX. Verificar controles de cancelación y Voice/TalkBack; consultar páginas de la obra y no perder marcas o carpetas. Hay que medir batería, tiempo, memoria y comportamiento con Android matando el proceso.

**Limitaciones explícitas:** OCR latino solamente; no interpreta gráficos, tablas, ecuaciones ni orden semántico complejo; no OCR de imágenes OLE dentro de DOC/PPT/XLS antiguos ni de PDFs cifrados; sin ejecución programada cuando la app está cerrada. El OCR se pausa al cerrar la pantalla y se reanuda manualmente. 400 MB/4000 páginas son límites máximos, no una garantía de que todos los documentos terminen en cualquier dispositivo. El texto accesible total sigue acotado a 12 MB. No ofrecer actualización pública antes de validar en un equipo real.

# Fase final de TifloLector — bloque 5 de 7 (biblioteca y carpetas)

Versión de pruebas 0.16-bloque5, basada en 0.15 y separada de Google Play/iOS.

## Carpetas y organización

- En «Filtros» hay **Gestionar carpetas y crear nueva carpeta**, que abre una pantalla con un campo etiquetado «Nombre de nueva carpeta» y un botón real **Crear carpeta**. Las carpetas se guardan en `folders.json` de forma independiente de los libros; una carpeta vacía se conserva al salir y volver a entrar y después de reiniciar la aplicación. Nombres Unicode, límites de longitud y prevención de duplicados insensibles a mayúsculas.
- Mis carpetas muestra el número de obras en cada carpeta y acciones accesibles de renombrar y eliminar; eliminar carpeta requiere confirmación y **no elimina libros**: pasan a Sin carpeta. Renombrar actualiza los libros de esa carpeta.
- La acción «Mover a carpeta» del rotor permite seleccionar una existente o usar **Crear carpeta nueva y mover este libro**; una carpeta sin ningún libro es visible en el filtro de carpetas.
- No crea carpetas físicas arbitrarias en Android ni cambia la estructura de archivos original. Las carpetas son agrupaciones organizativas independientes de las rutas privadas de importación.

## Cola, marcas y progreso

- Dentro de Filtros se ofrecen **Cola de lectura**, **En curso**, **Terminados** y **Gestionar cola de lectura**. Una obra entra o sale de la cola mediante acciones del rotor del título; la pantalla de cola permite abrir, subir, bajar o quitar libros. Se guarda en `reading-queue.json` y conserva el orden, incluso al reiniciar; los IDs de libros eliminados se depuran.
- «Marcas» del rotor abre realmente una pantalla de marcas, para texto y audio, con posición en porcentaje o segmento y segundo, y acceso directo a esa posición. No obliga a desplazarse por todo el documento.
- El rotor añade «Marcar como terminado o pendiente». El filtro En curso identifica títulos con actividad anterior que aún no están terminados. La última lectura queda guardada por el servicio de reproducción y se muestra en Información de la obra.
- La accesibilidad del progreso se expone como descripción de estado del título: leído en porcentaje para texto; sección actual de un audiolibro para audio. No se inventa un porcentaje global de un audio DAISY cuando se desconocen las duraciones de sus pistas.
- Se conservan los índices antiguos de filtros para evitar confundir las preferencias guardadas de otros bloques, añadiendo las nuevas categorías al final.

## Pruebas de aceptación en Pixel con TalkBack

1. Crear «Novelas» desde Filtros, comprobar que aparece sin libros; salir, cerrar y reabrir; confirmar que se mantiene.
2. Crear «Historia DAISY» desde «Mover a carpeta», mover dos obras y cambiar su nombre; comprobar que la organización se actualiza en filtros y Mi biblioteca.
3. Eliminar una carpeta que contiene obras; confirmar que las obras siguen en Sin carpeta y que no se pierden sus marcas ni posición.
4. Añadir tres obras a cola mediante acciones del rotor, subir y bajar, quitar una, cerrar y abrir; comprobar el orden y que Filtros > Cola de lectura respeta ese orden.
5. Abrir Marcas desde el rotor y saltar a un porcentaje de texto o segmento+segundo de un DAISY; bloquear pantalla y comprobar el servicio multimedia.
6. Marcar una obra como terminada, filtrar Terminados/En curso y verificar la última lectura en Información.
7. Comprobar con TalkBack que todos los campos y acciones están identificados y que la navegación al salir devuelve el foco a la biblioteca.

No fusionar ni distribuir por Play Store hasta que la APK 0.16 supere compilación y pruebas físicas. Los datos de compilaciones debug pueden perderse si Android exige desinstalación por cambio de firma.

# Fase final de TifloLector — bloque 4 de 7 (herramientas por documento)

Versión **0.15-bloque4**, rama de pruebas y PR #258. Basada en el bloque 3/0.14; no modifica Google Play ni iOS.

La portada del lector permanece igual: Importar, Ajustes, Filtros, Mi biblioteca. «Detalles y herramientas» aparece **dentro** de cada texto y de cada audiolibro, con botón de volver a lectura y orden TalkBack natural.

## Funciones nuevas

- Compartir un archivo original por Android Sharesheet a través de FileProvider restringido a los documentos privados del lector. La autorización de lectura es temporal y solo para el URI elegido. Se conservan bytes originales; no se revela el resto de la biblioteca.
- Exportar con el selector nativo «Guardar archivo en…» (Storage Access Framework, CreateDocument) el original con extensión correcta o el texto accesible en UTF-8 como TXT, permitiendo carpetas locales y proveedores nube configurados. El usuario elige el destino explícitamente; no se requiere permiso de almacenamiento amplio.
- Compartir el texto extraído directamente mediante menú de compartir si no supera 80.000 caracteres. Para documentos mayores hay que exportar TXT; no se recorta silenciosamente.
- Traducción local mediante ML Kit Android 17.0.3, sin servicio remoto de traducción de documentos. Idioma de origen y destino elegidos expresamente (español, inglés, portugués, francés, alemán, italiano, polaco, árabe, japonés, chino, hindi). Se traduce el fragmento de lectura actual o la obra completa hasta 60.000 caracteres, dividida en unidades limitadas preservando todos los caracteres. La primera vez **descarga modelos** y requiere conexión; después, el motor trabaja en el dispositivo sin enviar el texto para traducir a un servidor. Traducción en pantalla, seleccionable y compartible/exportable como TXT. El original nunca es modificado. Traducción automatizada revisable.
- Detalles: formato, extensión del texto, número de pistas y marcas. Preferencias por obra: lectura automática al abrir (general/nunca/siempre), idioma fuente y destino de traducción, unidad de navegación TTS, velocidad por audiolibro y ajustes de voz y presentación independientes ya existentes (sin duplicar secciones).
- Audio DAISY mantiene sesión multimedia en segundo plano y navegación del bloque 2. Las herramientas solo intervienen a petición del usuario.

## Pruebas pendientes en Pixel

1. Con TalkBack abrir «Detalles y herramientas» en un EPUB, PDF, DOC, MP3 y DAISY. Volver y comprobar que la lectura sigue en su posición.
2. Compartir un original EPUB y exportarlo a Archivos o Drive. Leerlo desde otra aplicación; asegurar que Android no solicita acceso a toda la biblioteca.
3. Exportar un PDF original y un TXT extraído, comparar contenido y extensión.
4. Traducir un párrafo del inglés al español (descarga inicial), volver a traducir desconectado, guardar TXT, comprobar que texto fuente permanece idéntico. Elegir origen y destino distintos.
5. Intentar traducir un libro que supera 60.000 caracteres, comprobar que ofrece un límite honesto y la opción de fragmentos.
6. Cambiar lectura automática y unidad de navegación por obra, salir, reabrir y confirmar persistencia, mientras otras obras conservan ajustes globales.
7. Con audio de varias horas, compartir ZIP original sin desbordar memoria, volver de hoja de compartir, probar auriculares y pantalla bloqueada.

## Limitaciones

- La traducción por voz no reescribe el texto original; el resultado se muestra y se puede compartir/exportar. No hay reemplazo permanente en la biblioteca ni edición colaborativa.
- No existe OCR de imágenes de Office incrustadas todavía (bloque 6).
- ML Kit traduce bajo demanda con modelos descargados en el dispositivo; es traducción automática aproximada, no garantiza fidelidad literaria ni técnica. No confundir con traductor en línea ilimitado. Documento completo limitado a 60.000 caracteres por operación.
- La firma de compilaciones debug puede variar: desinstalar el prototipo puede eliminar su biblioteca. No desinstalar la app publicada.

# Fase final de TifloLector — bloque 3 de 7 (formatos documentales antiguos y ebooks)

Versión **0.14-bloque3** en rama y PR #257, basada en 0.13. No modifica Google Play ni la aplicación iOS.

## Lectores añadidos

- Office 97–2003: **DOC** (texto Word HWPF), **XLS** (hojas y celdas HSSF), **PPT** y **PPS** (diapositivas HSLF) con Apache POI 5.2.5. Exige firma binaria OLE2 real, rechaza archivos ilegibles/cifrados y limita cada archivo a 40 MB. No ejecuta macros, fórmulas, scripts ni vínculos externos. Se extrae texto, no se conserva la maquetación original; imágenes incluidas, diagramas y tablas visuales requieren OCR posterior.
- PalmDB/PalmDOC y Mobipocket: **PDB, PRC, MOBI**, algunas variantes **AZW/AZW3** sin cifrado cuando el texto se almacena en registros PalmDOC con compresión simple o LZ77 (tipos 1 y 2). Detecta encabezados, límites, codificación UTF-8 y Windows-1252. Prohíbe explícitamente compresiones HUFF/CDIC, cifrado, DRM, versiones Kindle no decodificables y estructuras incompletas, con error legible y sin crear un libro vacío.
- ZIP, RAR y 7Z: también aceptan DOC/XLS/PPT/PPS y formatos de libros electrónicos antiguos en sus carpetas internas. Conservan límites de entrada y los nombres se usan solamente como identificadores, nunca rutas absolutas de escritura. La lectura DAISY del bloque 2 permanece intacta.
- No cambia la portada ni los controles TalkBack. Los libros importados se guardan como texto accesible en TifloLector y conservan el archivo original.

## Verificación

Se añaden pruebas unitarias: XLS 97 creado con POI con valores y hojas, PPT/ PPS creado con HSLF, rechazo de falsas cabeceras OLE, PalmDB/MOBI sintético con texto real y compresión LZ77, rechazo DRM y HUFF/CDIC, extracción ZIP y 7Z auténticos incluyendo extensiones heredadas y rutas peligrosas.

## Limitaciones que no deben anunciarse como resueltas

- **AZW3/KF8 no equivale a todos los Kindle.** Los libros con fragmentos/índices KF8 complejos, HUFF/CDIC y DRM no se pueden tratar como libros PalmDOC ordinarios. Para ellos conviene conseguir una versión EPUB/TXT sin DRM del proveedor.
- DOC/PPT/PPS/XLS son archivos binarios antiguos muy heterogéneos. La prueba de escritorio y la compilación no demuestran que funcionen con todas las variantes en Android: hay que validar documentos reales, con especial atención a compatibilidad de bibliotecas POI y Android sin java.awt.
- RAR5, multipartes y 7Z con compresiones variadas requieren muestras reales en Pixel. Archivos cifrados o con contraseña no admitidos; no es correcto prometer eliminar DRM ni descifrar archivos.
- Libreta de imágenes OCR dentro de documentos Office, gran cantidad de archivos en un ZIP y recuperación de un libro mal formado siguen necesitando desarrollo específico.
- No fusionar ni distribuir por Play Store hasta validar en Pixel/TalkBack y comprobar que la instalación del prototipo no sustituye la versión publicada.

## Prueba física de aceptación

Comprobar un DOC de Word 2003 con párrafos, un XLS de Excel 2003 con varias hojas, una presentación PPT/PPS con varios títulos, un MOBI libre de DRM y un 7Z de documentos. Revisar texto, orden, controles TalkBack, lectura bloqueando pantalla, volver al mismo punto y conservación de originales. Intentar importar un fichero con contraseña para comprobar que falla con una explicación accesible.

# Fase final de TifloLector — bloque 2 de 7 (DAISY navegable)

Versión de pruebas **0.13-bloque2**, PR #256, basada en 0.12. No cambia la app publicada de Android ni la versión iOS.

- DAISY 2.02: NCC.HTML define capítulos y subapartados h1–h6; los elementos con clase de página aportan paginación; div/span que representan notas se separan de páginas. Se resuelven `href` que apuntan a identificadores de `<par>`, `<text>` o `<audio>` de SMIL, y no se deducen por nombres de MP3.
- DAISY 3: NCX admite la jerarquía de `navMap/navPoint`, `pageList/pageTarget`, y `navList/navTarget` como notas u otros accesos según sus atributos. Referencias a SMIL o a destinos XHTML/XML asociados con audio.
- Sincronía: se lee `<text src="capitulo.xhtml#id">` por fragmento SMIL, si existe; se adjunta una muestra del texto literal (hasta 200 caracteres), y la pantalla muestra el fragmento mientras se reproduce. No hay transcripción automática, resaltado de palabras ni interpolación de tiempos inexistentes.
- Navegación interior en pantalla independiente que conserva el estilo limpio y los controles de TalkBack: Encabezados (todos o nivel 1 a 6), Páginas (lista e «Ir a página» por etiqueta), Notas, Otros puntos y Fragmentos de audio. No se habilitan entradas que el DAISY no documenta. Selección mueve el servicio multimedia al fragmento indicado, también si el usuario abre un libro pausado.
- Compatibilidad: se añaden campos opcionales al índice JSON, sin eliminar marcas, posición, ajustes o pistas anteriores. Libros importados en 0.12 seguirán reproduciéndose, aunque para construir un índice DAISY avanzado de los ya importados hará falta reimportar el original.
- Seguridad: los recursos del libro se leen del archivo original ya extraído, sin acceder a redes ni resolver entidades XML externas. Se limita el tamaño de NCC/NCX/texto y se libera caché de documentos temporales tras importar.

## Limitaciones y pruebas pendientes

No todas las ediciones DAISY contienen texto sincronizado ni notas o índices de páginas. La calidad de la navegación depende de la estructura del libro. Esta fase no implementa notas emergentes con retorno automático a la posición, navegación avanzada de audio por puntos en tiempo real sin índice ni resaltado palabra a palabra. Se necesita validar DAISY 2.02, DAISY 3, libros solo de audio y mixtos texto/audio en Pixel con TalkBack, y comprobar retroceso desde la navegación y continuidad del servicio del bloque 1.

Prueba sugerida: importar un DAISY con dos encabezados en distintos niveles, páginas etiquetadas y al menos una nota; navegar por cada tipo y confirmar que el salto corresponde al audio correcto. Repetir con un DAISY sin notas: debe decir que no hay puntos de ese tipo. En un DAISY con `text src`, comprobar el texto mostrado al cambiar de fragmento sin VoiceOver/TalkBack duplicando locuciones.

# Fase final de TifloLector — bloque 1 de 7 (reproducción continua)

Versión de prueba 0.12 (PR #255). Sigue separada de la aplicación publicada en Play Store y de iOS.

## Arquitectura

- `NativeReaderPlaybackService`, un solo propietario de la voz Android TTS y del reproductor MediaPlayer. Android lo mantiene como servicio en primer plano de tipo mediaPlayback mientras habla o reproduce. El contenido de la pantalla Compose NO posee ni apaga el audio al salir; la interfaz se limita a enviar acciones y observar el estado.
- `android.media.session.MediaSession` activo con estado, título de la obra y acciones de reproducir, pausar, detener, sección anterior/siguiente. Notificación `MediaStyle` con botones de reproducción y acceso directo al libro. Los mandos de medios/auriculares se enrutan a la sesión.
- Foco de audio de tipo voz hablada: pausar con pérdida definitiva o temporal del foco, reanudar tras recuperación si fue interrupción temporal, pausar sin reanudación automática al desconectar auriculares. Protección frente a otras aplicaciones que comiencen a reproducir audio.
- Reproducción de audio DAISY con intervalos SMIL y lectura TTS por frases, párrafos o bloques. La sesión persiste periódicamente el índice de sección y milisegundos de audio, o el offset de texto al finalizar cada unidad de locución. Las marcas individuales se conservan al salir de la pantalla.
- Apagado automático de 5/10/15/30/45/60 minutos, desactivado por defecto. El contador de tiempo de reproducción se conserva pausado durante las interrupciones y se descuenta solo mientras suena el audio. Al vencer pausa sin borrar el punto guardado.
- Tras tocar la notificación, la aplicación vuelve a la misma obra en TifloLector, preservando el flujo de autorización de YouTube no relacionado. Si el servicio pausado ha sido recreado mientras el proceso sigue activo, puede recuperar el libro desde el estado de la sesión.
- El visor conserva su interfaz minimalista: Reproducir/Pausar, Navegación, Audio, Visual, Más acciones y títulos con ajustes de TalkBack.

## Verificaciones físicas pendientes antes de integrar

Es requisito probar en Pixel con TalkBack: audio de varias pistas y TTS durante bloqueo prolongado, controles de la pantalla bloqueada, auriculares/Bluetooth, pérdida/recuperación del foco en llamadas y mensajes, desconexión física de auriculares, cambio de app, temporizador con pausas, marcas, salto de sección y retorno desde notificación. La compilación CI solo valida código y pruebas unitarias existentes, no demuestra esos comportamientos en el hardware.

Limitaciones: no se implementa aún un reinicio automático tras reboot, soporte Android Auto, biblioteca de media externa ni pruebas con todos los motores TTS. La reproducción background debe comprobarse con políticas de batería del Pixel. No fusionar ni publicar sin aceptación del usuario.

## Plan de siete bloques

1. Servicio de reproducción continua, sesión de medios, interrupciones y posición (este bloque).
2. Navegación DAISY completa y sincronización texto-audio.
3. Conversión fiable de formatos antiguos y nuevos ebooks.
4. Herramientas por documento: traducción, exportación y compartir.
5. Biblioteca: cola, marcas, progreso y ajustes individuales.
6. OCR avanzado y procesamiento reanudable.
7. Auditoría de accesibilidad, persistencia, datos y entrega estable.

# TifloLector 0.11 — comprimidos y DAISY de audio

Versión de prueba. **No modifica Google Play, iOS ni la aplicación Android publicada**. Esta rama depende de las propuestas 0.8–0.10 y debe continuar en borrador hasta las pruebas físicas.

## Compatibilidad nueva

- Abrir **ZIP, RAR y 7Z** desde Archivos o un proveedor de nube reconocido por Android. Se copian a la zona temporal privada y se descomprimen a archivos privados en disco, sin cargar el libro completo en memoria. Los nombres del comprimido son solo identificadores, nunca rutas de extracción; hay límites de origen (1 GB), total descomprimido (1,5 GB), entrada individual (400 MB) y número de archivos (4000). Los formatos protegidos con contraseña, multipartes incompletos o archivos incompatibles dan error, no se anuncian como disponibles.
- Reconocer paquetes **DAISY 2.02** con NCC.HTML y SMIL y algunos DAISY 3 con OPF/SMIL. NCC/OPF establece el orden de documentos SMIL; los elementos audio de SMIL dan orden de pistas y límites de fragmentos. Los mismos MP3 se reutilizan sin duplicarlos cuando varios segmentos los citan. Resolución de rutas relativas, espacios y acentos. Admitir SMIL con DOCTYPE externo habitual sin resolver ni descargar DTD.
- El reproductor nativo presenta Reproducir/Pausar, retroceder/avanzar 30 segundos, progreso de sección, Audio (velocidad y apagado automático, cerrado) y Más acciones (sección anterior/siguiente, selector para libros cortos, guardar y recuperar marcas por sección). El título conserva las acciones ajustables con TalkBack.
- Los comprimidos pueden contener texto TXT/Markdown/HTML/XHTML/RTF/FB2, y documentos Office modernos/EPUB/PDF que quepan en los límites de la extracción de texto. Se conserva el original del archivo y el texto extraído en almacenamiento privado; no se pierde la obra original.
- Para evitar el gasto de espacio, la copia del comprimido y las pistas extraídas se mueve dentro del almacenamiento local cuando sea posible.

## No declarar finalizados todavía

- **No soportado**: DOC, PPT, PPS y XLS binarios antiguos, MOBI/AZW3/KFX con DRM, conversión de esos ebooks, sincronización DAISY texto-audio con anclajes en cada frase, ZIP/RAR/7Z con contraseña y multipartes incompletos. La decodificación de Office binario requiere una biblioteca Android compatible y pruebas reales antes de habilitarla.
- **Pendiente de prueba física**: RAR antiguos y RAR5, 7Z de distintos algoritmos, libros DAISY de varias horas, pista FLAC/OPUS según códec Android, pausa/reanudación, marcas de sección, bloqueo de pantalla y compatibilidad con TalkBack. La compilación y las pruebas unitarias no sustituyen ensayos de usuario.
- **Navegación DAISY**: se respeta la ordenación y los intervalos de sonido de los archivos SMIL compatibles, pero no toda la navegación avanzada por página, nivel de encabezado, notas, frases sincronizadas o subtítulos. El reproductor multimedia avanzado en segundo plano también sigue pendiente.
- **Restricción de instalación**: las APK debug no tienen todavía firma de pruebas persistente. Desinstalar el prototipo puede borrar todos sus libros de prueba. Conservar originales y no borrar nunca la aplicación publicada.

## Pruebas de aceptación en Pixel

1. Un ZIP con MP3 numerados p1, p2, p10: comprobar orden natural.
2. Un DAISY 2.02 ZIP que incluya NCC.HTML y SMIL con dos capítulos, MP3 compartido y clips no contiguos: comprobar secuencia exacta y salto de sección.
3. Un 7Z y un RAR con pistas MP3, libros con y sin carpetas internas.
4. Un libro de audio superior a 80 MB: comprobar que importa sin error de límite anterior y sin agotar memoria ni almacenamiento.
5. Salir, reabrir la obra, recuperar posición y marcas por sección. Comprobar Voice/TalkBack durante reproducción.
6. Intentar importar un archivo con contraseña o entradas peligrosas: obtener error accesible y no crear una obra incompleta.

# Prototipo TifloLector 0.10 — OCR y ampliación real de formatos

RAMA DE PRUEBAS, PR #253. No sustituye a la versión publicada en Google Play ni fusiona automáticamente los PR anteriores.

## Cambios implementados
- Importar **JPG/JPEG, PNG, WebP, BMP, HEIC/HEIF**: reconocimiento de texto latino (español/inglés y otros alfabetos latinos) mediante ML Kit 16.0.1 empaquetado, para funcionar sin descargar el modelo OCR. Los resultados vacíos informan del fallo y no crean un libro fingidamente legible. Compatibilidad HEIC depende del decodificador Android disponible.
- Importar **PDF escaneado o mixto**: se recupera el texto seleccionable por página. Las páginas sin texto o con menos de 40 caracteres alfanuméricos prueban reconocimiento OCR del renderizado de esa página, conservando el texto seleccionable si el reconocimiento opcional falla. Se procesa y libera una página cada vez con dimensiones/píxeles máximos. Límite provisional: 250 páginas y PDF hasta 40 MB; libros grandes requieren OCR por lotes. El importador informa progreso por página.
- Conservar una copia **privada del original** de cada importación, además del texto extraído. Nunca se sobrescribe el original con el OCR. Al eliminar una obra se borra también su original y pistas asociadas.
- Nuevos extractores: ODT, ODS, ODP, PPSX, FB2 (también dentro de ZIP), RTF mejorado. EPUB utiliza la secuencia de capítulos del OPF. FLAC/OPUS se abren mediante MediaPlayer solo donde el sistema los decodifique. Los archivos ZIP se tratan con límites de tamaño y de cantidad de entradas, y XML bloquea entidades externas.
- Filtros de biblioteca incluyen OCR de imágenes y los OpenDocument dentro de Office. Todos los títulos siguen simples, con gestos TalkBack; no se añade buscador, cola ni se desdoblan menús generales.

## Limitaciones pendientes antes de declarar equivalencia con iOS
- **No son lectores actuales** los Office binarios antiguos DOC, PPT, PPS y XLS, ni RAR/7Z, MOBI/AZW3/KFX, libros con DRM, audio/video complejo o PDF con contraseña.
- OCR local incluido para escrituras **latinas**, no para chino/japonés/coreano/devanagari en esta compilación. La calidad depende de imagen/idioma. No se corrigen automáticamente tablas difíciles ni orden en columnas.
- PDF con escaneo y capa extensa de texto en la *misma página* todavía puede omitir contenido gráfico. El OCR de 250 páginas puede llevar mucho tiempo: falta procesamiento reanudable por lotes, cancelación garantizada y trabajo en segundo plano.
- Falta navegación DAISY estructural/sincronizada, extracción OCR de imágenes incrustadas en EPUB/Office, exportación, traducción, restauración con firma persistente y reproducción avanzada de fondo. Se conservan como tareas expresas, no como opciones falsamente disponibles.
- Las pruebas de unidad/build **no equivalen** a pruebas reales en Pixel/TalkBack con EPUB, documentos Office, fotos borrosas y PDF escaneados. No publicar hasta validación.

## Prueba sugerida
Primero, un TXT ya comprobado como control. Después, un JPG con un párrafo grande y nítido, un PNG de pantalla, un PDF de dos páginas escaneadas, un PDF con texto seleccionable y otra página escaneada, y un ODT/ODS/ODP sencillo. Confirmar importación, lectura, posición, marcas, apertura de carpeta, salida y regreso. Conservar siempre los archivos originales fuera del prototipo. Desinstalar el APK de firma debug variable elimina los datos privados de la app de pruebas.

# Prototipo 0.9 — voces, pronunciación y apagado automático

En esta fase se conservan la portada mínima y el flujo de importación del prototipo 0.8. No modifica la aplicación de Google Play.

- En Ajustes generales, dentro de **Audio y voces** (cerrado al entrar): selección de la voz del motor Android activo; botón **Buscar voces de otros proveedores** que abre otra pantalla con Acapela TTS Voices, Vocalizer TTS y Eloquence TTS. Cada enlace externo requiere confirmación. La instalación, disponibilidad, pagos, cambio de motor TTS y descarga son responsabilidad del proveedor/usuario. El lector no descarga voces privativas ni promete que cada motor aparezca en todos los dispositivos. **Actualizar voces instaladas** vuelve a consultar el motor TTS.
- **Diccionario de pronunciación**, dentro de Audio y voces y también accesible desde Audio de un documento de texto: añadir y borrar parejas «Palabra escrita / Pronunciar como». Límite de 150 entradas, sustitución por palabras completas, sin cascada, solo sobre el fragmento enviado a síntesis, preservando contenido, progreso y marcas. Al abrir su editor desde un documento se pausa la lectura para evitar solapamiento con TalkBack.
- **Apagado automático** dentro de Audio de cada texto y de cada audiolibro: Desactivado, 5, 10, 15, 30, 45 y 60 minutos. Por defecto desactivado al abrir un libro. El contador se ejecuta mientras se reproduce; al pausar se cancela y al reanudar inicia de nuevo el intervalo. Al vencer la reproducción se detiene o pausa conservando la posición. No es alarma independiente ni se mantiene contando con audio pausado.
- Pendiente validación física de enlaces de proveedores según región, motores que anuncian sus voces en Android, pronunciación en lenguas mixtas y temporizador con pantalla bloqueada.

## Inventario de formatos — estado real de prototipo 0.9

1. **Decodificadores presentes que exigen pruebas reales**: TXT, Markdown, HTML/HTM, CSV/JSON/XML/log/SRT (texto), PDF con capa de texto, EPUB sin DRM, DOCX, PPTX, XLSX, ZIP de texto/audio, DAISY/ZIP con contenido reconocible (sin sincronía SMIL), MP3, M4A/M4B, WAV, OGG y AAC (según códecs compatibles de Android). RTF se trata por ahora solo de forma básica; **no** se considera fidelidad de conversión a RTF garantizada.
2. **Prioridad alta, aún no incorporados en el prototipo nativo**: OCR de PDF escaneados, fotografías JPG/JPEG/PNG/WebP y texto integrado en imágenes; extracción estructural de tablas Office y notas/alternativas de imagen; DAISY completo con navegación/sincronía, audio en segundo plano.
3. **Office legado pendiente**: DOC binario, PPT, PPS y XLS. Formatos de presentación/Office pendientes adicionales: PPSX y OpenDocument ODT/ODS/ODP.
4. **Otros formatos posibles a evaluar según demanda y licencia/códecs**: FLAC/OPUS, FB2, MOBI/AZW3/KFX (incluido DRM, que no se promete admitir), RAR/7Z, páginas XHTML individuales y archivos de audio/vídeo MP4. MP4 es contenedor multimedia, no necesariamente un libro.
5. **Otras funciones independientes del formato** todavía pendientes de portarse del lector Android ya publicado a este prototipo nativo: OCR, traducción en dispositivo, exportación/compartir, biblioteca con firma persistente y restauración, continuidad multimedia en segundo plano; comprobar la paridad con las últimas versiones iOS.

No afirmar equivalencia funcional ni publicar hasta pruebas en Pixel con TalkBack y documentos representativos. El repositorio existente ya contiene OCR, traducción y controles avanzados para la app Android anterior, que pueden servir de referencia para portar estas funciones sin perderlas.

# Propuesta 0.8 — paridad mínima TifloLector Android/iOS (26/10/2026)

ESTADO: propuesta en PR #252, independiente de la app Google Play. No dar por aceptada ni publicar hasta ensayo físico con TalkBack y confirmación del usuario.

## Entrada a TifloLector
La portada del lector muestra únicamente **Importar**, **Ajustes**, **Filtros** (cerrados por defecto), encabezado **Mi biblioteca** y títulos paginados de diez en diez. Sin barra de búsqueda general, sin panel de cola ni bloque de marcas desplegado en Inicio. Las marcas se consultan desde la obra. Se conserva "Volver al inicio".

- **Importar** abre pantalla con dos accesos: «Archivos del dispositivo y nubes», mediante Android Storage Access Framework (document picker, admite proveedores instalados como Google Drive o OneDrive si el usuario tiene sesión y proveedor), y «Bibliotecas externas (OPDS)», con Proyecto Gutenberg y catálogos HTTPS añadidos por el usuario. No se implementa una integración o login de nube propio.
- **Ajustes** abre submenús independientes y cerrados: Audio y voces (velocidad, filtro de idioma, voces Android instaladas, acceso a ajustes TTS del sistema), Modo manual/automático, Presentación visual (tamaño, interlineado, negrita), Navegación y avances (bloque/párrafo/frase), Formatos reales.
- **Filtros** usan deslizadores ajustables para formato, fecha, favoritos, marcas, orden y carpeta; sin buscador textual destacado. Los títulos se pueden gestionar con acciones TalkBack: Abrir, Reproducir, Marcas, Favorito, Información, Cambiar título, Mover a carpeta y Eliminar con confirmación. El gesto vertical ajusta la acción seleccionada, y el doble toque la ejecuta; se debe confirmar físicamente porque TalkBack depende de la configuración de controles de lectura.
- Dentro de un texto, únicamente Reproducir/Pausar, progreso, Navegación, Audio, Visual y Más acciones, todos los submenús cerrados. El título también admite acciones ajustables con gestos; el texto se presenta tras los controles. Preferencias visuales y voz individuales por libro.
- Decodificadores añadidos: TXT/MD/HTML y otros textos simples; PDF que ya contenga texto (sin OCR), EPUB, DOCX, PPTX, XLSX, ZIP y DAISY de texto/audio (sin sincronización SMIL de momento); pistas MP3, M4A, M4B, WAV, OGG y AAC por reproductor local básico de primer plano. No se afirma lectura de PPT/PPS/XLS antiguos, PDF escaneado, DRM, conversión perfecta de tablas/estructuras, ni audiolibros con servicio multimedia de fondo. La lectura DAISY actual **no** promete navegación sincronizada texto/audio.
- Los archivos están en la biblioteca privada del prototipo; no se migra ni comparte la biblioteca de la app comercial. Desinstalar una APK debug de distinta firma destruye esos datos del prototipo. Conservar originales hasta que exista firma estable, pruebas de importación y persistencia verificadas.
- En esta iteración los usuarios todavía deben validar títulos/tipos distintos en Pixel, controles ajustables, su locución, reapertura de libros y estados sin conexión. Compilar NO demuestra usabilidad.

# Estado actual del prototipo — 0.7 (TifloLector, primera fase, 26/10/2026)

Esta sección actualiza el alcance inicial de este README. Las secciones históricas de fases anteriores se mantienen como registro, pero no describen la totalidad de las funciones de la versión 0.7.

- La portada tiene Actualidad, Recursos, TifloLector y Vídeos. TifloLector usa Compose nativo y una biblioteca **privada del prototipo**, sin leer, modificar ni migrar los archivos de la aplicación Android de Google Play.
- Una única opción **Importar** permite copiar de Archivos TXT, HTML, HTM, MD y Markdown (hasta 4 MB). El importador rechaza expresamente formatos aún no admitidos. Al abrir un título de Mi biblioteca se entra directamente a la lectura.
- Lectura por síntesis TTS instalada en Android, reproducir/pausar primero, selector de unidad Bloque/Párrafo/Frase (control ajustable TalkBack), anterior/siguiente, porcentaje, salto en pasos de 10 %, marcas guardadas, velocidad y retorno claro.
- Portada del lector compacta: Importar, Ajustes, Filtros, Mi biblioteca y Marcas; los submenús abren cerrados y la lista de libros está paginada de diez en diez, con títulos exclusivamente.
- Los libros se almacenan en archivos privados internos y el índice guarda posiciones y marcas. No se anuncian automáticamente en directo los cambios de progreso para evitar solapamiento con TalkBack.
- **Importante:** La firma debug de GitHub Actions aún puede variar de una compilación a otra. Desinstalar el prototipo para instalar una APK distinta **borra su biblioteca de pruebas**. No guardar documentos importantes como única copia aquí. Se debe resolver una firma de pruebas persistente antes de tratar la biblioteca como duradera.
- Todavía no están implementados el importador PDF/DOCX/EPUB/DAISY/Office, OCR, exportación, carpetas, cola, lectura de audio, biblioteca remota, motores de voz alternativos ni migración desde la app publicada. No presentar esta prueba como lector completo.
- Para considerar la fase aceptada faltan **pruebas reales en Pixel/TalkBack**: importar TXT, lectura con pantalla encendida y bloqueada (no garantizada todavía), suspender y reanudar, uso del selector vertical, marca, porcentaje, regreso a biblioteca, cierre/reapertura y contraste de idioma.
- El ajuste 0.6 de flic de Vídeos se arrastra a esta rama pero **no se considera validado en dispositivo** hasta que el usuario lo confirme.
- Sin publicación en Google Play ni cambios en iOS, la web ni las bibliotecas de usuarios.

# TifloAcosta Nativa Pruebas — fase 1

Prototipo **independiente** en Kotlin y Jetpack Compose. Instalación paralela
con paquete `com.tifloacosta.nativeprototype`; **no** reemplaza TifloAcosta de Google Play
(`com.tifloacosta.app`) ni las APK de pruebas del proyecto Capacitor.

## Alcance de este primer prototipo
- Portada mínima: Actualidad y Recursos.
- Catálogo publicado `https://tifloacosta.com/mobile-content.json` (solo consulta).
- Selector de formato multimedia y selector de categoría en Actualidad.
- Selector de categoría en Recursos y listado inferior filtrado.
- Selector accesible discreto basado en Slider nativo Compose y acciones
  personalizadas de anterior/siguiente. TalkBack debe comprobarse físicamente:
  los gestos arriba/abajo dependen del elemento enfocado y de la configuración.
- Un solo título accesible por documento o noticia, con su detalle al activar.
- Selecciones que se conservan en pantalla; listado de hasta diez entradas y
  botón para mostrar otras diez; cache local del último catálogo válido.
- Español e inglés según idioma del dispositivo, texto grande y tema oscuro.

## Segunda revisión — tras prueba en Pixel
- El selector ajustable **ya fue probado en Pixel con TalkBack**: funcionan
  los gestos arriba y abajo, y actualiza los resultados.
- Portada auténtica con entradas a Actualidad y Recursos; botón «Volver» en
  ambas pantallas, junto con el gesto o botón Atrás del sistema.
- Al regresar se conserva la opción elegida; los resultados permanecen filtrados.
- Menos indicaciones repetidas: se elimina la acción accesible «Abrir detalles»
  que duplicaba la activación normal del título, y el mensaje de instrucción
  innecesario que aparecía antes de seleccionar una categoría.
- Mantener las indicaciones nativas útiles del control ajustable. Para
  identificar cualquier repetición que persista, registrar la frase exacta
  que TalkBack anuncia en la prueba física antes de suprimir semántica que
  sostiene los gestos ya confirmados.
- En TalkBack existe «Activación con un toque» en Configuración avanzada:
  ajuste **del sistema**, opcional, a decisión del usuario. También admite
  el gesto «toque dividido» con dos dedos, uno manteniendo contacto.
- La firma efímera del APK debug puede exigir desinstalar **solo** «TifloAcosta
  Nativa Pruebas» antes de instalar un nuevo APK; nunca la app de Google Play.

## Quinta revisión — módulo Vídeos, cuenta de Google y gestos TalkBack (0.5)

- Nuevo botón «Vídeos» en la portada, separado del catálogo editorial de
  Actualidad, para los vídeos del catálogo de TifloAcosta.
- El reproductor integrado permite navegar con **flic arriba/abajo** por un
  selector ajustable de acciones; control separado «Ejecutar» evita depender
  de pulsar todos los botones. Conserva botones individuales y saltos 30 s.
- Acciones de Google dentro del reproductor: «Me gusta», «Suscribirme»,
  «Comentar» (campo editable + «Publicar» explícito), «Cerrar sesión»,
  compartir y enlace alternativo a YouTube.
- Se reutiliza el **Worker OAuth de YouTube ya desplegado**:
  `/auth/native/start`, `/auth/native/exchange`, `/session`, `/state`,
  `/like`, `/subscribe`, `/comment`. No cambian rutas del servidor.
- La identificación de Google se abre en el navegador externo. Android recibe
  el retorno `tifloacosta://youtube-auth` en la app nativa de pruebas; la
  app original Android no registra este filtro. Se utiliza desafío PKCE
  adicional; se cifra la credencial de sesión con Android Keystore (AES-GCM).
  No se solicita ni almacena la contraseña de Google, ni sus refresh tokens.
- El vídeo puede reproducirse sin iniciar sesión. Si el servicio de YouTube
  falla, el reproductor y el acceso externo siguen disponibles.
- El usuario debe probar **en su Pixel 10** el ciclo completo Google → regreso
  a la app nativa → Me gusta → Suscripción → Comentar → Cerrar sesión.
  Compilar no certifica el funcionamiento real de OAuth, cuotas o TalkBack.
- La firma de las APK de prueba puede cambiar entre compilaciones:
  el usuario puede tener que desinstalar solo el prototipo. PENDIENTE firma fija.

## Cuarta revisión — reproductor nativo accesible de YouTube (0.4)

- Al abrir un título de vídeo de YouTube se presenta la reproducción dentro
  de TifloAcosta, sin salir automáticamente a la app de YouTube.
- Se usa **exclusivamente la API oficial YouTube IFrame**, a través de WebView
  con `loadDataWithBaseURL` y origen identificado con el ID de esta aplicación.
  No se descargan ni extraen contenidos de YouTube.
- Controles Android Compose accesibles por TalkBack: Reproducir/Pausar,
  retroceder/avanzar 30 segundos y posición ajustable, con botón Volver.
- Si el vídeo no tiene un enlace individual o YouTube impide embeberlo,
  sigue disponible «Abrir en YouTube (alternativa)».
- No se afirma que todos los vídeos se puedan embeber; depende de
  restricciones del contenido, YouTube y WebView. Validación física pendiente.
- Los podcasts todavía usan enlace externo hasta añadir reproductor
  de audio Media3 en la siguiente fase.
- No modifica TifloAcosta Play Store ni la instalación antigua.

## Tercera revisión — multimedia editorial en Actualidad

- Contenidos «Podcasts», «Canales de YouTube» y «Todos los formatos»,
  integrados en el selector nativo de Actualidad y cargados desde el mismo
  catálogo `https://tifloacosta.com/actualidad-media.json` usado por iOS.
- Al elegir el formato, se filtran los episodios/vídeos debajo, sin presentar
  noticias de otra categoría. Se puede ajustar «Fuente o canal» e «Idioma»
  deslizando arriba/abajo con TalkBack.
- Un único botón por título; detalle con fuente, descripción y enlace.
  El audio y los vídeos se abren en su fuente externa: **todavía no existe
  reproductor multimedia nativo ni autenticación YouTube**.
- Mantiene copia del catálogo válido para la consulta sin conexión.
- Pruebas unitarias de filtros, idioma, canales y enlaces HTTPS seguros.
- Se mantiene el botón Volver de 0.2 y el regreso desde el diálogo.
- Versión interna `0.3-prototipo`. No modifica TifloAcosta de Google Play.

## Fuera de alcance de la fase 1
Autenticación de Google, comentarios y acciones de YouTube, reproductores,
reproductores y reproducción integrada, biblioteca personal, TifloLector, importación,
archivos, OCR, Media3, notificaciones y migración de datos. Esas funciones
**siguen en las aplicaciones existentes**. Las opciones de multimedia de esta
prueba muestran el catálogo editorial por enlace externo; no hay reproductor integrado.

## Compilación
Con JDK 17, Android SDK API 36 y Gradle 8.14.3:
`gradle -p android-native-prototype :app:testDebugUnitTest :app:assembleDebug`

La APK se genera como `android-native-prototype/app/build/outputs/apk/debug/app-debug.apk`.
CI de esta rama no tiene claves de firma de publicación, no toca Play Console y
sube solo la APK de prueba como artefacto.

## Validación obligatoria con TalkBack
1. Enfocar «Categoría» y comprobar que anuncia la opción seleccionada.
2. Probar gestos arriba/abajo y menú de acciones personalizadas en Pixel.
3. Cambiar de categoría sin perder foco y recorrer solo los títulos filtrados.
4. Probar doble toque en un título, abrir/cerrar detalle y volver al título.
5. Probar modo de letra grande, tema oscuro, idioma inglés y conexión fallida.
6. Verificar que las tres apps se pueden instalar sin afectarse entre sí.

No fusionar ni publicar hasta pruebas reales y decisión expresa.
Relacionado: incidencia #249 y estudio maestro #243.
