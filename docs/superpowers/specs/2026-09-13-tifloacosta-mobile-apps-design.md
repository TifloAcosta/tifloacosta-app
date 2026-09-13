# TifloAcosta — Diseño de las aplicaciones oficiales iOS y Android

Fecha: 13 de septiembre de 2026

## 1. Objetivo

Crear aplicaciones oficiales de TifloAcosta para iOS y Android que no sean una simple web envuelta, sino una experiencia propia, accesible, rápida y silenciosa, con funciones nativas y un nuevo bloque de contenido vivo: Actualidad TifloAcosta.

La prioridad absoluta es la accesibilidad. Una persona que use VoiceOver, TalkBack u otro lector de pantalla compatible debe poder utilizar la aplicación de principio a fin con la misma autonomía que cualquier otra persona, sin adivinar dónde está, qué hace un control ni cómo regresar.

## 2. Arquitectura general

Se adopta una arquitectura híbrida con Capacitor.

- Un núcleo común HTML/CSS/JavaScript accesible sirve a iOS y Android.
- La carcasa, navegación básica y funciones nativas viajan dentro de la aplicación.
- El contenido cambiante se obtiene desde https://tifloacosta.com/.
- La aplicación conserva una copia local de la última información válida para que una caída temporal de red o servidor no deje una pantalla vacía.
- Las actualizaciones de App Store y Google Play se reservan para cambios de aplicación, funciones nativas o arquitectura.
- Los documentos, noticias, vídeos, categorías, fuentes y demás contenido podrán cambiar sin obligar a publicar una nueva versión en las tiendas.

La aplicación no cargará tifloacosta.com como una WebView sin más. La experiencia tendrá comportamiento, navegación y funciones propias.

## 3. Identidad

- Nombre público: TifloAcosta.
- Nombre bajo el icono: TifloAcosta.
- Identificador: com.tifloacosta.app.
- Se utilizará el símbolo actual de TifloAcosta adaptado a los requisitos de Apple y Google.

## 4. Principio de navegación

Regla central: una opción principal, una entrada. El detalle aparece después de entrar.

La pantalla principal debe ser un distribuidor limpio, no una página interminable con todos los controles internos de cada apartado.

La navegación debe ser limpia y silenciosa:

- Sin carruseles automáticos.
- Sin movimientos inesperados de foco.
- Sin avisos constantes de sincronización, conexión o actualización.
- Sin campos que reciban foco automáticamente.
- Sin controles internos de Podcast, Contacto o Configuración expuestos en portada.
- Cada pantalla secundaria debe tener una salida clara y accesible.

## 5. Pantalla principal

El orden inicial será:

1. Actualidad.
2. Buscar.
3. Biblioteca.
4. Favoritos.
5. Vídeos.
6. Libro.
7. Podcast.
8. Contacto y redes.
9. Configuración.

Actualidad es la única excepción a la regla de “una entrada y nada más”, porque es el contenido que puede cambiar muchas veces en un mismo día. En portada mostrará una pequeña selección de noticias recientes y una entrada clara para ver toda la actualidad.

El resto de apartados se presenta de forma compacta. Quien quiera Podcast entra en Podcast; quien quiera configurar entra en Configuración; quien quiera redes entra en Contacto y redes.

## 6. Actualidad TifloAcosta

Actualidad será un subsistema propio, diseñado para justificar visitas frecuentes a la aplicación y aportar un valor que no existe en la web actual.

### 6.1 Estructura inicial

#### Apple
- Actualidad Apple.
- Apps accesibles.

#### Android
- Actualidad Android.
- Apps accesibles.

#### Windows
- Actualidad Windows.
- Programas accesibles.

#### Lectores de pantalla
- JAWS.
- NVDA.

Cada lector tendrá su flujo separado para que un usuario de uno de ellos no tenga que recorrer noticias del otro.

#### Gafas inteligentes
- Productos disponibles.
- Proyectos y prototipos.

Se cubrirán Ray-Ban Meta y otras gamas relevantes, con especial atención a funciones útiles para personas ciegas o sordociegas: descripción del entorno, lectura, reconocimiento, IA multimodal, asistencia remota, navegación y uso manos libres.

#### Tecnología y accesibilidad
- Inteligencia artificial y accesibilidad.
- Nuevos proyectos e investigación.
- Ayudas técnicas y dispositivos.
- Braille y comunicación accesible.
- Movilidad, orientación y autonomía.
- Tecnología para personas sordociegas.
- Otras novedades de accesibilidad tecnológica.

