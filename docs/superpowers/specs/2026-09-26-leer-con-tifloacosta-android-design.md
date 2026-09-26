# Leer con TifloAcosta — diseño arquitectónico Android

Fecha: 2026-09-26
Estado: diseño aprobado en conversación; pendiente de revisión del documento escrito antes del plan de implementación
Plataforma de referencia inicial: Android

## 1. Propósito

“Leer con TifloAcosta” será una sección propia de TifloAcosta para leer y escuchar contenido desde una biblioteca local accesible, sin depender de cuentas, servidores ni servicios de nube de TifloAcosta.

La experiencia debe ocultar en lo posible las diferencias de formato. El usuario entra en “Leer con TifloAcosta”, encuentra su biblioteca y dispone de las mismas ideas básicas con independencia de si abre un TXT, HTML, EPUB, DOCX, PDF con texto, DAISY o audiolibro: biblioteca, cola, progreso, marcas, búsqueda cuando exista texto, navegación estructurada cuando exista estructura, ajustes de lectura y copia portátil.

Android será la primera plataforma de referencia. La arquitectura se diseñará para que el núcleo de biblioteca y lectura pueda reutilizarse posteriormente en iOS, Windows y web/PWA, delegando en cada sistema operativo solo aquello que realmente dependa de la plataforma.

## 2. Criterios de éxito

La primera versión Android se considerará correctamente diseñada e implementada cuando permita, de forma accesible con TalkBack y usable visualmente:

- importar contenido compatible desde el selector de archivos de Android;
- recibir archivos compatibles mediante “Compartir con TifloAcosta”;
- mantener una copia privada e independiente de cada libro;
- abrir un título y recuperar de forma fiable su última posición;
- leer visualmente o mediante TTS los formatos textuales compatibles;
- reproducir audiolibros y DAISY sonoro en segundo plano;
- navegar por las unidades reales disponibles en cada formato;
- buscar palabras o frases cuando exista texto;
- crear y recuperar marcas;
- mantener una cola de lectura separada de la biblioteca;
- exportar e importar copias portátiles de la biblioteca sin borrar contenido existente;
- sobrevivir a cierres, reinicios, interrupciones y actualizaciones sin pérdida normal de libros, posiciones o marcas;
- funcionar con bibliotecas grandes sin cargar toda la colección o todo el documento en memoria;
- evitar permisos generales innecesarios sobre el almacenamiento;
- mantener privacidad local: ni el contenido ni las búsquedas ni las marcas deben salir del dispositivo por funciones propias de TifloAcosta.

## 3. Principios de producto

### 3.1 El formato no domina la experiencia

El usuario no tendrá que elegir un “lector EPUB”, un “lector PDF” o un “reproductor DAISY” separado. Cada formato tendrá un adaptador, pero todos alimentarán un modelo común.

### 3.2 Biblioteca local, sin cuenta

No habrá inicio de sesión, sincronización propia ni servidor de biblioteca. Los libros, posiciones, marcas e historial de lectura se guardarán localmente.

### 3.3 Importar significa copiar

Al importar un archivo, TifloAcosta crea su propia copia dentro del almacenamiento privado de la aplicación. Mover o borrar después el original no rompe la biblioteca.

Eliminar un libro de TifloAcosta elimina únicamente la copia privada y sus datos asociados. Nunca elimina el archivo original externo.

### 3.4 Accesibilidad como comportamiento base

La semántica, etiquetas, foco, lectura con TalkBack y soporte de texto grande no son complementos opcionales. Son requisitos del flujo principal.

### 3.5 El usuario conserva el control

No se inicia audio automáticamente al abrir un libro. No se abre automáticamente el siguiente libro al terminar. No se elimina contenido por antigüedad o falta de uso. No se reanuda audio por sí solo después de una llamada o interrupción del sistema.

## 4. Alcance de la primera versión Android

### 4.1 Formatos de lectura

La primera versión tendrá como objetivo:

- HTML;
- TXT y texto plano;
- EPUB sin DRM;
- DOCX;
- PDF con texto accesible o extraíble;
- DAISY 2.02;
- DAISY 3;
- audio en MP3, M4A, M4B, AAC, OGG, Opus, FLAC y WAV;
- ZIP como contenedor de importación para DAISY o audiolibros multipista;
- paquete portátil de copia de biblioteca de TifloAcosta.

Un formato de audio no se declarará compatible solo porque Android pueda reproducirlo técnicamente. Debe verificarse también posición, pausa/reanudación, velocidad, segundo plano y recuperación.

### 4.2 Fuera de alcance inicial

No forman parte de la primera versión:

- OCR automático de PDF escaneado;
- antiguo formato binario DOC;
- edición de documentos;
- notas personales asociadas a las marcas;
- carpetas o colecciones creadas por el usuario dentro de la biblioteca;
- sincronización mediante cuenta o nube propia;
- DRM o sistemas protegidos que requieran eludir controles de acceso;
- ejecución de macros, scripts, objetos OLE u otros elementos activos de documentos;
- descompresión recursiva de ZIP dentro de ZIP;
- descripción automática por IA de imágenes sin texto alternativo.

La arquitectura debe permitir añadir capacidades posteriores sin rehacer biblioteca, cola, marcas, progreso o copia portátil.

## 5. Contexto actual del repositorio

La aplicación Android existente está construida sobre Capacitor y ya utiliza puentes nativos propios registrados desde `MainActivity.java`, entre ellos guardado, compartir, actualización y acceso web específico.

El manifiesto Android actual permite recibir externamente `text/plain` mediante `ACTION_SEND`, pero no constituye todavía un receptor general de documentos, audio o selección múltiple.

El manifiesto actual también permite copia automática de la aplicación (`android:allowBackup="true"`). La implementación de “Leer con TifloAcosta” deberá impedir que los libros y audiolibros privados dependan de esas copias automáticas del sistema. La copia oficial y portátil de la biblioteca será la función explícita de exportación de TifloAcosta.

El diseño seguirá el patrón ya existente: núcleo compartido donde sea razonable y adaptadores/plugins nativos para capacidades Android que lo requieran.

## 6. Arquitectura seleccionada

Se adopta una arquitectura híbrida.

