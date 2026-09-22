# Diseño: lector limpio integrado y Compartir con TifloAcosta en Android

Fecha inicial: 2026-09-21
Revisión integrada: 2026-09-22

## 1. Objetivo

La nueva versión de Android no tratará la lectura limpia como una función exclusiva de **Compartir con TifloAcosta**. Se implementará un único lector limpio reutilizable por toda la aplicación y se conectará a tres entradas:

1. **Actualidad**: al activar el titular de una noticia, TifloAcosta abrirá esa noticia dentro del lector limpio.
2. **Buscar**: cada resultado conservará su identidad y abrirá exactamente el contenido seleccionado. Una noticia irá al lector limpio, un vídeo al reproductor accesible y un recurso a su destino concreto.
3. **Compartir con TifloAcosta**: una página compartida desde otra aplicación utilizará el mismo lector limpio cuando el enlace se clasifique como página web.

El objetivo es zanjar en una sola arquitectura el problema actual de Actualidad, la apertura imprecisa de resultados de búsqueda y la nueva entrada desde la hoja Compartir de Android.

El éxito de esta versión significa:

- Actualidad deja de limitarse a mostrar un resumen y una salida al navegador: el titular abre la noticia limpia dentro de TifloAcosta.
- Buscar deja de mandar al usuario a una sección genérica y abre el resultado exacto.
- TifloAcosta aparece como destino de Compartir para texto y enlaces.
- Las tres entradas reutilizan el mismo motor de clasificación, obtención y limpieza cuando corresponde.
- Los enlaces de YouTube se abren en el reproductor accesible de TifloAcosta. Solo si ese reproductor falla se ofrece YouTube como salida de emergencia.
- Los enlaces claramente descargables reutilizan el analizador de Descargas.
- Las páginas web normales se presentan, cuando sea posible, en una lectura limpia, semántica y navegable.
- El texto puro compartido puede precargarse en Buscar sin ejecutar una búsqueda automáticamente.
- El comportamiento de Volver y del foco depende del punto de entrada y siempre devuelve al usuario al contexto correcto.

## 2. Alcance de la versión

### Incluido

- Android nativo.
- Un lector limpio común para Actualidad, Buscar y Compartir.
- Titulares de Actualidad activables.
- Apertura exacta de resultados de Buscar.
- `ACTION_SEND` con texto y enlaces.
- Un único contenido compartido o texto que contenga uno o varios enlaces.
- Clasificación conservadora de YouTube, descargas conocidas, página web normal y texto puro.
- Reutilización del reproductor accesible de vídeos.
- Reutilización del analizador de Descargas.
- Reutilización del buscador general para texto puro.
- Navegación interna entre enlaces útiles conservados por la lectura limpia.
- Historial temporal de lectura cuando el usuario sigue enlaces desde una página limpia.
- Mensajes y foco diseñados para lectores de pantalla.
- Interfaz en español e inglés siguiendo el sistema de traducciones existente.
- Integración de las correcciones de mantenimiento de Actualidad y Buscar en la misma entrega que Compartir con TifloAcosta.

### Fuera de alcance

- Compartir archivos binarios directamente: PDF, DOCX, audio, imágenes u otros adjuntos.
- `ACTION_SEND_MULTIPLE` para archivos o lotes.
- iOS y Share Extension.
- Web Share Target para la PWA.
- Guardar automáticamente páginas, enlaces o historial.
- IA para clasificar, resumir o reescribir contenido.
- Saltar muros de pago, autenticaciones o restricciones de acceso.
- Ejecutar scripts, formularios, iframes o código activo procedente de una página remota.
- Sustituir el contenido editorial original por resúmenes generados.

## 3. Principios de experiencia y accesibilidad

La aplicación debe comportarse como un único producto, no como tres limpiadores distintos.

La lectura limpia conservará estructura semántica útil: título, encabezados, párrafos, listas y enlaces editoriales útiles. El contenido remoto nunca se presentará como un bloque plano si se dispone de estructura fiable.

