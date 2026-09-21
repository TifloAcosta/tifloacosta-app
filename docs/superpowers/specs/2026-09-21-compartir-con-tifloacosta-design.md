# Diseño: Compartir con TifloAcosta en Android

Fecha: 2026-09-21

## 1. Objetivo

Añadir a la aplicación nativa de Android una entrada de sistema llamada **TifloAcosta** dentro de la hoja Compartir. El usuario podrá enviar a TifloAcosta un enlace o texto desde WhatsApp, navegador, correo u otra aplicación y obtener una respuesta accesible y predecible sin tener que copiar, cambiar de aplicación y pegar manualmente.

La intención principal es que TifloAcosta actúe como una puerta de entrada accesible a funciones que ya existen —reproductor de vídeo, Descargas y búsqueda— y a una nueva lectura limpia de páginas web.

El éxito de esta primera versión significa:

- TifloAcosta aparece como destino de Compartir para texto y enlaces.
- El usuario siempre sabe qué se ha recibido, qué propone hacer la aplicación y cómo volver.
- Los enlaces de YouTube se abren en el reproductor accesible de TifloAcosta. Solo si ese reproductor falla se ofrece la apertura en YouTube como salida de emergencia.
- Los enlaces claramente descargables se entregan al analizador existente de Descargas.
- Las páginas web normales se intentan presentar en una lectura limpia y navegable.
- El texto puro puede enviarse al buscador de TifloAcosta.
- Al terminar el flujo, TifloAcosta se envía al segundo plano mediante Android; cuando la aplicación de origen siga siendo la tarea anterior disponible, el usuario regresará a ella.

## 2. Alcance de la primera versión

### Incluido

- Android nativo.
- `ACTION_SEND` con texto y enlaces.
- Un único contenido compartido o texto que contenga uno o varios enlaces.
- Clasificación conservadora de YouTube, descargas conocidas, página web normal y texto puro.
- Reutilización del reproductor accesible de vídeos.
- Reutilización del analizador de Descargas.
- Reutilización del buscador general para texto puro.
- Nueva lectura limpia de páginas externas.
- Navegación interna entre enlaces útiles conservados por la lectura limpia.
- Historial temporal de esa navegación.
- Mensajes y foco diseñados para lectores de pantalla.
- Interfaz en español e inglés siguiendo el sistema de traducciones existente.

### Fuera de alcance

- Compartir archivos binarios directamente: PDF, DOCX, audio, imágenes u otros adjuntos.
- `ACTION_SEND_MULTIPLE` para archivos o lotes.
- iOS y Share Extension.
- Web Share Target para la PWA.
- Guardar automáticamente páginas, enlaces o historial.
- IA para clasificar o resumir contenido.
- Saltar muros de pago, autenticaciones o restricciones de acceso.
- Ejecutar scripts, formularios, iframes o código activo procedente de la página compartida.

## 3. Principios de experiencia y accesibilidad

El flujo debe ser temporal, sencillo y completamente comprensible con lector de pantalla.

Al entrar desde Compartir, el foco se coloca en un encabezado equivalente a **“Compartido con TifloAcosta”**. A continuación se informa de forma breve del contenido recibido y se presenta una acción principal con nombre explícito.

No se utilizarán botones ambiguos como “Aceptar”, “Continuar” o “Más” cuando se pueda indicar la acción real. Ejemplos:

- “Reproducir en TifloAcosta”.
- “Leer en modo accesible”.
- “Analizar descargas”.
- “Buscar en TifloAcosta”.
- “Volver a la página anterior”.
- “Cancelar y volver”.

Cuando no exista una clasificación suficientemente clara, la pantalla mostrará como máximo tres acciones posibles, además de “Cancelar y volver”. No se crearán menús extensos para resolver una duda del clasificador.

Las operaciones asíncronas usarán una región de estado accesible para mensajes como “Preparando lectura” o “Analizando enlace”. El foco no saltará mientras una operación esté en curso. Cuando aparezca un contenido nuevo, el foco irá al encabezado de ese contenido.

No habrá reproducción automática de vídeo, locuciones propias, sonidos de confirmación ni elementos que hablen encima del lector de pantalla.

La lectura limpia conservará estructura semántica útil: encabezados, párrafos, listas y enlaces. Las pruebas de accesibilidad no se limitarán a TalkBack; se comprobará también el comportamiento con otros lectores de pantalla de Android cuando estén disponibles, incluidos Jieshuo y AccessiMind.

## 4. Arquitectura

### 4.1 Recepción nativa de Android

`AndroidManifest.xml` registrará la aplicación como destino para `android.intent.action.SEND` con contenido textual. La primera versión no registrará recepción de archivos ni lotes.

