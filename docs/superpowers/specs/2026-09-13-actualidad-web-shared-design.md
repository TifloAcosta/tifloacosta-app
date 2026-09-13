# TifloAcosta — Diseño compartido de Actualidad y portada limpia

Fecha: 13 de septiembre de 2026

## Objetivo

Llevar a la web pública de TifloAcosta, antes de que salgan las apps oficiales, dos decisiones ya aprobadas para la nueva experiencia: una portada limpia y silenciosa y un bloque vivo de Actualidad TifloAcosta. La web y las futuras apps deben consumir el mismo origen de datos de Actualidad para evitar mantener sistemas distintos.

## Principios

- Accesibilidad por encima de todo.
- Navegación limpia y silenciosa.
- Una opción principal, una entrada; el detalle aparece después de entrar.
- Sin carruseles automáticos, cambios inesperados de foco ni anuncios constantes de sincronización.
- Español e inglés naturales, no traducción literal.
- La web pública no debe romper funciones actuales mientras se construye la nueva estructura.

## Portada

La portada debe convertirse en un distribuidor compacto. El orden aprobado es:

1. Actualidad.
2. Buscar.
3. Biblioteca.
4. Favoritos.
5. Vídeos.
6. Libro.
7. Podcast.
8. Contacto y redes.
9. Configuración.

Actualidad es la única excepción: la portada puede mostrar una pequeña selección de noticias y una entrada para ver todo. Podcast, Contacto y Configuración no deben desplegar sus opciones internas en portada.

## Actualidad TifloAcosta

El contenido se almacena en un feed JSON común, publicado dentro de tifloacosta.com y consumible por web y apps.

Cada noticia debe tener un identificador estable, idioma, título, fuente, URL original, fecha de publicación, categorías y estado editorial. Una noticia existe una sola vez aunque tenga varias categorías.

Categorías iniciales:

- Apple: actualidad y apps accesibles.
- Android: actualidad y apps accesibles.
- Windows: actualidad y programas accesibles.
- Lectores de pantalla: JAWS y NVDA por separado.
- Gafas inteligentes: productos disponibles y proyectos/prototipos.
- Tecnología y accesibilidad: IA y accesibilidad, investigación, ayudas técnicas, Braille y comunicación, movilidad y autonomía, sordoceguera y otras novedades relevantes.

Una noticia tecnológica general solo entra si tiene impacto claro para personas ciegas o sordociegas.

## Fuentes

Se priorizan fuentes oficiales y especializadas fiables. La primera configuración debe admitir fuentes oficiales de fabricantes y proyectos relevantes, NV Access, Freedom Scientific, AppleVis, Accessible Android y BuscaApps. Fuentes comunitarias pueden servir para descubrir temas, pero una afirmación importante no se publica automáticamente sin respaldo suficiente.

## Estados editoriales

El feed admite tres estados:

- `source-only`: noticia detectada y suficientemente fiable para mostrar título, fuente, fecha y enlace original, pero todavía sin versión propia.
- `adapted`: existe una versión TifloAcosta original y accesible, redactada a partir de hechos contrastados.
- `withheld`: el sistema no tiene confianza suficiente y no muestra el contenido al público.

No debe aparecer el enlace “Leer en TifloAcosta” cuando no exista una adaptación aprobada. En ese caso solo se ofrece la fuente original.

## Leer en TifloAcosta

Una adaptación TifloAcosta no copia el artículo de origen. Explica los hechos con texto propio, atribuye la fuente, conserva el enlace original y usa la voz editorial aprobada: humana, cercana, práctica, sin plantillas repetidas ni frases de IA.

La longitud depende del asunto. Una noticia breve puede ser breve; un tema importante puede tener un desarrollo amplio.

## Actualización

La recogida de fuentes se ejecutará como automatización de GitHub Actions con una frecuencia inicial de una vez por hora. El intervalo queda concentrado en el workflow para poder ajustarlo después sin modificar las apps.

El proceso:

1. Recupera las fuentes configuradas.
2. Normaliza RSS/Atom y metadatos.
3. Calcula URL canónica e identificador estable.
4. Descarta duplicados.
5. Asigna categorías según la fuente y reglas declaradas.
6. Combina adaptaciones editoriales existentes cuando las haya.
7. Excluye contenidos `withheld`.
8. Escribe `actualidad.json` solo si el resultado cambia.

Una actualización nunca debe reordenar una lista que una persona está leyendo en ese momento. La web carga una fotografía estable al entrar; las novedades aparecen al recargar o volver a entrar.

## Portada de Actualidad

La portada puede mostrar hasta cinco noticias. La selección será configurable: una noticia con prioridad editorial explícita puede aparecer antes; en ausencia de prioridad, se usa la fecha de publicación. Esto evita fijar ahora una regla editorial rígida entre “lo último” y “lo más importante”.

## Búsqueda y favoritos

La nueva estructura debe preparar un buscador global que consulte documentos, Actualidad y vídeos desde una sola pantalla. Los resultados se agrupan con encabezados accesibles por tipo. Los favoritos deben evolucionar hacia referencias globales por tipo de contenido, sin cuentas de usuario en esta fase.

## Publicación incremental

Este trabajo se entrega en dos planes independientes:

1. Fundación compartida de Actualidad: feed, sincronización, página de Actualidad y lector accesible.
2. Portada limpia y navegación web: pantalla principal compacta, buscador global y entradas separadas para los apartados que hoy están desplegados en Inicio.

La rama se crea desde `main` para que la mejora web pueda publicarse sin arrastrar todavía la base móvil en desarrollo. Las apps consumirán después el mismo `actualidad.json` y podrán incorporar los cambios de esta rama cuando corresponda.
