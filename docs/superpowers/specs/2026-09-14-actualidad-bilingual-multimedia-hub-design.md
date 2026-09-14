# TifloAcosta — Diseño de Actualidad bilingüe, apps y multimedia

Fecha: 14 de septiembre de 2026

## Propósito

Evolucionar Actualidad TifloAcosta desde un agregador de noticias hacia un centro de actualidad tiflotecnológica con tres carriles coordinados: noticias y artículos, aplicaciones accesibles y contenido multimedia. El sistema debe priorizar relevancia, actualidad, accesibilidad y diversidad de fuentes, y debe garantizar que el contenido realmente importante esté disponible tanto en español como en inglés con redacción natural.

Este diseño amplía y, donde se indique, sustituye criterios del diseño compartido de Actualidad del 13 de septiembre de 2026.

## Principios editoriales

- Accesibilidad por encima de todo.
- Relevancia antes que cantidad.
- El idioma de la fuente no decide si una información merece entrar.
- Una noticia o pieza realmente potente debe estar disponible en español y en inglés.
- Las adaptaciones no serán traducciones mecánicas: deberán sonar naturales en cada idioma y conservar fielmente los hechos.
- La fecha válida es la fecha de publicación original, no la fecha en que TifloAcosta descubre, sincroniza o adapta el contenido.
- La procedencia debe permanecer siempre visible y enlazada.
- TifloAcosta no copiará artículos completos de terceros; publicará síntesis y adaptaciones propias cuando corresponda.
- El sistema debe evitar duplicados, repetición excesiva de una misma fuente y ruido informativo.
- No se utilizará contenido antiguo para rellenar artificialmente zonas destinadas a actualidad inmediata.

## Estructura pública

Actualidad tendrá cuatro vistas relacionadas:

1. **Destacadas**: selección de máxima actualidad e interés.
2. **Noticias**: noticias, artículos, análisis y novedades tecnológicas relevantes.
3. **Apps accesibles**: descubrimiento y novedades de aplicaciones y programas accesibles.
4. **Escuchar y ver**: podcasts, programas de audio, vídeos, entrevistas, demostraciones y otros contenidos multimedia.

Las cuatro vistas compartirán el mismo modelo de categorías, búsqueda y procedencia. Un mismo asunto puede aparecer en más de una categoría, pero no debe duplicarse como si fueran contenidos diferentes.

## Destacadas: regla estricta de cinco días

Destacadas representa lo rabiosamente actual.

- Solo puede contener piezas cuya publicación original tenga como máximo cinco días de antigüedad.
- Al comenzar el sexto día desde la publicación original, la pieza deja automáticamente de estar destacada.
- La pieza no se elimina del sistema: continúa disponible en Noticias, Apps o Multimedia según corresponda, dentro del periodo general de conservación.
- No se rellenará Destacadas con contenido de más de cinco días para alcanzar un número fijo.
- Puede haber menos de cinco destacadas si no existen suficientes piezas de gran interés durante la ventana temporal.
- La prioridad editorial puede decidir el orden entre piezas que todavía estén dentro de la ventana de cinco días.
- La página principal podrá mostrar hasta cinco destacadas, pero nunca incumplirá la regla temporal.

## Modelo bilingüe

El idioma de la interfaz y el idioma de la fuente quedan desacoplados.

Cada pieza importante se considera un único contenido lógico con variantes localizadas:

- idioma original;
- versión española;
- versión inglesa;
- fuente original y URL original únicas;
- fecha original única;
- categorías y tipo de contenido compartidos.

Reglas:

- Si una pieza importante nace en inglés, se conserva su referencia original y se genera una adaptación natural al español.
- Si una pieza importante nace en español, se conserva su referencia original y se genera una adaptación natural al inglés.
- La interfaz española muestra la versión española de las piezas seleccionadas como importantes.
- La interfaz inglesa muestra la versión inglesa de esas mismas piezas.
- El sistema no debe ocultar una pieza importante simplemente porque su fuente original esté en el otro idioma.
- El contenido de menor interés puede permanecer como descubrimiento o enlace a la fuente sin obligar a producir una adaptación completa.
- Ninguna adaptación debe inventar información que no esté respaldada por la fuente original o por fuentes adicionales fiables.

La adaptación bilingüe forma parte del flujo editorial posterior a la selección. La traducción no debe ejecutarse indiscriminadamente sobre todo lo que llegue de los feeds.

## Flujo editorial

El proceso se divide en cinco etapas:

1. **Descubrimiento**: los conectores detectan contenido nuevo en fuentes configuradas.
2. **Normalización y deduplicación**: se unifican fechas, URLs, títulos, categorías y tipos; se detectan duplicados.
3. **Selección**: se decide qué piezas tienen suficiente interés para TifloAcosta.
4. **Adaptación bilingüe**: las piezas seleccionadas como importantes reciben versiones naturales en español e inglés.
5. **Publicación**: se publican las variantes disponibles, se calcula si cumplen la ventana de Destacadas y se exponen a web y futuras apps.