Una noticia tecnológica general solo entra si puede responder con claridad a esta pregunta: “¿Qué aporta o qué puede cambiar esto para una persona ciega o sordociega?”.

### 6.2 Categorías flexibles

Estas categorías son la estructura inicial, no una estructura cerrada. Deben poder añadirse, retirarse o reorganizarse desde el servidor sin exigir una nueva versión de la app.

### 6.3 Una noticia, varias etiquetas

Una noticia existirá una sola vez en la base de contenido, aunque pueda aparecer en distintos apartados.

Ejemplo: una actualización de JAWS relacionada con Windows puede llevar las etiquetas Windows y JAWS. Se verá en ambos lugares sin duplicar el artículo.

## 7. Fuentes

Se utilizará una lista controlada de fuentes de confianza para publicación automática. Otras fuentes podrán servir para descubrir pistas, pero no para publicar automáticamente sin corroboración.

Fuentes principales previstas:

- Fuentes oficiales de Apple, Google, Microsoft, OpenAI, Meta y otros fabricantes relevantes.
- NV Access para NVDA.
- Freedom Scientific para JAWS.
- AppleVis para aplicaciones y accesibilidad en el ecosistema Apple.
- Accessible Android para aplicaciones Android y su comportamiento con lectores de pantalla.
- BuscaApps como fuente complementaria de aplicaciones y programas accesibles en varias plataformas.

Fuentes comunitarias o secundarias pueden descubrir candidatos, pero los datos importantes se contrastarán con la fuente oficial o con otra fuente fiable cuando exista.

## 8. Apps y programas accesibles

La aplicación no ocultará herramientas interesantes solo porque tengan defectos de accesibilidad.

Si una app o programa tiene mucho potencial, pero presenta barreras, se publicará con una advertencia clara y útil. El objetivo es que la persona sepa qué encontrará antes de instalar o comprar.

Las fichas podrán incluir, cuando los datos existan:

- Nombre.
- Plataforma.
- Para qué sirve.
- Precio o modelo de compra.
- Idiomas relevantes.
- Nivel de accesibilidad comunicado o verificado.
- Problemas conocidos.
- Lectores de pantalla con los que se ha probado.
- Motivos por los que puede ser interesante para la comunidad.
- Enlace oficial de descarga o tienda.
- Enlace a la fuente especializada cuando proceda.

Los datos estructurados pueden ser estables, pero el texto explicativo no seguirá una plantilla rígida.

## 9. “Leer en TifloAcosta” y fuente original

Cada noticia podrá ofrecer dos caminos:

- Leer en TifloAcosta.
- Abrir fuente original.

“Leer en TifloAcosta” será una versión propia, limpia y accesible del contenido esencial: sin anuncios, banners, menús, ventanas de cookies ni ruido de navegación.

No se copiarán artículos completos de terceros ni se limitará el sistema a quitar anuncios de una página. Se redactará contenido propio a partir de hechos contrastados, atribuyendo la fuente y manteniendo siempre el acceso al original.

La longitud dependerá de la importancia del asunto. Una noticia menor puede ser breve; un tema que lo merezca tendrá el espacio necesario para explicarlo bien.

## 10. Voz editorial Tony Acosta

Este requisito es innegociable.

Tony Acosta no es una IA y los textos no deben sonar como si lo fueran.

La voz de Actualidad debe ser reconocible incluso sin firma:

- Natural, humana y cercana.
- Profesional sin solemnidad.
- Clara, sin dar lecciones.
- Con humor o ironía cuando corresponda.
- Práctica: explicar qué cambia para la persona que está leyendo.
- Sin frases de fábrica ni estructuras repetidas.
- Sin una misma apertura, desarrollo y cierre aplicados a todos los artículos.
- Sin titulares inflados.
- Sin conectores repetidos ni conclusiones automáticas.

Cada noticia se escribirá desde cero según su contenido. Una noticia sobre Apple no tiene por qué tener el mismo ritmo que una de Windows, una ayuda técnica o una investigación sobre sordoceguera.

Prueba editorial interna: si, quitando título, categoría y firma, el texto podría haberse publicado exactamente igual en cualquier web tecnológica genérica, todavía no está terminado.

## 11. Publicación automática con filtros fuertes

La intervención manual de Tony debe ser excepcional, no obligatoria.

Pipeline previsto:

1. Detectar contenido nuevo.
2. Normalizar datos y eliminar duplicados.
3. Comprobar que la fuente está autorizada para publicación automática o exigir corroboración.
4. Valorar relevancia real para la comunidad.
5. Preferir fuente oficial cuando exista.
6. Separar hechos confirmados de interpretación.
7. Redactar una versión propia en voz TifloAcosta.
8. Ejecutar filtro anti-plantilla y anti-frases de IA.
9. Comparar estructura y estilo con publicaciones recientes para evitar textos demasiado parecidos.
10. Comprobar datos clave, enlaces, nombres, fechas, disponibilidad geográfica, idioma, precio y limitaciones cuando sean relevantes.
11. Publicar automáticamente solo con un nivel alto de confianza.

Si no se alcanza ese nivel de confianza, el sistema no debe fingir una versión de Tony. Puede conservar la noticia pendiente, mostrar únicamente la referencia original si procede o esperar a una mejor corroboración.

Cuando se detecte una anomalía, la corrección debe alimentar las reglas del sistema para reducir la probabilidad de repetirla.

## 12. Español e inglés

Actualidad tendrá versión española e inglesa.

No se hará traducción literal.

- El español se redactará como español natural.
- El inglés se redactará como inglés natural.
- Una fuente inglesa puede generar una versión española adaptada correctamente.
- Una fuente española puede generar una versión inglesa adaptada correctamente.
- Cuando una noticia sea relevante internacionalmente, podrá existir en ambos idiomas aunque la fuente original solo esté en uno.

Las fuentes pueden diferir entre idiomas cuando sea conveniente.

## 13. Actualización y estabilidad de lectura

El servidor consultará las fuentes con frecuencia configurable. El objetivo es que Actualidad pueda cambiar varias veces al día sin necesidad de actualizar la aplicación.

La interfaz no se reordenará debajo de una persona que está leyendo.

- Al abrir Actualidad se presenta una lista estable.
- Si llegan noticias nuevas mientras la persona lee, no se mueve el foco ni se cambia el orden en vivo.
- Las novedades aparecerán al volver a entrar o mediante una actualización voluntaria.

## 14. Buscar

Habrá un único buscador global.

Desde “Buscar” se consultarán, cuando corresponda:

- Biblioteca y documentos.
- Actualidad.
- Vídeos.
- Apps y programas accesibles.
- Contenido sobre lectores de pantalla.
- Gafas inteligentes.
- Otros contenidos indexables de TifloAcosta.

No habrá un buscador distinto para documentos y otro para vídeos.

Los resultados podrán agruparse por encabezados accesibles: Actualidad, Biblioteca, Vídeos, Aplicaciones, etc.

Los filtros serán opcionales y no se exigirán antes de escribir una búsqueda.

Al regresar desde un resultado, el foco vuelve al resultado de origen.

## 15. Favoritos

Favoritos será global y local al dispositivo en la primera versión.

Podrán guardarse distintos tipos de contenido, entre ellos documentos, noticias, vídeos y fichas de aplicaciones o programas cuando corresponda.

Dentro de Favoritos se podrán separar por tipo sin obligar a mantener listas independientes.

No habrá cuenta de usuario ni sincronización entre dispositivos en la primera versión.

## 16. Podcast

En la portada habrá una sola entrada: Podcast.

Las plataformas no se expondrán una detrás de otra en la pantalla principal.

Al entrar en Podcast aparecerán las plataformas disponibles, como Spotify, Apple Podcasts, iVoox, Podimo o radio.es.

La arquitectura permitirá incorporar en el futuro una lista de episodios obtenida por RSS, pero no es requisito de la primera versión.

## 17. Contacto y redes

En portada habrá una sola entrada: Contacto y redes.

WhatsApp, correo, Instagram, Facebook y demás opciones aparecerán únicamente después de entrar.

No se añadirá por ahora un botón específico para sugerir noticias o fuentes. Quien quiera proponer algo ya dispone de los canales habituales de contacto.

## 18. Configuración

En portada habrá una sola entrada: Configuración.

Los controles internos solo aparecerán al entrar. Allí se gestionarán preferencias como:

- Idioma.
- Tamaño del texto.
- Contraste.
- Espaciado.
- Texto reforzado.
- Estado y acceso a configuración de notificaciones cuando corresponda.

En la app oficial no habrá instrucciones para “instalar la app” ni un botón propio para actualizarla; App Store y Google Play gestionarán las actualizaciones de aplicación.

