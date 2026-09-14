# Actualidad Multimedia: diseño de secciones

## Objetivo

Crear dentro de Actualidad una zona multimedia potente y accesible que permita descubrir vídeos, podcasts y otros contenidos relevantes sin confundir fuentes especializadas en accesibilidad con canales de tecnología general.

## Principio editorial

La pertenencia a una sección no implica avalar todo lo que publica una fuente. TifloAcosta selecciona fuentes y contenidos por utilidad, actualidad, calidad y relevancia para su comunidad.

La separación entre accesibilidad y tecnología general debe ser explícita en interfaz, datos y criterios editoriales.

## Estructura pública

Dentro de «Escuchar y ver» / «Listen and watch» habrá dos bloques principales con encabezados semánticos independientes y enlaces de salto desde el inicio del apartado.

### 1. Accesibilidad y tiflotecnología

Contenido especializado en tecnología y accesibilidad para personas ciegas, sordociegas o con baja visión.

Temas habituales:

- VoiceOver, TalkBack, JAWS, NVDA y otros lectores de pantalla.
- iPhone, Android, Windows y Mac desde el punto de vista de accesibilidad.
- Braille, movilidad, OCR, visión artificial, IA accesible y productos de apoyo.
- Aplicaciones y servicios accesibles.
- Experiencias, tutoriales, entrevistas y noticias de la comunidad.

Fuentes candidatas ya identificadas para validación individual:

- Tiflo Audio.
- AppleVis Podcast.
- Arroba Sonora / CTI ONCE.
- AliBlueBox.
- Double Tap.
- Actualidad Accesible como fuente multimedia, sin reactivar automáticamente su web como fuente de Noticias.
- Comunidad Tiflotec.
- ACCYTEC.
- Android a Ciegas.
- JAWS con Windows.
- Juan Roca Suárez.
- Juanjo Montiel.
- Mi Android Accesible.
- Sin Ver Cómo.
- TifloDigitales.
- Otras fuentes especializadas que superen la validación editorial y técnica.

Una fuente especializada puede aportar la mayoría de sus publicaciones cuando sean pertinentes, pero siguen aplicándose límites por fuente y filtros de calidad para evitar monopolios o ruido.

### 2. Actualidad tecnológica

Contenido de tecnología general que no se presenta como especializado en accesibilidad.

Debe mostrarse una explicación visible y accesible equivalente a:

> Estos canales no están especializados en accesibilidad. Se incluyen porque ofrecen información tecnológica de interés general que puede ayudar a mantenerse al día.

Temas prioritarios:

- Apple, Android, Windows y ecosistemas móviles/escritorio.
- Inteligencia artificial.
- Nuevos dispositivos y sistemas operativos.
- Cambios importantes en aplicaciones y servicios.
- Innovaciones tecnológicas con posible impacto práctico para la comunidad TifloAcosta.

Fuentes candidatas iniciales:

- La Manzana Mordida.
- La Manzana Azteca, tratada dentro de su fuente real si pertenece a un podcast o programa mayor, no como canal independiente salvo que exista una fuente estable propia.
- Otros canales tecnológicos potentes que se validen posteriormente.

En esta sección la selección será deliberadamente más estricta. Se excluyen de forma preferente:

- rumores sin base suficiente;
- vídeos puramente promocionales o comerciales;
- ofertas sin interés editorial;
- entretenimiento tecnológico sin impacto práctico;
- contenido repetitivo que ya esté cubierto por fuentes mejores.

## Navegación y accesibilidad

La interfaz debe mantener la prioridad de accesibilidad ya adoptada por TifloAcosta.

Requisitos:

- H1 para la página Actualidad.
- H2 para «Escuchar y ver».
- H3 para «Accesibilidad y tiflotecnología» y «Actualidad tecnológica», salvo que la jerarquía final de la página requiera un nivel equivalente coherente.
- Cada pieza multimedia tendrá un encabezado propio por debajo del encabezado de su sección.
- Enlaces de salto para ir directamente a Noticias, Apps, Accesibilidad/tiflotecnología y Tecnología general.
- Navegación completamente operable con teclado y lectores de pantalla.
- Regiones de estado discretas con `aria-live="polite"` solo cuando sean necesarias.
- Ningún autoplay.
- Botón o enlace de retorno siempre disponible cuando se abra una vista interna.
- Restauración de foco al elemento que abrió una vista interna.

## Modelo de datos

Los contenidos multimedia deben vivir en un archivo separado del feed de Noticias y del catálogo de Apps, por ejemplo `actualidad-media.json`.

Cada elemento lógico debe contener como mínimo:

- `id`: identificador estable.
- `type`: `audio` o `video`.
- `section`: `accessibility` o `technology`.
- `sourceId`.
- `sourceName`.
- `sourceUrl`.
- `originalUrl`.
- `originalLanguage`.
- `publishedAt`: fecha original real cuando exista.
- `title`.
- `summary` o descripción breve.
- `mediaUrl` cuando exista una URL estable de reproducción oficial/directa.
- `embedUrl` cuando proceda y esté permitido.
- `platform`: `youtube`, `podcast`, `audio`, `web` u otra categoría técnica útil.
- `categories`: etiquetas temáticas.

Cuando TifloAcosta adapte título o resumen al otro idioma, la adaptación será natural y no literal. La adaptación del texto no debe sugerir que el audio o vídeo original está traducido o doblado.