Se añadirá un puente nativo propio, `TifloSharePlugin`, registrado junto a los plugins nativos actuales. Su responsabilidad será únicamente:

1. Leer el `Intent` inicial si la aplicación se abre desde Compartir.
2. Leer nuevos `Intent` recibidos mientras `MainActivity` ya existe (`singleTask`).
3. Normalizar el texto recibido y entregarlo a la capa Capacitor.
4. Exponer una acción nativa para finalizar el flujo de Compartir y devolver TifloAcosta al fondo de la pila de tareas mediante `moveTaskToBack(true)`.

El plugin no clasificará URLs, no descargará páginas y no decidirá qué función debe abrirse.

### 4.2 Obtención nativa de páginas

La obtención de HTML externo se aislará en un segundo puente nativo, `TifloWebFetchPlugin`, para no mezclar recepción de Intents con red.

Este componente:

- solo aceptará URLs `http` o `https`;
- permitirá como máximo 5 redirecciones;
- aplicará un tiempo máximo total de 15 segundos por solicitud;
- rechazará cuerpos superiores a 5 MiB;
- aceptará para lectura limpia `text/html`, `application/xhtml+xml` y `text/plain`;
- devolverá URL final, código de estado, tipo de contenido y cuerpo textual;
- no ejecutará JavaScript ni cargará la página en un WebView.

Estos límites pertenecen al diseño de la primera versión y podrán revisarse posteriormente solo si las pruebas reales muestran una necesidad concreta.

### 4.3 Flujo Compartir en Capacitor

La capa JavaScript tendrá una sesión efímera de Compartir separada de la navegación normal. La apertura habitual de TifloAcosta seguirá empezando en Inicio.

La sesión contendrá:

- texto original recibido;
- enlaces detectados;
- clasificación actual;
- historial temporal de páginas limpias;
- estado de carga o error.

Cada nuevo `ACTION_SEND` reemplaza completamente la sesión anterior. No se arrastrará contenido compartido de una entrada previa.

### 4.4 Clasificador

La clasificación será determinista y conservadora. No utilizará IA.

Orden de decisión:

1. Extraer URLs HTTP/HTTPS válidas del texto.
2. Si hay varias URLs, mostrar una lista accesible indicando cuántos enlaces se encontraron y permitir elegir uno.
3. Si la URL pertenece a YouTube o a una forma conocida de URL de YouTube, clasificar como vídeo.
4. Si coincide con un proveedor o patrón ya admitido por Descargas —por ejemplo Google Drive, Dropbox, OneDrive, MEGA, WeTransfer, MediaFire, pCloud o archivo directo— clasificar como descarga.
5. Cualquier otra URL HTTP/HTTPS se trata como página web candidata a lectura limpia.
6. Si no hay URL, tratar el contenido como texto y ofrecer “Buscar en TifloAcosta”.

Las URLs acortadas se resolverán mediante las redirecciones controladas del componente nativo. Tras obtener el destino final, la clasificación se ejecutará de nuevo.

Si una URL no puede validarse, TifloAcosta no intentará repararla de forma especulativa.

### 4.5 Adaptadores a funciones existentes

La nueva entrada no duplicará funciones actuales.

**Vídeos:** se extraerá la lógica reutilizable que reconoce el identificador de YouTube y abre el reproductor accesible para permitir vídeos externos al catálogo. El reproductor existente seguirá proporcionando controles de retroceso, reproducción/pausa, avance y cierre. Si el reproductor no puede preparar el vídeo, entonces se podrá ofrecer “Abrir en YouTube” como salida de emergencia.

**Descargas:** la sesión Compartir entregará la URL al flujo existente de “Descargar desde un enlace”, evitando crear un segundo analizador.

**Búsqueda:** el texto puro se precargará en el buscador general. No se ejecutará la búsqueda automáticamente; el usuario conservará la decisión de iniciarla.

Cuando estas funciones se abran desde una sesión de Compartir, conservarán ese contexto: cerrar el reproductor, retroceder desde Descargas o volver desde la búsqueda regresará al punto correspondiente de la sesión de Compartir, no a Inicio ni a la navegación ordinaria de TifloAcosta.

## 5. Lectura limpia de páginas externas

### 5.1 Obtención de la página

La descarga del HTML se realizará mediante `TifloWebFetchPlugin`, no mediante `fetch` del WebView y no mediante un servidor de TifloAcosta.

Motivos:

- evita bloqueos CORS propios del WebView;
- no envía al servidor de TifloAcosta las URLs privadas o sensibles que el usuario decida compartir;
- permite controlar tiempo, tamaño y redirecciones antes de entregar contenido a JavaScript.

### 5.2 Limpieza