No se utilizarán botones ambiguos como “Aceptar”, “Continuar” o “Más” cuando se pueda indicar la acción real. Ejemplos:

- “Leer noticia”.
- “Reproducir en TifloAcosta”.
- “Analizar descargas”.
- “Buscar en TifloAcosta”.
- “Volver a la página anterior”.
- “Cancelar y volver”.

Las operaciones asíncronas usarán una región de estado accesible para mensajes como “Preparando lectura” o “Analizando enlace”. El foco no saltará mientras una operación esté en curso. Cuando aparezca un contenido nuevo, el foco irá al encabezado del contenido.

No habrá reproducción automática de vídeo, locuciones propias, sonidos de confirmación ni elementos que hablen encima del lector de pantalla.

Las pruebas de accesibilidad no se limitarán a TalkBack; se comprobará también el comportamiento con el lector de pantalla que utilicen los probadores, incluidos Jieshuo, AccessiMind u otros cuando estén disponibles.

## 4. Arquitectura común

### 4.1 Separación entre entrada, clasificación y lectura

Las entradas Actualidad, Buscar y Compartir no implementarán su propia limpieza. Todas delegarán en componentes comunes con responsabilidades separadas:

- **entrada**: identifica qué contenido ha activado el usuario y desde dónde;
- **clasificador**: decide si el destino es vídeo, descarga, página web o texto;
- **obtención**: descarga de forma controlada el contenido textual remoto;
- **limpieza**: convierte HTML no fiable en un modelo semántico seguro;
- **presentación**: muestra ese modelo y gestiona Volver/foco según el contexto de entrada.

De este modo, cualquier mejora futura del limpiador beneficiará a Actualidad, Buscar y Compartir al mismo tiempo.

### 4.2 Obtención nativa de páginas

La obtención de HTML externo se aislará en `TifloWebFetchPlugin`.

Este componente:

- solo aceptará URLs `http` o `https`;
- permitirá como máximo 5 redirecciones;
- aplicará un tiempo máximo total de 15 segundos por solicitud;
- rechazará cuerpos superiores a 5 MiB;
- aceptará `text/html`, `application/xhtml+xml` y `text/plain`;
- devolverá URL final, código de estado, tipo de contenido y cuerpo textual;
- no ejecutará JavaScript ni cargará la página en un WebView;
- no utilizará cookies ni sesiones autenticadas del navegador.

### 4.3 Motor de lectura limpia

`readable-page` será un componente puro y compartido. Recibirá el texto obtenido por `TifloWebFetchPlugin` y producirá un modelo seguro compuesto solo por elementos permitidos.

El motor no conocerá si la página llegó desde Actualidad, Buscar o Compartir. Esa diferencia pertenece al controlador de navegación, no a la extracción.

### 4.4 Controlador de lectura

La navegación por contenido limpio se gestionará mediante un controlador común de lectura, independiente de `share-session`.

El controlador conocerá:

- URL solicitada;
- URL final tras redirecciones;
- página limpia actual;
- pila temporal de páginas limpias;
- estado de carga o error;
- contexto de origen necesario para regresar correctamente.

`share-session` podrá contener o referenciar este estado cuando la entrada sea Compartir, pero el lector limpio no dependerá de que exista una sesión Compartir.

## 5. Clasificación común de destinos

La clasificación será determinista y conservadora. No utilizará IA.

Orden de decisión para una URL:

1. validar que sea HTTP/HTTPS;
2. reconocer YouTube y sus formatos habituales;
3. reconocer proveedores y patrones admitidos por Descargas;
4. tratar cualquier otra URL HTTP/HTTPS como página candidata a lectura limpia.

Las URLs acortadas se resolverán mediante las redirecciones controladas del componente nativo. Tras obtener el destino final, la clasificación se ejecutará de nuevo antes de limpiar contenido.

Si una URL no puede validarse, TifloAcosta no intentará repararla de forma especulativa.

## 6. Actualidad