### 6.1 Núcleo común

El núcleo de “Leer con TifloAcosta” será responsable de:

- biblioteca;
- cola;
- estados de lectura;
- posiciones;
- progreso;
- marcas;
- búsqueda;
- navegación lógica;
- ajustes generales y excepciones por documento;
- formato común de copia y restauración;
- interfaz común del lector;
- modelo común de contenido.

### 6.2 Adaptadores por formato

Cada formato traduce su contenido al modelo común. El resto de la aplicación no debe conocer los detalles internos de DOCX, EPUB, DAISY, PDF o M4B.

### 6.3 Servicios nativos Android

Android aportará las funciones que dependen realmente del sistema:

- selector de archivos;
- recepción de archivos compartidos;
- almacenamiento privado;
- TTS y enumeración de voces;
- servicio multimedia de reproducción;
- controles de pantalla bloqueada y auriculares;
- audio focus e interrupciones;
- trabajos de segundo plano;
- consulta de espacio disponible;
- integración con destinos externos de exportación.

### 6.4 Alternativas descartadas

No se adoptará una arquitectura exclusivamente web para el lector Android porque importación compleja, almacenamiento privado, audio de fondo, TTS, media controls y recepción de archivos dependen de capacidades nativas.

Tampoco se crearán lectores nativos independientes por formato. Eso duplicaría biblioteca, progreso, marcas, accesibilidad y mantenimiento.

## 7. Modelo lógico de biblioteca

Cada libro o documento es un único elemento lógico de biblioteca, aunque físicamente esté compuesto por muchos archivos.

Un elemento debe poder almacenar, como mínimo:

- identificador interno único;
- huella de contenido para detectar duplicados;
- título;
- autor;
- idioma cuando esté disponible;
- formato;
- ubicación interna privada;
- tamaño ocupado;
- fecha de importación;
- fecha de última lectura;
- estado: No leído, En lectura o Leído;
- porcentaje general;
- posición principal;
- estructura interna: capítulos, secciones, páginas, pistas u otras unidades;
- pertenencia y orden en cola;
- marcas;
- excepciones de ajustes propias del documento;
- metadatos relevantes para recuperación e integridad.

El nombre de archivo no será la identidad del libro.

## 8. Estados y cola

La biblioteca contiene todo lo importado.

La cola contiene referencias ordenadas a elementos de la biblioteca; nunca copias duplicadas.

Estados disponibles:

- No leído;
- En lectura;
- Leído.

La pertenencia a la cola es independiente del estado.

Un libro se marca automáticamente como Leído solo al alcanzar su final real. No se utilizará un umbral arbitrario como 95 %.

Al llegar al final:

- se anuncia “Fin del documento”;
- el libro pasa a Leído;
- se elimina de la cola si estaba en ella;
- se conserva en la biblioteca;
- se conservan sus marcas;
- puede ofrecerse “Siguiente: [título]”, volver a la cola o cerrar;
- nunca se abre automáticamente el siguiente título.

El usuario puede posteriormente marcar el libro como No leído o añadirlo otra vez a la cola.

## 9. Pantalla de biblioteca

Orden conceptual de la pantalla:

1. Buscar en la biblioteca.
2. “Continuar leyendo: [título]” cuando exista un libro recientemente abierto en estado En lectura.
3. Acceso a Cola de lectura.
4. Importar.
5. Filtros.
6. Ajustes.
7. “Mi biblioteca”.
8. Lista paginada.

“Continuar leyendo” muestra solo el último libro abierto que siga En lectura. Otros títulos En lectura se encuentran mediante el filtro correspondiente, ordenados por actividad reciente.

La biblioteca mostrará 10 títulos por página.

Cada elemento presenta:

- título como control principal que abre el libro;
- autor si existe;
- estado/progreso breve;
- un único botón secundario “Opciones de [título]”.

Las opciones secundarias incluyen, según proceda:

- añadir/quitar de cola;
- cambiar estado;
- información;
- cambiar el título de presentación sin alterar el archivo original;
- eliminar de la biblioteca.

Filtros iniciales:

- Todos;
- En lectura;
- No leídos;
- Leídos;
- Formato.

Ordenación disponible dentro del panel de filtros:

- título;
- autor;
- importación reciente;
- lectura reciente.

## 10. Importación Android

### 10.1 Entrada desde la propia app

“Importar” abrirá el selector de documentos de Android. Se admitirán uno o varios archivos cuando el tipo lo permita.

No se pedirá acceso general al almacenamiento. El usuario elige expresamente qué archivos entrega a TifloAcosta.

### 10.2 Entrada desde otras apps

“Compartir con TifloAcosta” utilizará el mismo motor de importación.

Android deberá aceptar los tipos compatibles mediante los intents adecuados para archivo individual y selección múltiple. La ampliación del manifiesto y del puente nativo sustituirá la limitación actual de `text/plain` como única recepción externa.

### 10.3 Proceso transaccional

La importación tiene tres zonas conceptuales:

1. Entrada temporal.
2. Biblioteca definitiva.
3. Datos y metadatos.

Flujo:

1. recibir o seleccionar;
2. copiar provisionalmente a almacenamiento privado;
3. identificar tipo real;
4. comprobar espacio;
5. validar estructura;
6. calcular identidad/huella de contenido;
7. comprobar duplicados;
8. extraer metadatos esenciales;
9. procesar estructura necesaria;
10. mover a ubicación definitiva;
11. registrar en base de datos;
12. limpiar temporales.

Un libro solo aparece como válido cuando la operación ha finalizado correctamente.

Si falla o se cancela, se eliminan los temporales y la biblioteca queda sin cambios visibles.

### 10.4 Duplicados

Los duplicados se detectan por identidad de contenido, no solo por nombre.

Si el mismo contenido ya existe, no se crea otra copia por defecto. Se informa “Este libro ya está en tu biblioteca” y se ofrece abrirlo o cancelar.

### 10.5 Resultado de importación

Al completar:

- Abrir ahora;
- Añadir a la cola;
- Cerrar.

En los tres casos el elemento ya queda incorporado a la biblioteca.

### 10.6 Selección múltiple de documentos normales