El motor debe poder distinguir al menos estos estados:

- `discovered`: detectado, aún sin selección editorial;
- `source-only`: visible como referencia a la fuente, sin adaptación propia;
- `selected`: seleccionado para adaptación bilingüe;
- `adapted`: disponible editorialmente en español e inglés;
- `withheld`: descartado o retenido por falta de confianza, duplicidad o escaso interés.

Una pieza `selected` no debe presentarse como plenamente bilingüe hasta que ambas variantes estén disponibles.

## Tipos de contenido

El modelo común admite:

- `news`: noticia o artículo;
- `app`: aplicación, programa o actualización de software accesible;
- `audio`: podcast o programa de audio;
- `video`: vídeo, demostración, entrevista o programa audiovisual.

Los tipos comparten identificador lógico, fecha, fuente, categorías, variantes idiomáticas y estado editorial. Audio y vídeo añaden metadatos de reproducción.

## Fuentes: criterio y niveles

El catálogo de fuentes no se considera cerrado. Se mantendrá como un registro revisable y ampliable.

### Fuentes ya incorporadas o aprobadas como base

- AppleVis Apps.
- AppleVis Blog.
- NV Access / In-Process.
- Freedom Scientific.
- Accessible Android.
- CTI de la ONCE.
- Usable y accesible.
- Conticgo.

### Fuentes españolas que deben incorporarse y validarse

- TecnoConocimientoAccesible.
- ACCYTEC — Accesibilidad y Tecnología.
- NVDA en español.
- BuscaApps.

BuscaApps se tratará como fuente especializada de descubrimiento de aplicaciones, aunque no disponga de un RSS tradicional estable. Se podrá usar un parser específico sobre su listado de novedades y memoria de elementos ya vistos.

### Fuentes potentes que deben evaluarse

- Microsoft Accessibility.
- HumanWare.
- AccessWorld / American Foundation for the Blind.
- APH.
- fuentes oficiales de Google y Android relacionadas con accesibilidad.
- otras fuentes especializadas que demuestren actividad reciente, calidad y estabilidad.

### Regla de admisión

Antes de activar una fuente debe comprobarse:

- actividad razonablemente reciente;
- mecanismo de seguimiento estable o parser mantenible;
- valor específico para personas ciegas, sordociegas o usuarias de tecnología accesible;
- baja proporción de contenido irrelevante;
- posibilidad de deduplicar frente a otras fuentes;
- atribución y enlace original claros.

No se incorporará una fuente solo para aumentar el número total.

## Diversidad de fuentes

Las selecciones visibles deben evitar que una única fuente monopolice la portada.

- Destacadas prioriza interés y fecha, pero aplicará un límite razonable por fuente cuando existan alternativas equivalentes.
- Las listas generales pueden mostrar más entradas de una misma fuente, pero la ordenación debe mantener diversidad cuando sea posible.
- AppleVis Apps y AppleVis Blog se mostrarán como procedencias distintas, aunque pertenezcan al mismo sitio.

## Apps accesibles

Apps tendrá su propio flujo de descubrimiento.

Fuentes iniciales:

- AppleVis Apps;
- BuscaApps;
- Accessible Android cuando publique aplicaciones o novedades claramente relacionadas;
- otras bases o fuentes específicas que se validen más adelante.

Una app nueva no entra automáticamente como destacada. Debe tener interés suficiente por accesibilidad, utilidad, novedad o impacto para la comunidad.

La ficha podrá incluir:

- nombre;
- plataforma;
- fecha detectada/publicada;
- fuente;
- breve explicación accesible;
- categorías;
- enlace a la ficha original;
- enlace oficial de descarga cuando la fuente lo proporcione de forma fiable.

## Multimedia: «Escuchar y ver»

Actualidad incorporará una sección multimedia independiente pero integrada con categorías y búsqueda.

Candidatos iniciales a evaluar:

- AppleVis Podcast;
- Tiflo Audio;
- Arroba Sonora / CTI;
- Double Tap;
- AliBlueBox;
- canales y podcasts especializados en español o inglés que demuestren interés sostenido para la comunidad.

El catálogo multimedia será selectivo. No se importará automáticamente todo el historial de un canal o podcast.

### Reproducción

- No habrá reproducción automática.
- Para audio con URL directa o `enclosure` válido, TifloAcosta ofrecerá un reproductor HTML accesible dentro de la web/app.
- Para YouTube u otras plataformas que obliguen a usar reproductor oficial, se integrará el reproductor permitido por la plataforma cuando sea accesible; siempre se conservará también el enlace a la fuente.
- Los controles deben tener nombres claros para VoiceOver, TalkBack, JAWS y NVDA.
- El foco no debe saltar inesperadamente al iniciar o terminar una reproducción.
- Debe existir una salida clara para volver a Multimedia o Actualidad.
- Cuando haya transcripción original fiable, podrá enlazarse o mostrarse según derechos y disponibilidad.

### Idiomas en multimedia

No se fingirá que un audio o vídeo está doblado cuando no lo está.