## Idioma

La interfaz se mostrará en español o inglés según la preferencia actual de TifloAcosta.

Para cada pieza:

- se indicará claramente el idioma original del audio o vídeo;
- el título y resumen pueden tener adaptación bilingüe cuando la pieza sea suficientemente relevante;
- si solo existe texto en el idioma original, se mostrará sin inventar una traducción;
- nunca se afirmará que el medio tiene doblaje, subtítulos o traducción si la fuente no los ofrece realmente.

## Reproducción

### Audio directo

Si la fuente ofrece un archivo o reproductor estable y oficial que pueda integrarse legal y técnicamente:

- TifloAcosta puede ofrecer «Reproducir» dentro de la página;
- debe mantenerse también «Abrir en la fuente»;
- no habrá autoplay.

### YouTube

Cuando se trate de YouTube:

- se utilizará el reproductor oficial embebido cuando resulte estable y accesible;
- se ofrecerá siempre un enlace alternativo «Abrir en YouTube» o «Abrir en la fuente»;
- iniciar la reproducción debe requerir acción explícita del usuario.

### Fuentes sin reproducción integrable

Si la integración no es estable o no es apropiada:

- se mostrará la ficha editorial;
- el contenido se abrirá en su fuente original;
- no se copiará ni redistribuirá el archivo multimedia.

## Selección y diversidad

El sistema no debe convertirse en un agregador automático sin criterio.

Reglas:

- limitar el número de elementos consecutivos de una misma fuente cuando existan alternativas;
- priorizar actualidad, utilidad y diversidad de temas;
- evitar duplicados cuando varias fuentes hablen exactamente del mismo asunto sin aportar diferencias relevantes;
- permitir que una noticia o pieza excepcional pueda aparecer también en Destacadas si cumple la regla temporal y editorial de cinco días;
- la presencia en Multimedia no obliga a que el mismo contenido aparezca en Noticias.

## Fuentes y validación técnica

Cada fuente candidata deberá superar antes de activarse:

1. actividad reciente suficiente;
2. URL o feed estable;
3. posibilidad razonable de obtener título, enlace y fecha original;
4. contenido pertinente;
5. comportamiento técnico compatible con automatización o, si no, una estrategia manual claramente definida;
6. ausencia de duplicación excesiva con fuentes ya activas.

No se fingirá automatización donde no exista una fuente estable.

## Actualidad Accesible

La decisión anterior de no usar Actualidad Accesible como fuente automática de Noticias se mantiene.

Puede evaluarse y utilizarse como fuente multimedia si sus vídeos, audios o programas concretos resultan útiles. Esto no reabre automáticamente su incorporación al feed escrito.

## Separación respecto a TifloAcosta

El catálogo de vídeos propios de TifloAcosta permanece independiente.

Los vídeos propios:

- siguen viviendo en `videos.json` y su interfaz actual;
- no se mezclan como una fuente externa más dentro de Multimedia;
- tendrán su propio mecanismo de aviso automático cuando se implemente el disparador de OneSignal.

El problema de notificaciones de vídeos nuevos se tratará en una tarea independiente para no acoplar el sistema editorial multimedia con el sistema push.

## Error y degradación

Una fuente que falle no debe vaciar todo Multimedia.

El sincronizador debe:

- reintentar temporalmente fuentes fallidas;
- conservar las piezas válidas de otras fuentes;
- registrar qué fuentes fallaron;
- fallar de forma visible en validación de ramas cuando una fuente configurada como obligatoria deja de ser parseable;
- evitar publicar un archivo vacío por un fallo total accidental.

## Retención

Como criterio inicial, Multimedia puede conservar contenido durante 90 días, igual que Actualidad escrita, salvo que una fuente o tipo de contenido justifique posteriormente otra ventana.

Destacadas mantiene su regla separada de cinco días y utiliza siempre la fecha original de publicación.

## Automatización

La sincronización de Multimedia debe integrarse en las dos rutas existentes de despliegue de Actualidad:

- workflow específico de Actualidad;
- workflow general de GitHub Pages.

El contenido generado debe tratarse como contenido vivo por el service worker mediante una estrategia equivalente a network-first.

## Pruebas de aceptación

La implementación se considerará correcta cuando:

- la página distingue de forma inequívoca accesibilidad/tiflotecnología de tecnología general;
- La Manzana Mordida, si se activa, aparece solo en tecnología general;
- una fuente especializada nunca queda etiquetada como tecnología general por error;
- los lectores de pantalla pueden saltar directamente entre las secciones;
- los elementos indican el idioma original;
- no existe autoplay;
- cada pieza dispone de una forma accesible de abrir la fuente original;
- audio directo y YouTube siguen las reglas de reproducción definidas;
- una fuente fallida no elimina las demás;
- no se publican duplicados evidentes;
- el archivo multimedia se genera automáticamente antes del despliegue;
- el service worker no deja congelado el catálogo multimedia;
- el sistema no mezcla los vídeos propios de TifloAcosta con las fuentes externas;
- la suite completa del proyecto permanece en verde.

## Fuera de alcance de esta fase

- envío automático de notificaciones push por nuevos vídeos propios;
- descarga o redistribución de archivos multimedia de terceros;
- traducción o doblaje del audio/vídeo original;
- recomendadores personalizados;
- comentarios, valoraciones o cuentas de usuario;
- reproducción en segundo plano propia.