Cuando se seleccionen muchos documentos independientes, se importarán de forma independiente y se presentará un resumen final en lugar de abrir un diálogo por cada archivo.

## 11. Almacenamiento privado

El contenido de la biblioteca se guardará en el almacenamiento privado de la aplicación.

No habrá una carpeta pública que otras aplicaciones puedan modificar directamente.

La organización física puede variar en implementación, pero conceptualmente cada libro tendrá una carpeta privada propia y una entrada independiente en la base de datos.

Los datos de biblioteca no se mezclarán indiscriminadamente con el contenido original. La base de datos mantendrá estados, progreso, marcas, cola y ajustes.

La eliminación de un elemento borra:

- copia privada del contenido;
- progreso;
- marcas;
- ajustes particulares;
- pertenencia a cola;
- datos reconstruibles relacionados.

Nunca toca el original externo.

## 12. Base de datos local

Se utilizará una base de datos local robusta, no un único JSON monolítico.

La consulta de biblioteca será paginada y filtrada desde la base de datos. No se cargarán todos los títulos para renderizar una sola pantalla.

Las marcas se almacenarán separadamente y relacionadas con su libro.

La cola mantendrá referencias ordenadas a identificadores de biblioteca.

Los procesos secundarios podrán mantener una tabla o registro de trabajos pendientes: indexación, análisis, extracción de metadatos, mantenimiento u otras tareas reconstruibles.

Las operaciones que cambien varios estados relacionados deberán realizarse de forma transaccional.

## 13. Modelo común de contenido

Todos los adaptadores textuales producirán un modelo común capaz de representar, cuando existan:

- texto;
- frases;
- párrafos;
- encabezados y niveles;
- capítulos y secciones;
- listas y niveles;
- tablas;
- enlaces;
- imágenes y texto alternativo;
- notas al pie/notas finales;
- referencias de página reales;
- bloques citados;
- referencias internas estables;
- relaciones entre texto y audio cuando el formato las proporcione.

El modelo común debe permitir que búsqueda, TTS, navegación, marcas y progreso funcionen sin reanalizar cada formato por separado.

## 14. Posición y progreso

Cada libro tiene una posición principal.

### 14.1 Texto

La posición textual combina:

- capítulo o encabezado cercano;
- bloque semántico;
- unidad interna cuando sea útil;
- huella o fragmento textual de respaldo;
- porcentaje aproximado.

### 14.2 Audio

La posición es:

- pista;
- tiempo exacto;
- porcentaje global del libro.

### 14.3 DAISY

Se utilizará la referencia estructural/sincronizada más estable proporcionada por el formato, más respaldos textuales o temporales cuando tengan sentido.

### 14.4 Recuperación

Si una referencia exacta deja de existir tras una transformación compatible, se intentará recuperar mediante encabezado, fragmento textual o porcentaje antes de volver al principio.

## 15. Navegación

Unidades posibles según el formato:

- frase;
- párrafo;
- encabezado;
- capítulo;
- sección;
- página real;
- pista;
- marcas;
- resultados de búsqueda.

La navegación por línea no será una unidad central porque depende de ancho, fuente, zoom, dispositivo y lector de pantalla.

Los botones Anterior/Siguiente deben reflejar la unidad actual en su nombre accesible, por ejemplo:

- “Párrafo anterior”;
- “Párrafo siguiente”;
- “Encabezado anterior”;
- “Capítulo siguiente”.

El índice jerárquico se presentará con controles nativos sencillos, expandibles/contraíbles cuando sea necesario, evitando un árbol ARIA complejo si empeora la experiencia con TalkBack.

## 16. Búsqueda dentro del documento

La búsqueda textual es requisito de primera versión para formatos con texto.

Debe permitir:

- palabra o frase;
- número total de coincidencias;
- contexto alrededor del resultado;
- capítulo/encabezado cercano cuando exista;
- resultado anterior/siguiente;
- salto al resultado;
- reproducir desde un resultado;
- “Volver a la lectura”.

La búsqueda es inicialmente una consulta temporal y no destruye la posición principal.

Solo si el usuario decide continuar leyendo desde el resultado, ese punto pasa a ser la nueva posición principal.

En documentos grandes el índice de búsqueda se construirá progresivamente. La lectura no debe quedar bloqueada esperando la indexación completa.

Audio sin texto o transcripción no ofrece búsqueda de palabras.

## 17. Marcas

Crear una marca será una acción directa.

Tipos iniciales:

- Marcador;
- Importante;
- Revisar;
- Cita.

Cada marca almacena:

- libro;
- tipo;
- posición específica del formato;
- referencia legible, por ejemplo capítulo/encabezado o pista/tiempo;
- fragmento de texto cercano cuando exista.

Funciones:

- Mis marcas;
- salto directo;
- marca anterior;
- marca siguiente;
- filtro por tipo;
- orden natural dentro del libro.

No habrá campo de nota personal en la primera versión.

## 18. Pantalla del lector

La pantalla debe mantener el contenido como elemento dominante y ocultar controles secundarios hasta que se necesiten.

Controles conceptuales principales:

- Reproducir/Pausa;
- Anterior/Siguiente según unidad;
- Navegación;
- Buscar;
- Marcas;
- Estado de lectura;
- Voz y velocidad;
- Ajustes visuales;
- Más opciones.

Al abrir un libro no se inicia sonido automáticamente.

Si hay una posición guardada:

1. se restaura;
2. se coloca el contenido en ese punto;
3. se anuncia de forma breve la posición/progreso;
4. el foco queda en “Reproducir”.

El detalle de los anuncios podrá configurarse en Accesibilidad, pero nunca se permitirá desactivar semántica esencial o etiquetas de controles.

## 19. Estado de lectura

“Estado de lectura” permite consultar en cualquier momento:

- capítulo/sección cuando exista;
- porcentaje;
- tiempo restante estimado para texto leído por TTS;
- tiempo reproducido/restante en audio;
- pista y duración en audiolibros.

El tiempo restante en texto es una estimación basada en contenido pendiente y velocidad de TTS. En audio es directamente medible.

## 20. Ajustes generales y por documento

Regla principal: cualquier cambio realizado dentro de un documento afecta solo a ese documento. Solo los cambios hechos en los ajustes generales modifican los valores por defecto.