## 19. Funciones nativas de la primera versión

1. Notificaciones nativas.
2. Enlaces profundos.
3. Compartir con el menú nativo del sistema.
4. Descargar o guardar archivos mediante mecanismos del sistema.
5. Comportamiento nativo de Volver/Atrás.
6. Apertura inteligente de apps externas.
7. Favoritos y preferencias persistentes.

Quedan para una fase posterior:

- Descargas y lectura offline avanzadas.
- Siri, Atajos, App Intents y equivalentes Android.
- Spotlight o búsqueda de sistema.
- Acciones rápidas avanzadas.

## 20. Enlaces profundos y notificaciones

Se utilizará https://tifloacosta.com/ como sistema público de enlaces.

- Con la app instalada, Universal Links en iOS y App Links en Android abrirán el contenido directamente dentro de TifloAcosta.
- Sin la app, el mismo enlace abrirá la web.
- OneSignal se mantendrá para notificaciones, integrado de forma nativa.
- No se pedirá permiso para notificaciones en el primer segundo de uso. Primero se explicará con claridad y la persona decidirá.
- Rechazar notificaciones no degradará la app ni provocará insistencia.

Si una persona llega por un enlace profundo externo, la primera acción Volver dentro de ese flujo llevará a Inicio de TifloAcosta antes de expulsarla de la aplicación.

## 21. Accesibilidad y foco

- Controles con nombre, rol y estado correctos.
- Encabezados semánticos reales.
- Orden lógico de lectura y foco.
- Al abrir una pantalla, foco en su encabezado principal.
- Al cerrar un diálogo, regreso al control que lo abrió.
- Al regresar desde un contenido, regreso al resultado o elemento de origen.
- Las búsquedas anunciarán el número de resultados sin robar el foco.
- Las actualizaciones silenciosas no moverán el foco.
- Ninguna operación importante dependerá solo de gestos visuales.
- Compartir, archivos, permisos y notificaciones utilizarán controles del sistema siempre que sea posible.

Una función con una barrera grave de lector de pantalla no se publica hasta corregirla.

## 22. Inicio, conexión y caché

- Sin pantalla decorativa de espera si no es necesaria.
- Apertura directa a la pantalla principal.
- Comprobaciones de conectividad y contenido en segundo plano.
- Última versión válida del contenido conservada localmente.
- Un fallo de actualización no sustituirá contenido válido por una pantalla vacía.
- Mensajes de error claros y breves.
- Sin anuncios repetitivos de “actualizado”, “conectado” o “sincronizado”.

## 23. Privacidad y permisos

Principio: pedir el mínimo posible.

No se solicitarán ubicación, contactos, cámara, micrófono, fotos o acceso amplio al almacenamiento salvo que una función futura concreta lo necesite.

La notificación será el permiso explícito principal de la primera versión.

Los selectores de archivo del sistema se utilizarán para que el usuario elija destino sin conceder acceso general al almacenamiento.

No se añadirá seguimiento publicitario ni perfiles de usuario.

## 24. Beta y criterios de salida

Las versiones beta se probarán con personas reales y con niveles técnicos diferentes.

Debe haber pruebas con:

- VoiceOver en iPhone.
- TalkBack en Android.
- Otros lectores de pantalla Android cuando sea posible.

No se publicará la primera versión si fallan flujos esenciales:

- Abrir la app.
- Recorrer Inicio.
- Entrar y salir de cada bloque.
- Buscar.
- Abrir un resultado y regresar.
- Leer Actualidad.
- Abrir fuente original.
- Guardar favoritos.
- Compartir.
- Descargar.
- Abrir una notificación.
- Abrir un enlace profundo.

## 25. Publicación iOS y Android

El desarrollo se hará en paralelo.

No se retendrá una plataforma si la otra tarda más en revisión.

La membresía de Apple Developer está actualmente en proceso de activación tras la compra. Google Play Console se completará cuando Tony disponga temporalmente de un dispositivo Android físico apropiado para la verificación.

## 26. Criterio de éxito

La aplicación debe sentirse como TifloAcosta y no como una página web metida dentro de una app.

Debe ser posible abrirla varias veces al día y encontrar valor nuevo en Actualidad, mientras Biblioteca, Vídeos, Libro, Podcast y el resto permanecen ordenados y fáciles de alcanzar.

La experiencia debe ser rápida, clara, silenciosa y reconocible por su voz editorial y por su accesibilidad.