### 6.1 Apertura de la noticia

El propio titular de cada noticia será activable. La acción principal será abrir esa noticia dentro del lector limpio de TifloAcosta.

Flujo:

`Actualidad → titular → clasificador → obtención segura → lectura limpia`

Si la URL final redirige a un tipo reconocido distinto de página web, se respetará la clasificación final.

### 6.2 Fuente original

Cuando una noticia se abra desde Actualidad, **Abrir fuente original** podrá mantenerse como acción secundaria, nunca como la vía principal de lectura.

Si la extracción limpia falla, esa acción secundaria será una salida útil junto con “Reintentar” y “Volver”.

### 6.3 Volver y foco

Al volver desde la lectura limpia iniciada en Actualidad, se regresará a Actualidad y el foco intentará volver al titular que abrió la noticia.

## 7. Buscar

### 7.1 Identidad del resultado

Cada resultado deberá conservar suficientes datos para abrir exactamente el elemento elegido. Buscar no podrá reducir un resultado a una mera ruta de sección.

El contrato mínimo de un resultado incluirá su tipo, identificador estable cuando exista, URL/destino necesario y referencia al contenido concreto.

### 7.2 Resolución por tipo

- **Vídeo**: abre directamente ese vídeo en el reproductor accesible.
- **Noticia**: abre directamente esa noticia en el lector limpio común.
- **Recurso/documento**: abre directamente ese recurso mediante el comportamiento accesible que ya corresponda a Biblioteca, sin limitarse a mostrar la sección completa.

Si en el futuro Buscar incorpora otro tipo de resultado, ese tipo deberá definir cómo abre su elemento exacto antes de poder mostrarse como resultado activable.

### 7.3 Volver y foco

Al volver desde un resultado abierto desde Buscar, se recuperará la búsqueda anterior y el foco intentará volver al resultado que se había activado.

## 8. Compartir con TifloAcosta

### 8.1 Recepción nativa de Android

`AndroidManifest.xml` registrará la aplicación como destino para `android.intent.action.SEND` con contenido textual. La primera versión no registrará recepción de archivos ni lotes.

`TifloSharePlugin` será responsable únicamente de:

1. leer el `Intent` inicial si la aplicación se abre desde Compartir;
2. leer nuevos `Intent` mientras `MainActivity` ya existe (`singleTask`);
3. normalizar el texto recibido y entregarlo a Capacitor;
4. finalizar el flujo de Compartir y devolver TifloAcosta al fondo mediante `moveTaskToBack(true)`.

No clasificará URLs ni descargará páginas.

### 8.2 Sesión efímera

La capa JavaScript tendrá una sesión efímera de Compartir separada de la navegación ordinaria.

La sesión contendrá:

- texto original recibido;
- enlaces detectados;
- clasificación actual;
- referencia al estado del lector limpio cuando se esté leyendo una página;
- estado de carga o error propio de la entrada Compartir.

Cada nuevo `ACTION_SEND` reemplaza completamente la sesión anterior, incluso si el texto es idéntico.

### 8.3 Texto y varias URLs

- Si hay varias URLs, se anunciará cuántas se encontraron y se permitirá elegir una.
- Si no hay URL, el texto se precargará en Buscar y no se ejecutará automáticamente.
- Si la URL es YouTube, se abrirá el reproductor accesible.
- Si es una descarga conocida, se abrirá Descargas.
- Si es una página web, se abrirá el lector limpio común.

### 8.4 Salida

Desde la raíz del flujo Compartir, Volver o “Cancelar y volver” destruirá la sesión temporal y llamará a `moveTaskToBack(true)` para que Android muestre la tarea anterior disponible.

## 9. Lectura limpia

### 9.1 Limpieza

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
- índices cuyo contenido principal sea precisamente una colección de enlaces útiles.

Los enlaces publicitarios, promocionales, de afiliación, navegación general o protocolos distintos de HTTP/HTTPS no se presentarán como enlaces interactivos.