Los ajustes particulares se guardan como excepciones. Si se restablecen, el documento vuelve a heredar los generales.

Los cambios se guardan de inmediato; no habrá un botón “Guardar”.

### 20.1 Ajustes de Leer con TifloAcosta

Secciones:

- Lectura y voz;
- Reproducción;
- Navegación;
- Ajustes visuales;
- Biblioteca;
- Copias de seguridad;
- Accesibilidad;
- Restablecer ajustes.

“Restablecer ajustes” no borra libros, posiciones ni marcas.

Cada documento tendrá “Restablecer ajustes de este documento”.

## 21. Ajustes visuales

Deben contemplar al menos:

- tamaño de texto;
- tipografía;
- peso/negrita;
- interlineado;
- espaciado de párrafos;
- ancho o márgenes de lectura;
- colores de fondo y texto;
- alto contraste;
- tema claro/oscuro/sistema;
- alineación cuando proceda;
- vista de lectura limpia.

La interfaz también debe respetar el tamaño de texto del sistema y no romperse con escalado grande.

## 22. TTS Android

El TTS utilizará motores y voces que Android exponga a las aplicaciones.

No se ofrecerá un motor propio en nube ni se requerirá cuenta o suscripción de TifloAcosta.

### 22.1 Comportamiento

Al pulsar Reproducir, TTS comienza desde la posición común del lector.

La síntesis se alimentará en unidades manejables, principalmente frases y párrafos, conservando referencias estructurales. No se enviará un capítulo gigantesco de una sola vez ni se sintetizará palabra por palabra.

La posición visual y la posición hablada son la misma posición lógica.

Si el usuario se desplaza visualmente y pulsa Reproducir, TTS comienza allí. Si pausa TTS, la lectura visual continúa desde esa posición.

### 22.2 Voces

La selección de voz mostrará voces realmente disponibles, agrupadas de forma comprensible por idioma/nombre cuando sea posible.

La voz global se cambia en ajustes generales. Una voz elegida dentro de un libro solo afecta a ese libro.

Cambiar de voz durante la lectura pausa, cambia y continúa desde el mismo punto.

“Conseguir más voces” avisará de que el usuario sale de TifloAcosta y abrirá el mecanismo del sistema o proveedor cuando sea posible. Al regresar, se refresca la lista de voces.

No se afirmará que la app puede usar exactamente la voz configurada en TalkBack; solo utilizará voces que Android exponga a TTS de aplicaciones.

### 22.3 Idiomas

El idioma principal del libro guía la voz. Fragmentos correctamente marcados en otros idiomas podrán utilizar una voz compatible cuando el sistema lo permita, sin inventar cambios de idioma por mera heurística insegura.

### 22.4 Interrupciones

Ante llamada u otra pérdida relevante de audio focus:

- pausar;
- guardar posición;
- no reanudar automáticamente.

Al desconectar auriculares:

- pausar inmediatamente para evitar reproducción inesperada por altavoz.

## 23. Audio y audiolibros

Audio es un formato de primera clase dentro de la misma biblioteca.

### 23.1 Archivo único

Un MP3, M4A, M4B u otro formato compatible se importa como un único elemento.

Si contiene capítulos reales, se exponen. Si no, no se inventan.

### 23.2 Varios archivos

Ante selección de varios audios se pregunta:

- Un solo audiolibro;
- Archivos independientes;
- Cancelar.

Si se agrupan, el orden se obtiene por:

1. número de pista/metadatos;
2. nombre de archivo;
3. revisión manual cuando siga siendo ambiguo.

Un audiolibro multipista es un solo elemento lógico.

### 23.3 Controles

- Reproducir/Pausa;
- retroceder;
- avanzar;
- pista/capítulo anterior;
- pista/capítulo siguiente;
- velocidad;
- estado;
- marcas;
- temporizador.

El intervalo de salto tendrá un valor general configurable, con opciones prácticas como 10, 30 o 60 segundos. Un cambio dentro del libro es particular de ese libro.

### 23.4 Temporizador

Opciones iniciales:

- 15 minutos;
- 30 minutos;
- 45 minutos;
- 60 minutos;
- al terminar el capítulo o pista.

Al expirar se pausa y se guarda posición.

### 23.5 Segundo plano y controles del sistema

La reproducción utilizará un servicio multimedia Android adecuado para continuar con pantalla bloqueada y otra aplicación en primer plano.

La pantalla bloqueada y auriculares deberán controlar al menos Reproducir/Pausa. Se expondrán saltos o anterior/siguiente cuando encajen correctamente con los controles estándar de Android.

## 24. DAISY

Se contemplan DAISY 2.02 y DAISY 3.

La importación puede llegar como conjunto de archivos o ZIP válido.

Se extraerán, cuando existan:

- título/autor;
- índice;
- capítulos/secciones;
- niveles;
- páginas;
- texto;
- audio;
- sincronización texto/audio;
- duraciones.

### 24.1 DAISY solo texto

Se comporta como documento textual: lectura visual, TalkBack, TTS, búsqueda, marcas y navegación.

### 24.2 DAISY solo audio

Se comporta como audiolibro usando además su estructura real.

### 24.3 DAISY texto + audio

Texto y audio compartirán posición cuando el formato proporcione sincronización.

Si el usuario escucha y pausa, el texto queda en el mismo punto. Si se desplaza por texto y pulsa Reproducir, el audio comienza desde la referencia sincronizada disponible.

No se inventará sincronización cuando el libro no la proporcione.

Las páginas DAISY se conservarán cuando existan y se podrá navegar a ellas.

Los libros protegidos por mecanismos no compatibles no se forzarán ni se descifrarán indebidamente. Se mostrará un mensaje claro de incompatibilidad.

## 25. EPUB

Se priorizan EPUB reflowable sin DRM.

Se conservarán cuando existan:

- orden de lectura;
- capítulos/secciones;
- navegación;
- encabezados;
- listas;
- tablas;
- enlaces;
- notas;
- imágenes y texto alternativo;
- referencias de página;
- MathML/estructura útil;
- EPUB 3 Media Overlays.

No se ejecutarán scripts ni contenido activo del EPUB.

No se descargarán automáticamente recursos externos del libro.