- El medio se reproduce en su idioma original.
- TifloAcosta puede ofrecer título adaptado, resumen y explicación en español e inglés.
- La ficha indica claramente el idioma del audio o vídeo.
- Si existe una versión oficial en otro idioma, se podrá enlazar como variante.

## Categorías

Se mantienen las categorías actuales y podrán ampliarse sin romper el modelo:

- Apple;
- Android;
- Windows;
- JAWS;
- NVDA;
- apps accesibles;
- programas accesibles;
- gafas inteligentes;
- productos disponibles;
- proyectos y prototipos;
- tecnología y accesibilidad;
- IA y accesibilidad;
- Braille y comunicación accesible;
- movilidad y autonomía;
- sordoceguera.

Los filtros solo mostrarán categorías con contenido disponible en la vista actual, salvo que en el futuro se apruebe expresamente mostrar categorías vacías.

## Conservación y archivo

Se mantiene inicialmente una retención general de 90 días para el feed público de actualidad, salvo que una futura fase incorpore archivo histórico permanente.

Destacadas usa siempre la ventana independiente de cinco días.

Una pieza puede dejar de estar destacada sin desaparecer del feed general.

## Arquitectura de datos

El feed debe evolucionar desde registros separados únicamente por `lang` hacia contenidos lógicos con variantes localizadas. Una forma de referencia es:

```json
{
  "id": "stable-id",
  "type": "news",
  "sourceId": "applevis-blog",
  "sourceName": "AppleVis Blog",
  "sourceUrl": "https://www.applevis.com/blog",
  "originalUrl": "https://example.com/item",
  "originalLanguage": "en",
  "publishedAt": "2026-09-14T10:00:00Z",
  "categories": ["apple", "tecnologia-accesibilidad"],
  "editorialState": "adapted",
  "locales": {
    "es": {
      "title": "Título natural en español",
      "summary": "Resumen propio en español",
      "body": ""
    },
    "en": {
      "title": "Natural English title",
      "summary": "Original or adapted English summary",
      "body": ""
    }
  },
  "media": null
}
```

La forma exacta podrá ajustarse durante el plan de implementación, pero debe mantenerse el principio de una pieza lógica con dos variantes, no dos noticias independientes que puedan divergir.

## Compatibilidad y migración

La transición no debe romper la web pública ni las futuras apps.

- El nuevo lector debe poder consumir temporalmente elementos del formato anterior o existir una migración determinista.
- `actualidad.json` seguirá siendo el punto común de publicación salvo que el plan técnico justifique una versión nueva del feed.
- Las adaptaciones editoriales existentes no deben perderse.
- La rama de integraciones móviles nativas continúa aislada y no se mezclará ni fusionará como consecuencia de este trabajo.

## Accesibilidad de interfaz

- Encabezados semánticos reales.
- Filtros con etiquetas explícitas y estado anunciado de forma no intrusiva.
- Sin carruseles automáticos.
- Reproductores sin autoplay.
- Enlaces con nombres descriptivos.
- Botón o enlace de retorno claro en todas las vistas internas.
- No duplicar en voz información visual irrelevante.
- Las actualizaciones de datos no deben secuestrar el foco de lectura.

## Pruebas y aceptación

La implementación deberá cubrir al menos:

- una fuente inglesa importante aparece en español tras su adaptación y en inglés en la interfaz inglesa;
- una fuente española importante aparece en inglés tras su adaptación;
- una noticia de seis días no puede aparecer en Destacadas;
- una noticia de seis días sigue disponible en su sección general mientras esté dentro del periodo de conservación;
- Destacadas no se rellena con contenido antiguo;
- AppleVis Apps y AppleVis Blog se identifican por separado;
- BuscaApps puede detectar novedades sin duplicar elementos ya vistos;
- una sola fuente no domina la selección cuando existen alternativas equivalentes;
- audio directo puede reproducirse con controles accesibles y sin autoplay;
- vídeo integrado conserva un enlace alternativo a la fuente;
- el idioma original del audio/vídeo se anuncia claramente;
- ninguna sincronización mueve el foco de una persona que está leyendo;
- el fallo de una fuente no impide publicar el resto.

## Entrega por fases

La implementación se dividirá en fases para reducir riesgo:

1. Modelo lógico bilingüe y regla temporal de Destacadas.
2. Ampliación y validación del catálogo de fuentes, incluida BuscaApps.
3. Sección Apps accesibles.
4. Sección Multimedia y reproducción accesible.
5. Afinado editorial, diversidad, búsqueda y ajustes de experiencia.

Cada fase deberá mantener la web utilizable y verificable antes de avanzar a la siguiente.

## Decisiones explícitamente fuera de alcance por ahora

- Doblaje o traducción automática del audio de podcasts y vídeos.
- Importación masiva de históricos completos de canales.
- Reproducción automática.
- Cuentas de usuario o sincronización de favoritos entre dispositivos.
- Mezclar este trabajo con la rama móvil nativa todavía pendiente de pruebas manuales.