### 9.2 Modelo seguro

El HTML remoto nunca se inyectará directamente con `innerHTML`. El limpiador producirá un modelo de bloques y partes que TifloAcosta renderizará mediante nodos creados por la propia aplicación.

### 9.3 Fiabilidad

Si no se obtiene suficiente contenido útil, TifloAcosta no presentará fragmentos o basura como si fueran una lectura correcta.

La fiabilidad se determinará con criterios objetivos de contenido: título, cantidad de texto sustantivo, bloques útiles y/o colección de enlaces descriptivos según el tipo de página.

### 9.4 Enlaces conservados

Al activar un enlace útil dentro de una lectura limpia, el destino volverá al clasificador común:

- YouTube → reproductor accesible;
- descarga conocida → Descargas;
- página web → nueva lectura limpia dentro de la misma pila temporal.

## 10. Navegación y contexto

El lector común mantendrá una pila temporal como:

`Página inicial → Página 2 → Página 3`

Volver retrocederá una página cada vez. Al llegar a la raíz, el comportamiento dependerá del origen:

- **Actualidad**: vuelve a Actualidad y recupera el foco del titular.
- **Buscar**: vuelve a los resultados y recupera el foco del resultado.
- **Compartir**: termina la sesión Compartir y envía TifloAcosta al segundo plano.

Las pantallas auxiliares abiertas desde una lectura —vídeo o Descargas— deberán regresar al punto exacto del lector desde el que fueron activadas.

## 11. Tratamiento de errores

### Sin conexión, timeout o servidor inaccesible

Se mostrará un mensaje breve y accesible. Habrá “Reintentar” y una acción de regreso adecuada al contexto.

### Lectura no fiable

No se mostrará contenido incompleto como lectura válida.

- Desde Actualidad o Buscar/noticia se podrá ofrecer **Abrir fuente original** como alternativa secundaria.
- Desde Compartir se mantendrá la salida coherente con la sesión: reintentar, analizar como descarga cuando tenga sentido o cancelar y volver.

### Contenido protegido

Si la página exige autenticación, muro de pago o bloquea el acceso, TifloAcosta no intentará eludirlo.

### Redirecciones

Se aceptarán como máximo 5 y solo a destinos HTTP/HTTPS. El destino final se reclasificará.

### Tipo o tamaño no aceptable

`TifloWebFetchPlugin` rechazará respuestas fuera de los tipos textuales admitidos o superiores a 5 MiB.

## 12. Seguridad y privacidad

Todo contenido remoto se considera no fiable.

- No se ejecutarán scripts procedentes del sitio.
- No se inyectará HTML remoto directamente en el DOM.
- Solo se renderizará una representación construida por TifloAcosta a partir de elementos permitidos.
- No se descargarán archivos sin una acción explícita del usuario.
- Las pilas de lectura permanecerán en memoria y se descartarán al salir del flujo correspondiente.
- No se registrarán por defecto las URLs leídas en un historial permanente.
- No se enviarán al backend de TifloAcosta las URLs de lectura limpia en esta versión.
- Los redireccionamientos y protocolos se validarán antes de seguirse.
- La obtención nativa no reutilizará sesiones autenticadas del navegador ni intentará copiar cookies de otras aplicaciones.

## 13. Componentes previstos

- `TifloSharePlugin`: recepción de `Intent` y salida del flujo Compartir.
- `TifloWebFetchPlugin`: obtención segura y limitada de páginas externas.
- `share-session`: estado efímero específico de Compartir.
- `share-classifier`: extracción y clasificación de URLs/texto, reutilizable por el controlador común cuando corresponda.
- `readable-page`: conversión segura de HTML/texto a modelo de lectura.
- controlador/sesión de lector limpio: estado, pila temporal, errores y contexto de retorno independiente de Compartir.
- pantalla de lectura limpia: presentación semántica común.
- `search` y resolución de resultados: conserva y abre la identidad exacta del resultado.
- `actualidad`: activa titulares y delega la lectura al lector común.
- adaptador de vídeo externo: reutilización del reproductor actual.
- adaptador de Descargas: reutilización del analizador existente.