Los enlaces internos permanecen en el libro. Los externos activan el aviso de salida de TifloAcosta.

EPUB de diseño fijo podrá ofrecer el contenido textual accesible que se pueda extraer, pero no se prometerá equivalencia completa con EPUB adaptable.

Media Overlays utilizará el mismo concepto de sincronización texto/audio que DAISY.

## 26. DOCX

DOCX se trata como documento de lectura, no de edición.

Se extraerán, cuando existan:

- título/autor/metadatos;
- encabezados reales;
- párrafos;
- listas y niveles;
- tablas;
- enlaces;
- notas al pie/finales;
- imágenes y texto alternativo;
- idioma;
- estructura para navegación y búsqueda.

No se inferirán encabezados únicamente por apariencia visual si el documento no los define estructuralmente.

En control de cambios, la primera versión priorizará el texto final: inserciones incluidas y texto eliminado omitido.

Comentarios y herramientas de revisión no formarán parte del flujo normal inicial.

Encabezados y pies repetidos se conservarán como información del documento pero no se repetirán de forma ruidosa dentro del flujo principal.

Macros y objetos activos no se ejecutan.

## 27. HTML y TXT

HTML conservará semántica útil: encabezados, párrafos, listas, enlaces, tablas y texto alternativo.

TXT se dividirá en párrafos y frases mediante segmentación lingüística razonable. No se inventarán encabezados o capítulos sin evidencia suficiente.

La navegación por línea no será estable ni prioritaria.

## 28. PDF

### 28.1 PDF etiquetado

Se aprovecharán estructura, orden de lectura, encabezados, párrafos, listas, tablas, enlaces, idioma y texto alternativo cuando estén disponibles.

### 28.2 PDF con texto pero sin estructura fiable

Se permitirá lectura, búsqueda, TTS, páginas, marcas y progreso, pero no se fingirá una jerarquía inexistente.

### 28.3 Maquetación compleja

Se respetará primero la estructura proporcionada por el PDF. Después podrán aplicarse heurísticas conservadoras para columnas y agrupación de texto.

Si el orden sigue siendo dudoso, se informará: “Este PDF no tiene un orden de lectura fiable.”

### 28.4 Páginas

Las páginas son una unidad real en PDF. Se ofrecerá navegación a página anterior/siguiente e “Ir a página”.

### 28.5 Tablas

Solo se presentarán como tablas estructuradas cuando exista suficiente información fiable. No se afirmará una estructura tabular inventada solo por disposición visual.

### 28.6 Encabezados y pies repetidos

Se intentarán detectar repeticiones claras para reducir ruido del flujo principal.

### 28.7 PDF escaneado

Si no hay texto reconocible, se informará de que el PDF contiene páginas escaneadas y no dispone de texto legible por el motor.

No habrá OCR automático en esta primera versión.

### 28.8 PDF con contraseña

Si el documento necesita contraseña para abrirse:

- se solicita en ese momento;
- no se guarda en biblioteca ni ajustes;
- si es incorrecta, se puede reintentar;
- si el contenido puede abrirse legítimamente tras introducirla, se procesa;
- si una protección impide el acceso legítimo, no se fuerza.

El original PDF se conserva en la biblioteca además de cualquier representación interna optimizada.

## 29. Contenido complejo

### 29.1 Tablas

Se conservan filas, columnas y encabezados cuando la fuente los proporcione.

TalkBack debe poder entender la estructura. Para tablas muy anchas podrá ofrecerse una vista simplificada por filas, sin destruir la representación estructurada original.

### 29.2 Enlaces

Se conserva texto y destino.

Enlace interno: salto dentro del documento.

Enlace externo: aviso antes de salir de TifloAcosta.

### 29.3 Imágenes

Si existe texto alternativo, se conserva y expone.

Si no existe, se indica de forma sencilla que hay una imagen sin descripción.

No se genera automáticamente una descripción por IA en la primera versión.

### 29.4 Notas al pie

Abrir una nota no debe destruir la posición principal. Se ofrece “Volver al texto” para regresar exactamente al punto de origen.

### 29.5 Listas

Se conservan niveles y semántica real.

### 29.6 Matemáticas

Se conservará MathML u otra estructura matemática accesible cuando esté disponible. La primera versión no intentará resolver por sí sola toda la accesibilidad matemática.

### 29.7 Elementos activos

Macros, formularios complejos, objetos incrustados o scripts no se ejecutan. Si existe texto estático extraíble de forma segura, podrá incorporarse.

Cualquier elemento complejo debe poder saltarse para no atrapar al usuario.

## 30. ZIP y paquetes grandes

ZIP es un contenedor de importación, no un elemento de biblioteca por sí mismo.

Casos admitidos:

- DAISY válido;
- colección coherente de audio como audiolibro;
- audio más recursos auxiliares normales del mismo libro.

Un ZIP con varios PDF/DOCX/EPUB independientes no será la vía inicial de importación masiva; se utilizará selección múltiple normal.

Si el contenido mezclado no puede interpretarse con seguridad como una obra, no se dispersa en la biblioteca.

### 30.1 Seguridad ZIP

Se comprobarán:

- número de entradas;
- tamaño comprimido;
- tamaño esperado y real descomprimido;
- espacio disponible;
- rutas internas;
- profundidad de carpetas;
- tipos de archivo;
- expansión desproporcionada.

Se impedirán rutas que escapen de la carpeta temporal y se contará el volumen real durante extracción.

No se procesará ZIP dentro de ZIP de forma recursiva en v1.

Tras importación correcta se elimina la copia ZIP temporal para evitar duplicación de espacio.

## 31. Límites de tamaño y espacio

No habrá un límite pequeño fijo visible para libros o audiolibros.

Antes de importar:

- se calcula o estima tamaño;
- se comprueba espacio libre;
- para ZIP se estima expansión;
- se reserva un margen razonable de seguridad.

Si no cabe, la importación se detiene antes de empezar.

Los límites de seguridad internos sí podrán bloquear archivos maliciosos o absurdos por número de entradas, profundidad o expansión.

## 32. Copia portátil

La biblioteca podrá exportarse a un único paquete versionado propio de TifloAcosta. La extensión visible concreta no es parte del contrato arquitectónico; el requisito es que sea un solo paquete reconocible, validable, portable y versionado.

