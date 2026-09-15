# Buscador global de TifloAcosta — Diseño

## Objetivo
Mantener un único buscador visible al principio de la pantalla principal y eliminar buscadores duplicados de secciones internas, empezando por Vídeos.

## Comportamiento acordado
- El buscador se muestra en Inicio, inmediatamente después de la cabecera principal y antes de “Secciones”.
- Busca en Recursos, vídeos del Canal TifloAcosta, noticias de Actualidad, Apps accesibles y “Escuchar y ver”.
- Los resultados se agrupan por tipo para que VoiceOver pueda recorrerlos con claridad.
- Cada resultado indica qué tipo de contenido es y ofrece un enlace directo al contenido o a su fuente.
- En Vídeos desaparecen el campo Buscar y el botón Limpiar búsqueda. Se mantienen únicamente ordenación, catálogo, reproductor y paginación.
- Los controles restantes de Vídeos conservan separación vertical suficiente para no quedar visualmente amontonados.
- El buscador y los textos asociados se localizan en español e inglés.
- No se duplican catálogos: se reutilizan `TIFLO_RESOURCES`, `videos.json`, `actualidad.json`, `actualidad-apps.json` y `actualidad-media.json`.

## Accesibilidad
- Formulario con etiqueta explícita y estado `aria-live` para anunciar número de resultados.
- Resultados agrupados bajo encabezados semánticos.
- Enlaces con nombres comprensibles fuera de contexto.
- No se altera el orden de navegación de las secciones principales ni el funcionamiento de VoiceOver.

## Implementación
La lógica transversal se concentra en `search-accessibility.js`, que ya se carga en Inicio y Vídeos. En Inicio, el script convierte el formulario existente en buscador global y lo mueve visual y semánticamente al principio. En Vídeos, elimina la búsqueda duplicada y conserva la ordenación. El código de búsqueda se mantiene en funciones puras exportables para poder probarlo con Node.