El componente de obtención y el limpiador permanecerán separados: uno obtiene datos no fiables y el otro decide qué parte puede convertirse en contenido visible.

## 14. Pruebas

### Unitarias

- extracción de una, varias o ninguna URL;
- reconocimiento de formatos habituales de YouTube;
- clasificación de proveedores de Descargas;
- rechazo de protocolos no HTTP/HTTPS;
- reclasificación tras redirección;
- limpieza de publicidad, navegación, comentarios y scripts;
- conservación de encabezados, listas y enlaces editoriales útiles;
- rechazo de lecturas no fiables;
- historial interno del lector limpio;
- identidad exacta de resultados de Buscar;
- reinicio completo de la sesión ante un nuevo contenido compartido.

### Integración de interfaz

- titular de Actualidad abre su noticia exacta en lectura limpia;
- volver desde esa lectura restaura Actualidad y el foco del titular;
- resultado de noticia en Buscar abre la misma lectura limpia común;
- resultado de vídeo abre ese vídeo concreto;
- resultado de recurso abre ese recurso concreto;
- volver desde un resultado restaura la búsqueda y el foco correspondiente;
- enlace conservado desde una lectura vuelve al clasificador común;
- vídeo/Descargas abiertos desde una lectura vuelven al punto correcto.

### Integración Android/Capacitor

- aplicación cerrada + compartir URL;
- aplicación ya abierta + compartir URL;
- nuevo contenido compartido mientras existe una sesión anterior;
- cancelar y volver a la tarea anterior;
- URL de YouTube externa al catálogo;
- fallo del reproductor y aparición del escape a YouTube;
- proveedor de descargas;
- artículo normal;
- página índice con varios enlaces útiles;
- URL acortada que termina en YouTube, descarga o web;
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
- comportamiento de Volver según Actualidad, Buscar o Compartir;
- recuperación del foco en el control que originó la navegación;
- ausencia de reproducción automática;
- comportamiento con TalkBack y con otros lectores de pantalla disponibles para los probadores.

## 15. Criterios de aceptación

La versión se considera lista para probar cuando:

1. El titular de una noticia en Actualidad abre esa noticia concreta en el lector limpio.
2. Buscar conserva la identidad de cada resultado y abre el elemento exacto.
3. Una noticia abierta desde Buscar utiliza el mismo lector limpio que Actualidad y Compartir.
4. Android ofrece TifloAcosta como destino al compartir texto o una URL.
5. YouTube llega al reproductor accesible con control del usuario y sin autoplay.
6. Las URLs de descarga conocidas reutilizan el analizador existente.
7. Una página legible produce una representación limpia sin ejecutar contenido remoto.
8. Los enlaces editoriales útiles conservados pueden continuar dentro del mismo lector o dirigirse a vídeo/Descargas según su clasificación.
9. Volver recorre correctamente la pila limpia y termina en el contexto de origen correcto.
10. Los fallos de red, lectura o acceso no bloquean la interfaz ni dejan estados infinitos.
11. Ningún contenido compartido o leído se guarda permanentemente sin una acción futura y explícita del usuario.
12. Las funciones reutilizadas regresan al punto desde el que se abrieron y restauran el foco cuando sea posible.
13. Las correcciones de Actualidad y Buscar y la función Compartir se entregan juntas, sin publicar previamente una versión intermedia que mantenga pendiente la integración del lector limpio.

## 16. Evolución posterior

Este diseño deja para trabajos posteriores los archivos compartidos, iOS Share Extension, Web Share Target, guardado para después, nuevas acciones sobre vídeos y cualquier ampliación que requiera autenticación o contenido dinámico no disponible sin JavaScript.

La versión concreta que se asigne a esta entrega se decidirá al preparar la publicación; esta especificación no fija si se denomina 1.0.4 o 1.1.0.