El paquete podrá incluir:

- libros/documentos;
- audio;
- DAISY;
- metadatos;
- cola y orden;
- estados;
- posiciones;
- progreso;
- marcas;
- ajustes particulares;
- ajustes generales que tenga sentido trasladar;
- información de versión e integridad.

No será necesario incluir índices de búsqueda o cachés que puedan reconstruirse.

Opciones:

- Exportar biblioteca completa;
- Exportar selección.

Android abrirá su selector de destino para guardar localmente o en proveedores disponibles como Drive/OneDrive, sin que TifloAcosta dependa de ninguno de ellos.

## 33. Restauración y conflictos

Importar una copia nunca borra automáticamente la biblioteca existente.

Antes de modificar:

1. validar paquete;
2. comprobar versión;
3. comprobar integridad;
4. comprobar espacio;
5. comparar identidades de contenido;
6. construir plan de restauración.

Reglas:

- elemento inexistente: añadir;
- elemento idéntico sin datos nuevos: ignorar duplicado;
- marcas diferentes: combinar sin duplicar;
- solo una copia tiene progreso: conservarlo;
- un lado está Leído y el otro No leído: no degradar automáticamente el Leído;
- ajustes particulares diferentes: mantener por defecto los del dispositivo actual;
- cola: mantener orden actual y añadir al final los elementos importados que falten;
- dos posiciones principales diferentes: conflicto explícito.

Para una posición conflictiva se muestran ambas referencias y el usuario elige:

- Conservar posición actual;
- Usar posición de la copia.

Las marcas de ambos lados se conservan independientemente de la posición elegida.

Los conflictos no deben bloquear toda la restauración. Podrán resolverse después.

## 34. Privacidad

El contenido de la biblioteca es local.

TifloAcosta no enviará por funciones propias a servidores:

- libros;
- nombres de libros privados;
- palabras buscadas;
- fragmentos de texto;
- posiciones;
- marcas;
- historial de lectura.

La búsqueda se realiza localmente.

La TTS base utiliza voces del sistema local.

Cualquier telemetría o diagnóstico de la aplicación debe excluir el contenido de la biblioteca y los datos de lectura.

Las copias exportadas no tendrán contraseña propia en v1. La protección depende del destino elegido por el usuario.

Los libros/audiolibros privados se excluirán de copias automáticas del sistema cuando técnicamente sea posible. La copia oficial es la exportación explícita.

Debe existir una acción “Eliminar todos los datos de Leer con TifloAcosta”, con confirmación especialmente clara.

## 35. Seguridad

Principios:

- no ejecutar contenido activo de documentos;
- no cargar recursos externos automáticamente desde EPUB/HTML importado;
- validar MIME/extensión y estructura real;
- evitar directory traversal al extraer;
- proteger contra ZIP bombs;
- límites de recursos internos;
- procesar archivos grandes en streaming cuando sea posible;
- nunca almacenar contraseñas PDF;
- no eludir DRM o protecciones externas;
- no requerir permisos generales de almacenamiento sin necesidad.

## 36. Recuperación ante fallos

Las operaciones importantes tendrán estado explícito.

Ejemplo de importación:

- Preparando;
- Validando;
- Copiando;
- Procesando;
- Finalizando;
- Completada.

Solo “Completada” aparece como libro válido.

Al iniciar la app se limpiarán operaciones temporales incompletas o se reanudarán solo cuando exista un protocolo seguro para ello. En v1, una extracción ZIP incompleta se limpia y se reinicia desde cero.

El progreso se guarda:

- periódicamente durante reproducción;
- al pausar;
- al cambiar capítulo/pista;
- al abandonar lector;
- al pasar a segundo plano;
- ante interrupción del sistema;
- al expirar temporizador.

La lectura visual también actualiza progreso al avanzar significativamente y al salir.

## 37. Migraciones y consistencia

La base de datos tiene versión de esquema.

Las actualizaciones de la app migran la biblioteca existente en lugar de reiniciarla.

Antes de una migración importante podrá generarse una copia interna mínima de seguridad de los datos estructurados, sin duplicar todos los audiolibros.

Datos esenciales:

- contenido;
- posición;
- marcas;
- cola;
- estados;
- ajustes.

Datos reconstruibles:

- índices de búsqueda;
- cachés;
- miniaturas procesadas;
- otros temporales.

Un fallo reconstruible no debe tratarse como pérdida de biblioteca.

Cada libro puede verificarse de forma independiente. Un título dañado no inutiliza toda la biblioteca.

## 38. Estado de biblioteca

En Ajustes podrá existir “Estado de la biblioteca” y una acción “Comprobar biblioteca” para detectar:

- temporales huérfanos;
- importaciones incompletas;
- índices reconstruibles dañados;
- recursos internos faltantes.

No es una función que el usuario deba ejecutar de forma habitual.

Ninguna tarea automática borra libros válidos por antigüedad o falta de espacio.

## 39. Rendimiento y batería

La lectura inmediata tiene prioridad sobre trabajo secundario.

### 39.1 Primer plano

- abrir libro;
- mostrar posición;
- reproducir/pausar;
- navegar;
- crear marca;
- búsqueda cuando el índice esté listo;
- cambiar voz/velocidad/ajustes.

### 39.2 Segundo plano

- indexación;
- extracción secundaria de metadatos;
- análisis estructural no imprescindible para abrir;
- portadas;
- verificaciones;
- mantenimiento;
- procesamiento largo de importaciones cuando Android lo permita.

No habrá sincronización periódica ni escaneos continuos de la biblioteca.

Los trabajos secundarios deberán ser compatibles con las políticas de batería de Android y no mantener procesos vivos sin necesidad.

### 39.3 Memoria

No se renderiza un documento gigantesco completo si puede evitarse. Se utilizará una ventana alrededor de la posición actual.

No se cargan archivos enormes completos en memoria para calcular huellas; se usa streaming.

La biblioteca se consulta paginada.

Las imágenes grandes se procesan a tamaños adecuados para interfaz sin perder el original necesario para el documento.

## 40. Accesibilidad Android con TalkBack

### 40.1 Biblioteca