El limpiador reutilizará y generalizará las ideas ya presentes en la extracción de Actualidad, pero estará aislado como componente propio para páginas arbitrarias.

La lectura mostrará como contexto el título y, cuando pueda determinarse, el nombre o dominio de la fuente, sin convertir ese dominio en un enlace de salida.

Se eliminarán de forma preferente:

- scripts, estilos y contenido ejecutable;
- cabeceras, pies y navegación global;
- publicidad y promociones;
- afiliados;
- botones de compartir y redes sociales;
- formularios;
- comentarios;
- newsletters;
- bloques de recomendación comercial;
- iframes y elementos incrustados no necesarios para leer.

Se conservarán cuando formen parte real del contenido:

- título;
- encabezados;
- párrafos;
- listas;
- enlaces HTTP/HTTPS a artículos, capítulos, recursos, secciones o contenidos concretos;
- índices de plataformas cuyo contenido principal sea precisamente una colección de enlaces útiles.

Se eliminarán como elementos interactivos los enlaces publicitarios, promocionales, de afiliación, navegación general o protocolos distintos de HTTP/HTTPS.

Los enlaces conservados deben presentar un texto comprensible. Si la página solo aporta un rótulo genérico y no existe información fiable para mejorarlo, se conservará el texto original en lugar de inventar un destino.

La lectura limpia normal no ofrecerá un botón “Abrir página original”. El usuario ya dispone del enlace original en la aplicación desde la que decidió compartirlo y puede regresar a ella finalizando la sesión.

### 5.3 Navegación limpia interna

Al activar un enlace útil conservado, el destino vuelve primero al clasificador general de la sesión.

- Si es YouTube, se abre el reproductor accesible.
- Si es una descarga conocida, se abre el analizador de Descargas.
- Si es otra página web, se obtiene y limpia dentro de la misma sesión.

La sesión mantendrá una pila de navegación para páginas limpias:

`Página compartida → Página 2 → Página 3`

El botón Volver retrocederá una página cada vez. Desde la primera página compartida, Volver finalizará la sesión de Compartir y enviará TifloAcosta al segundo plano para que Android muestre la tarea anterior disponible.

No se guardará este historial de forma permanente.

## 6. Tratamiento de errores y casos especiales

### Varios enlaces

Se anuncia el número encontrado y se muestra una lista accesible. Solo se procesa el enlace elegido. Al volver desde ese enlace, se recupera la lista dentro de la misma sesión.

### Sin conexión, timeout o servidor inaccesible

Se muestra un mensaje humano y breve con “Reintentar” y “Cancelar y volver”. No se deja un estado de carga indefinido.

### Lectura no fiable

Si no se obtiene suficiente contenido útil o el resultado no cumple los criterios mínimos de lectura, la aplicación no presenta basura como si fuese una lectura correcta. Informa de que no ha podido preparar una versión fiable y ofrece “Analizar descargas” y “Cancelar y volver”.

### Contenido protegido

Si la página exige autenticación, muestra un muro de pago o bloquea el acceso, TifloAcosta no intenta eludirlo. La sesión informa de que no puede preparar esa página y permite volver.

### Redirecciones

Se aceptan como máximo 5 redirecciones y solo destinos HTTP/HTTPS. Después de resolverlas se vuelve a clasificar el destino final.

### Tipo o tamaño no aceptable

`TifloWebFetchPlugin` rechazará respuestas fuera de los tipos textuales admitidos o superiores a 5 MiB. El rechazo producirá un mensaje accesible y controlado, nunca un bloqueo de la interfaz.

## 7. Seguridad y privacidad

Todo contenido remoto se considera no fiable.

- El HTML remoto nunca se inyectará directamente en el DOM de la aplicación.
- No se ejecutarán scripts procedentes del sitio.
- Solo se renderizará una representación construida por TifloAcosta a partir de elementos permitidos.
- No se descargarán archivos sin una acción explícita del usuario.
- La sesión de Compartir permanecerá en memoria y se descartará al terminar.
- No se registrarán por defecto las URLs compartidas en un historial permanente.
- No se enviarán al backend de TifloAcosta las URLs de lectura limpia en esta primera versión.
- Los redireccionamientos y protocolos se validarán antes de seguirse.
- La obtención nativa no reutilizará sesiones autenticadas del navegador ni intentará copiar cookies de otras aplicaciones.

## 8. Estado, foco y salida

El flujo Compartir tendrá un estado propio y no sustituirá permanentemente la pantalla en la que estuviera TifloAcosta antes de recibir el `Intent`.

Al finalizar o cancelar:

1. se destruye la sesión temporal;
2. se detiene cualquier reproductor o solicitud activa vinculada a ella;
3. se invoca la salida nativa del flujo;
4. Android coloca la tarea de TifloAcosta en segundo plano mediante `moveTaskToBack(true)` y muestra la tarea anterior disponible.

Normalmente esa tarea será la aplicación desde la que se invocó Compartir. Si Android ya no conserva esa aplicación como tarea anterior, el sistema mostrará la siguiente tarea disponible; TifloAcosta no intentará reconstruir artificialmente una aplicación de origen que el sistema haya eliminado.

Si TifloAcosta estaba ya abierta antes de recibir el contenido, su estado normal queda disponible cuando el usuario vuelva a abrirla posteriormente.

## 9. Componentes previstos

La implementación deberá mantener unidades pequeñas y comprobables de forma independiente. Los nombres definitivos podrán ajustarse al estilo del repositorio, pero las responsabilidades serán estas:

- `TifloSharePlugin`: recepción de `Intent` y salida de la sesión.
- `TifloWebFetchPlugin`: obtención segura y limitada de páginas externas.
- `share-session`: estado efímero e historial.
- `share-classifier`: extracción y clasificación de URLs/texto.
- `readable-page`: conversión segura de HTML a modelo de lectura.
- `share` screen: interfaz accesible del flujo.
- adaptador de vídeo externo: reutilización del reproductor actual.
- adaptador de Descargas: precarga de URL en el analizador existente.
- adaptador de búsqueda: precarga del texto en el buscador existente.

El componente de obtención de red y el limpiador permanecerán separados: uno obtiene datos no fiables y el otro decide qué parte puede convertirse en contenido visible.

## 10. Pruebas

### Unitarias

- extracción de una, varias o ninguna URL;
- reconocimiento de formatos habituales de YouTube;
- clasificación de proveedores de Descargas;
- rechazo de protocolos no HTTP/HTTPS;
- re-clasificación tras redirección;
- limpieza de publicidad, navegación, comentarios y scripts;
- conservación de encabezados, listas y enlaces editoriales útiles;
- retorno de enlaces conservados al clasificador general;
- historial interno de lectura limpia;
- reinicio completo de la sesión ante un nuevo contenido compartido.

### Integración Android/Capacitor

- aplicación cerrada + compartir URL;
- aplicación ya abierta + compartir URL;
- cancelar y volver a la tarea anterior;
- URL de YouTube externa al catálogo;
- fallo del reproductor de YouTube y aparición del escape a YouTube;
- proveedor de descargas;
- artículo normal;
- página índice con varios enlaces útiles;
- URL acortada;
- red sin conexión;
- timeout de 15 segundos;
- más de 5 redirecciones;
- autenticación o muro de pago;
- respuesta superior a 5 MiB o de tipo no textual.

### Accesibilidad manual

Para cada estado relevante se comprobarán:

- foco inicial correcto;
- orden de lectura lógico;
- nombres claros de botones y enlaces;
- anuncios de carga y resultado sin duplicados;
- ausencia de saltos inesperados de foco;
- navegación por encabezados, listas y enlaces en lectura limpia;
- comportamiento de Volver dentro del historial y al salir;
- ausencia de reproducción automática;
- pruebas con TalkBack y, cuando sea posible, Jieshuo, AccessiMind u otros lectores de pantalla usados por los probadores.

## 11. Criterios de aceptación

La primera versión se considera lista para probar cuando:

1. Android ofrece TifloAcosta como destino al compartir texto o una URL.
2. La pantalla de recepción es comprensible sin visión y sin depender de contexto visual.
3. YouTube llega al reproductor accesible con control del usuario.
4. Las URLs de descarga conocidas reutilizan el analizador existente.
5. Una página web legible produce una representación limpia sin ejecutar contenido remoto.
6. Los enlaces editoriales útiles conservados vuelven al clasificador y pueden continuar dentro del modo limpio cuando sean páginas web.
7. Volver recorre correctamente el historial limpio y desde la raíz termina la sesión.
8. Cancelar o terminar coloca TifloAcosta en segundo plano y Android muestra la tarea anterior disponible.
9. Los fallos de red, lectura o acceso no bloquean la interfaz ni dejan estados infinitos.
10. Ningún contenido compartido se guarda permanentemente sin una acción futura y explícita del usuario.
11. Las funciones reutilizadas desde Compartir regresan a la sesión de Compartir al cerrarse o retroceder, sin expulsar al usuario a Inicio.

## 12. Evolución posterior

Este diseño deja preparada, pero no implementa ahora, la ampliación a archivos compartidos, iOS Share Extension, guardado para después y nuevas acciones sobre vídeos. Esas ampliaciones deberán diseñarse como trabajos posteriores sin complicar la primera versión.