Orden de foco lógico:

- búsqueda;
- continuar leyendo cuando exista;
- cola;
- importar;
- filtros;
- ajustes;
- títulos.

Cada título es el control principal. Se evita obligar a pasar por muchos botones por elemento mediante “Opciones de [título]”.

Paginación con etiquetas explícitas:

- “Página anterior”;
- “Página siguiente”;
- “Página N de X”.

### 40.2 Lector

Al abrir un libro iniciado:

- anuncio breve de posición;
- foco en Reproducir;
- no mover continuamente el foco de TalkBack siguiendo el TTS.

El foco se mueve deliberadamente solo en acciones como:

- abrir libro;
- saltar a marca;
- seleccionar resultado;
- cambiar de capítulo mediante una acción del usuario.

### 40.3 Diálogos

El foco entra en el diálogo y permanece dentro hasta cerrarlo. Al cerrar, regresa al control que lo abrió.

Aplicable a:

- importación;
- eliminación;
- filtros;
- voz;
- restauración;
- conflictos.

### 40.4 Mensajes de estado

Mensajes como “Libro añadido a la cola” se anuncian sin robar el foco.

Los procesos largos no anuncian cada porcentaje. Se comunicarán cambios significativos y se permitirá consultar el progreso.

### 40.5 Controles disponibles

Si una función no existe para el formato actual, se oculta normalmente en lugar de llenar la interfaz de controles deshabilitados. Se mantendrá deshabilitada solo cuando su presencia aporte contexto necesario.

### 40.6 TalkBack y TTS

TalkBack sigue leyendo interfaz. TTS de TifloAcosta lee el libro.

Mientras TTS reproduce, no se emitirán anuncios constantes de progreso que se superpongan al texto.

### 40.7 Gestos

No habrá gestos propios obligatorios para operar funciones esenciales. Los controles normales deben funcionar primero con TalkBack.

## 41. Reproducción, interrupciones y auriculares

Un único concepto de reproducción se abstrae sobre distintos motores:

- texto → TTS;
- DAISY con audio → reproductor de audio;
- audiolibro → reproductor de audio.

Al abrir, nunca se reproduce automáticamente.

Ante desconexión de auriculares: pausa.

Ante pérdida relevante de audio focus: pausa y guardado.

Tras llamada/interrupción: no reanudar solo.

La reproducción de un audiolibro multipista sí avanza automáticamente entre pistas internas del mismo libro.

## 42. Copias automáticas del sistema

El contenido pesado y privado de “Leer con TifloAcosta” no debe depender de las copias automáticas Android.

La implementación deberá definir reglas de backup del sistema que excluyan la biblioteca de contenido cuando Android lo permita, manteniendo la exportación explícita como mecanismo portátil y controlado.

No se deshabilitarán a ciegas copias útiles de otros datos de la aplicación si pueden gestionarse con reglas de exclusión más precisas.

## 43. Procesamiento de documentos grandes

La importación mostrará estados comprensibles, por ejemplo:

- Analizando el archivo;
- Comprobando espacio disponible;
- Extrayendo contenido;
- Analizando el libro;
- Preparando la biblioteca;
- Importación completada.

Se podrá cancelar cuando sea seguro hacerlo.

La cancelación o fallo elimina temporales.

La indexación no bloquea la primera lectura si el contenido esencial ya está disponible.

## 44. Exportación y restauración en Android

Exportar utilizará el selector de creación de documento/destino del sistema.

Restaurar podrá iniciarse desde:

- Ajustes → Copias de seguridad → Importar copia;
- abrir/compartir un paquete TifloAcosta desde un proveedor externo cuando Android lo permita.

Ambos caminos usarán el mismo motor de restauración.

## 45. Mensajes de error

Los errores deben describir el problema del usuario, no excepciones técnicas internas.

Ejemplos:

- “No hay espacio suficiente para importar este libro.”
- “Este PDF contiene páginas escaneadas y no dispone de texto reconocible.”
- “Este libro utiliza un sistema de protección no compatible.”
- “Este PDF no tiene un orden de lectura fiable.”
- “No se ha importado el libro. No se ha modificado tu biblioteca.”
- “No se puede abrir este libro porque faltan archivos o están dañados.”

Los detalles técnicos, si se registran para diagnóstico, no deben incluir contenido privado del libro.

## 46. Portabilidad futura

El modelo común no debe contener rutas absolutas de Android como parte de la identidad portable.

La copia de biblioteca utiliza rutas relativas y referencias internas.

Servicios como TTS, file picker y media controls se representan mediante interfaces de plataforma. Una futura implementación iOS o Windows podrá sustituir esos adaptadores sin redefinir:

- biblioteca;
- cola;
- marcas;
- estados;
- copia portátil;
- modelo de contenido;
- navegación;
- búsqueda.

## 47. Secuencia de construcción prevista

La implementación se planificará por capas verificables, aunque la entrega beta reúna las funciones acordadas.

Orden previsto:

1. almacenamiento privado, base de datos e importación;
2. biblioteca y un formato textual sencillo;
3. motor común de texto, posición y navegación;
4. búsqueda y marcas;
5. TTS Android;
6. audio y servicio multimedia;
7. EPUB y DOCX;
8. PDF;
9. DAISY;
10. ZIP y audiolibros multipista;
11. exportación/restauración;
12. recuperación, migraciones, mantenimiento y pruebas completas.

Este orden es de desarrollo, no una promesa de publicar fases incompletas como producto final.

## 48. Pruebas mínimas antes de beta

### 48.1 Importación y biblioteca

Debe probarse:

- selector Android;
- compartir archivo individual;
- compartir múltiples archivos;
- duplicados;
- cancelación;
- cierre durante importación;
- poco espacio;
- eliminación sin afectar original;
- biblioteca de cientos y miles de registros.

### 48.2 Texto

Para HTML/TXT/DOCX/EPUB/PDF con texto:

- apertura;
- posición;
- navegación disponible;
- índice;
- búsqueda;
- volver de búsqueda a lectura;
- marcas;
- progreso;
- ajustes visuales;
- TTS desde posición exacta.

### 48.3 TTS

- play/pause;
- reanudación;
- cambio de voz;
- cambio de velocidad;
- excepciones por libro;
- sincronía visual/TTS;
- desconexión de auriculares;
- interrupción de audio;
- no auto-reanudación;
- cierre y recuperación.

### 48.4 Audio

- archivo único;
- multipista;
- orden;
- transición automática entre pistas;
- saltos temporales;
- velocidad;
- marcas;
- temporizador;
- segundo plano;
- bloqueo de pantalla;
- auriculares;
- posición exacta;
- fin real del libro.

### 48.5 DAISY

- DAISY 2.02;
- DAISY 3;
- solo texto;
- solo audio;
- texto + audio;
- páginas;
- navegación estructural;
- búsqueda con texto;
- sincronización cuando exista;
- ZIP DAISY;
- contenido protegido no compatible.

### 48.6 Copias

- exportación completa;
- selección;
- restauración a biblioteca vacía;
- restauración sobre biblioteca existente;
- deduplicación;
- combinación de marcas;
- conflictos de posición;
- copia dañada;
- falta de espacio;
- interrupción del proceso.

### 48.7 TalkBack

Todos los recorridos anteriores deben verificarse también sin depender de visión.

Especial atención a:

- orden de foco;
- nombres de botones dinámicos;
- encabezados;
- diálogos;
- retorno de foco;
- mensajes de estado;
- índice jerárquico;
- tablas;
- texto grande;
- ausencia de gestos obligatorios propios.

### 48.8 Estabilidad

Pruebas deliberadas:

- matar proceso durante lectura;
- reiniciar teléfono;
- interrumpir importación/restauración;
- bloquear/desbloquear;
- cambiar de aplicación repetidamente;
- desconectar auriculares;
- biblioteca grande;
- EPUB con muchas imágenes;
- documento textual enorme;
- audiolibro largo;
- DAISY con muchos archivos;
- ZIP grande.

## 49. Criterios de bloqueo para beta

No entrará en beta una compilación que tenga de forma reproducible alguno de estos defectos:

- pérdida de libros válidos;
- pérdida de marcas;
- pérdida frecuente de la posición;
- regreso habitual al principio de documentos;
- duplicados provocados por fallos de importación;
- audio que continúa inesperadamente tras desconexión/interrupción;
- pantallas que bloqueen o hagan impracticable TalkBack;
- necesidad de permisos generales de almacenamiento no justificados;
- libros incompletos visibles como importaciones válidas;
- restauraciones que borren silenciosamente contenido existente.

Defectos menores visuales o de refinamiento podrán evaluarse en beta siempre que no comprometan datos, accesibilidad o seguridad.

## 50. Matriz de archivos de prueba

Se mantendrá un conjunto controlado para regresión, como mínimo:

- HTML estructurado;
- TXT largo;
- EPUB bien estructurado;
- EPUB con imágenes;
- EPUB 3 con capacidades adicionales cuando exista muestra legal;
- DOCX con encabezados, listas, tablas, enlaces y notas;
- PDF bien etiquetado;
- PDF con texto mal estructurado;
- PDF a dos columnas;
- PDF escaneado sin texto;
- PDF con contraseña de prueba;
- DAISY 2.02;
- DAISY 3;
- audiolibro M4B con capítulos;
- audiolibro multipista MP3;
- ZIP DAISY;
- ZIP de audio;
- ZIP deliberadamente malformado para seguridad.

## 51. Decisiones cerradas

Este diseño fija expresamente:

- Android como primera plataforma de referencia;
- arquitectura híbrida con núcleo común y adaptadores nativos;
- biblioteca local sin cuenta;
- importación por copia privada;
- tres estados: No leído / En lectura / Leído;
- cola separada del estado;
- 10 títulos por página;
- “Continuar leyendo” muestra el último libro abierto en estado En lectura;
- no reproducción automática al abrir;
- no siguiente libro automático al terminar;
- posición y navegación comunes por modelo semántico;
- búsqueda temporal que no destruye la posición;
- marcas sin notas personales en v1;
- ajustes globales y excepciones por documento;
- voces TTS locales expuestas por Android;
- audio como formato de primera clase;
- DAISY 2.02/3;
- EPUB sin DRM;
- DOCX, no DOC en v1;
- PDF escaneado sin OCR en v1;
- PDF con contraseña solicitada sin almacenarla;
- formatos de audio iniciales: MP3, M4A, M4B, AAC, OGG, Opus, FLAC y WAV;
- ZIP como contenedor, no como libro;
- sin límite pequeño fijo de tamaño: manda espacio disponible y seguridad;
- copia portátil manual y versionada;
- restauración por fusión, no reemplazo;
- conflictos de posición decididos por el usuario;
- contenido de biblioteca excluido de copias automáticas del sistema cuando técnicamente sea posible;
- privacidad local del contenido y actividad de lectura;
- pruebas TalkBack obligatorias para cada flujo esencial.

## 52. Detalles deliberadamente reservados al plan de implementación

Las siguientes elecciones no cambian el contrato funcional ni la experiencia definida aquí y, por tanto, se resolverán en el plan técnico y durante la selección de dependencias:

- biblioteca concreta de base de datos/ORM Android;
- librerías concretas de parsing para EPUB, DOCX, PDF y DAISY;
- componente multimedia Android concreto, siempre que cumpla los requisitos de servicio de fondo, audio focus y media controls;
- algoritmo/hash concreto de identidad de contenido;
- extensión visible concreta del paquete de copia;
- intervalo exacto en segundos para guardado periódico, siempre que se mantengan también los guardados inmediatos definidos;
- umbrales internos de seguridad contra ZIP bombs y abuso de recursos;
- representación binaria/JSON/SQLite exacta del manifiesto de copia.

Estas decisiones deberán justificarse por compatibilidad, mantenimiento, licencia, accesibilidad, rendimiento y capacidad de prueba. No podrán contradecir los comportamientos establecidos en esta especificación.

## 53. Paso siguiente

Tras la revisión y aprobación de esta especificación escrita, el siguiente artefacto será un plan de implementación por tareas, dependencias, pruebas y puntos de verificación. No se iniciará la implementación de “Leer con TifloAcosta” antes de que ese plan sea revisado y el usuario elija el método de ejecución.
