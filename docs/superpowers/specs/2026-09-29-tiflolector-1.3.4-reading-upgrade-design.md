# TifloLector 1.3.4 — diseño de lectura continua, controles multimedia, voces, OCR y traducción

Fecha: 2026-09-29
Estado: diseño conversacional aprobado; documento escrito pendiente de revisión final antes del plan de implementación
Rama de trabajo: `feature/tiflolector-1.3.4-reading-upgrade`
Plataforma inicial: Android

## 1. Propósito

Esta actualización debe convertir TifloLector en un lector realmente utilizable durante sesiones largas y corregir el principal defecto detectado por los primeros betatesters: la lectura TTS puede detenerse cuando se bloquea la pantalla porque la cola de frases todavía depende de la capa JavaScript/WebView.

La misma actualización incorporará cinco mejoras relacionadas:

- lectura TTS continua con pantalla bloqueada y la aplicación en segundo plano;
- control reproducir/pausa mediante los mecanismos multimedia estándar de Android, incluido el gesto de TalkBack de doble toque con dos dedos cuando exista una reproducción activa;
- acceso para conseguir más voces compatibles con el motor TTS del dispositivo;
- OCR para documentos cuyo contenido no pueda leerse porque esté formado por imágenes;
- traducción local de documentos o libros a otro idioma, conservando siempre el original.

Prioridad de ejecución: primero estabilidad de lectura en segundo plano y controles multimedia; después voces; después OCR; después traducción; finalmente pruebas de regresión, accesibilidad y publicación beta.

## 2. Criterios de éxito

La actualización se considerará lista para beta cuando:

- un documento textual siga leyéndose mediante TTS después de bloquear la pantalla;
- la transición entre frases no dependa de que la WebView permanezca despierta;
- pausar, reanudar, perder audio focus, recibir una llamada o desconectar auriculares conserve una posición coherente y nunca provoque una reanudación automática no solicitada;
- el sistema multimedia de Android pueda controlar la reproducción activa mediante reproducir/pausa;
- el doble toque con dos dedos de TalkBack actúe sobre el contenido multimedia activo cuando Android entregue el correspondiente comando multimedia;
- exista un único concepto de reproducción activa para evitar que libro TTS, audiolibro, audio y vídeo compitan entre sí;
- TifloLector vuelva a consultar las voces TTS al regresar de la instalación o compra de una voz;
- un PDF sin texto pueda ofrecer OCR en vez de limitarse a fallar;
- el OCR nunca modifique el archivo original y produzca texto utilizable por el modelo semántico de TifloLector;
- el usuario pueda traducir un documento compatible a otro idioma sin sustituir el original;
- original y traducción compartan una correspondencia estable de posiciones;
- búsqueda, marcas, navegación y TTS funcionen sobre OCR y traducción cuando existan;
- las nuevas funciones mantengan etiquetas, foco y anuncios compatibles con TalkBack;
- las pruebas existentes sigan pasando y existan pruebas nuevas para estos comportamientos.

## 3. Diagnóstico del fallo actual de pantalla bloqueada

La implementación actual usa `android.speech.tts.TextToSpeech` para pronunciar una unidad semántica cada vez, pero el avance está coordinado por `mobile/src/core/reading-speech.mjs`.

Flujo actual:

1. JavaScript solicita pronunciar una frase.
2. Android TTS la pronuncia.
3. Android emite `ttsDone`.
4. JavaScript recibe el evento.
5. JavaScript calcula la siguiente unidad y solicita otra llamada a TTS.

Cuando la pantalla se bloquea, Android puede suspender o limitar la WebView. La frase nativa que ya estaba en curso puede terminar, pero el paso siguiente no está garantizado.

La corrección no consistirá en impedir que la pantalla se apague. La propiedad de la cola de lectura debe pasar a Android mientras exista una lectura activa.

## 4. Arquitectura seleccionada

Se mantiene la arquitectura híbrida de TifloLector, pero se separa con mayor claridad interfaz compartida y reproducción nativa.

### 4.1 Capa compartida

JavaScript seguirá siendo responsable de:

- biblioteca y navegación de pantallas;
- modelo semántico visible;
- búsqueda;
- marcas;
- selección de ajustes;
- presentación de OCR y traducciones;
- solicitud explícita de reproducir, pausar, cambiar posición o cambiar contenido.

No será responsable de encadenar cada frase mientras la lectura esté activa en segundo plano.

### 4.2 Coordinador multimedia nativo

Se añadirá un coordinador Android que conozca cuál es la reproducción activa y enrute reproducir/pausa hacia uno de estos backends:

- `tts`: lectura de texto;
- `audio`: audiolibro o audio local;
- `video`: vídeo integrado de YouTube mientras su reproductor esté abierto y disponible;
- `none`: ninguna fuente.

Solo un backend podrá declararse activo al mismo tiempo. Activar uno nuevo pausará correctamente el anterior.

### 4.3 Servicio TTS nativo

La lectura textual activa pasará a un servicio nativo Android capaz de continuar cuando la actividad/WebView no esté en primer plano.

El servicio deberá recibir una representación suficiente del documento para avanzar entre unidades sin depender de callbacks JavaScript entre frase y frase.

Responsabilidades mínimas:

- abrir una sesión asociada a `bookId`;
- conocer la secuencia de unidades semánticas;
- mantener `blockIndex` y `unitIndex`;
- aplicar voz y velocidad;
- pronunciar la unidad actual;
- avanzar al recibir `onDone` del TTS;
- persistir progreso periódicamente y al pausar/interrumpir/terminar;
- exponer estado a la UI cuando vuelva a primer plano;
- detenerse al llegar al final real;
- soportar reproducir, pausar y saltar a una posición;
- reconstruir estado después de recreación del servicio sin reproducir automáticamente.

Mientras reproduzca se utilizará un servicio en primer plano apropiado para reproducción de audio/lectura, con sesión y notificación multimedia cuando Android lo requiera.

### 4.4 Persistencia

La posición principal seguirá siendo la posición semántica común del libro. El servicio nativo actualizará la misma base de datos de TifloLector; no habrá una segunda posición paralela.

Al volver a la pantalla del libro, la UI consultará primero el estado nativo para evitar que una WebView antigua sobrescriba un progreso más reciente.

Si Android mata el proceso, la sesión podrá reconstruirse desde la última posición persistida, pero permanecerá pausada hasta una acción explícita del usuario.

## 5. Controles multimedia y TalkBack

No se inventará un gesto privado de TifloAcosta. La aplicación se integrará con los comandos multimedia estándar de Android.

Cuando TalkBack entregue el doble toque con dos dedos como comando de reproducir/pausa, actuará sobre la fuente activa.

### 5.1 TTS

La sesión TTS expondrá como mínimo:

- reproducir;
- pausa;
- estado reproduciendo/pausado;
- título del documento;
- nombre de TifloAcosta;
- progreso cuando pueda representarse de forma coherente.

### 5.2 Audiolibros y audio

La implementación Media3/`MediaSessionService` existente seguirá siendo la base. Se integrará con el coordinador sin perder posición exacta, pistas, velocidad, temporizador, marcas, audio focus ni controles de auriculares.

### 5.3 Vídeo de YouTube

El reproductor actual usa YouTube IFrame API dentro de la WebView.

Mientras el reproductor esté abierto y la WebView disponible, el coordinador podrá enviar reproducir/pausa a un puente que invoque `playVideo()` o `pauseVideo()`.

No se prometerá reproducción de YouTube con la pantalla bloqueada ni se intentarán eludir restricciones de YouTube.

Si la WebView o el reproductor dejan de estar disponibles, la fuente `video` se desactivará de forma segura.

## 6. Interrupciones de audio

Política común para TTS y audio:

- pérdida permanente de audio focus: pausar y guardar;
- pérdida transitoria: pausar y guardar;
- desconexión de auriculares: pausar y guardar;
- llamada o interrupción equivalente: pausar y guardar;
- recuperación del audio focus: no reanudar automáticamente;
- nueva orden explícita de Reproducir: continuar desde la posición guardada.

Nunca habrá dos fuentes de TifloAcosta reproduciendo a la vez.

## 7. Conseguir más voces

En `Voz y velocidad` se añadirá `Conseguir más voces`.

Flujo:

1. avisar de que se abrirá una pantalla o aplicación externa;
2. intentar abrir la gestión/configuración del motor TTS activo mediante intents públicos de Android;
3. cuando sea posible, permitir llegar a la aplicación o mecanismo del proveedor para instalar, descargar o comprar voces;
4. al regresar, volver a enumerar `TextToSpeech.getVoices()`;
5. mostrar inmediatamente cualquier voz nueva que Android exponga a aplicaciones.

TifloAcosta no venderá voces ni realizará compras dentro de la app.

No se afirmará que todas las voces de TalkBack son utilizables. Solo aparecerán las que Android exponga mediante TTS.

Si el motor no ofrece un destino público apropiado, TifloAcosta mostrará una explicación breve en lugar de inventar una tienda.

## 8. OCR de documentos sin texto

### 8.1 Motor inicial

La implementación Android inicial utilizará Google ML Kit Text Recognition v2 con modelos descargables mediante Google Play Services para evitar aumentar innecesariamente el tamaño base de la aplicación.

Los scripts iniciales serán los que el motor ofrece actualmente de forma oficial: latino, chino, devanagari, japonés y coreano.

No se anunciará OCR universal. Si un documento usa un script no soportado, se informará claramente y se conservará el original sin cambios.

Si el dispositivo no puede obtener el módulo OCR requerido, la función fallará de forma recuperable y la lectura normal del documento seguirá disponible cuando exista texto original.

### 8.2 Cuándo se ofrece

El OCR no se ejecutará automáticamente sobre todos los PDF.

Se ofrecerá cuando el extractor detecte que el documento no contiene texto utilizable o cuando el usuario solicite expresamente reconocimiento sobre páginas concretas o sobre todo el documento.

### 8.3 Principios

- el archivo original nunca se modifica;
- el PDF se renderiza por páginas para producir imágenes de entrada;
- se procesa por páginas o lotes limitados;
- el resultado se guarda como contenido derivado asociado al mismo libro;
- se conservan referencias de página cuando sea posible;
- el proceso puede cancelarse;
- el progreso se anuncia de forma moderada;
- un fallo de una página no destruye páginas ya reconocidas;
- OCR se ejecuta fuera del hilo de interfaz y guarda progreso suficiente para poder reanudar tras una interrupción del proceso.

### 8.4 Modelo derivado

El texto reconocido se convertirá al mismo modelo semántico de TifloLector.

Cuando no exista estructura fiable, se representará al menos como página, bloques de texto y párrafos aproximados cuando el motor pueda determinarlos.

Nunca se inventarán encabezados, listas o tablas que el OCR no pueda justificar.

## 9. Traducción de documentos y libros

### 9.1 Motores iniciales

La implementación Android inicial utilizará:

- Google ML Kit Language Identification para detectar idioma cuando el documento no lo declare de forma fiable;
- Google ML Kit Translation para traducción en el dispositivo;
- modelos de traducción descargables bajo demanda.

Las versiones concretas de dependencias se fijarán en el plan de implementación después de verificar las versiones estables disponibles en ese momento.

La traducción se realizará en el dispositivo. El contenido del libro no se enviará a servidores de TifloAcosta.

### 9.2 Detección y selección

Cuando el documento tenga idioma conocido o pueda identificarse con suficiente confianza, TifloLector podrá ofrecer `Traducir`.

El usuario elegirá el idioma de destino. Se podrá proponer el idioma actual de la interfaz, pero nunca se iniciará una traducción sin acción explícita.

Si el idioma no es compatible con el motor de traducción, se informará sin bloquear la lectura original.

### 9.3 Traducción por bloques

Los libros no se enviarán al motor como una cadena gigante.

Se traducirá por unidades semánticas o grupos pequeños conservando:

- orden de bloques;
- encabezados y niveles;
- párrafos;
- listas;
- citas;
- celdas de tabla;
- referencias internas cuando sigan siendo válidas;
- texto alternativo cuando proceda.

No se traducirán URLs, identificadores internos ni datos estructurales que deban permanecer estables.

El texto obtenido mediante OCR también podrá pasar por este mismo flujo de traducción.

### 9.4 Correspondencia original/traducción

Cada bloque traducido conservará referencia al bloque fuente.

Esto permitirá:

- alternar `Original / Traducción` conservando el punto de lectura;
- mantener una única posición principal;
- asociar marcas a la posición fuente aunque se creen en la traducción;
- regenerar traducciones sin perder marcas;
- mostrar el original de un fragmento cuando sea necesario.

### 9.5 Caché

Las traducciones se guardarán localmente como contenido derivado.

La identidad de caché incluirá al menos:

- huella del contenido fuente;
- idioma fuente;
- idioma destino;
- identificador de motor/modelo cuando sea necesario.

Si cambia el archivo fuente, la traducción anterior no se reutilizará silenciosamente.

### 9.6 Lectura TTS de la traducción

Cuando se muestre una traducción, TifloLector intentará utilizar una voz compatible con el idioma de destino.

La voz seleccionada por el usuario seguirá teniendo prioridad si es compatible.

Si no existe una voz adecuada, la lectura visual y TalkBack seguirán disponibles y se informará sin bloquear el documento.

### 9.7 Calidad

La función se presentará como ayuda de traducción para lectura y comprensión, no como traducción literaria o profesional garantizada.

El usuario siempre podrá consultar el original.

## 10. Datos derivados y copia de seguridad

Se distinguirán tres tipos de contenido:

- original importado;
- OCR derivado;
- traducciones derivadas.

El original nunca se reemplaza.

Los datos derivados podrán eliminarse sin eliminar el libro.

La copia explícita de TifloLector incluirá los resultados OCR y las traducciones ya generadas para que una restauración no obligue a repetir procesos costosos. No incluirá modelos descargables de ML Kit; esos modelos se volverán a obtener del proveedor cuando sean necesarios.

La restauración seguirá sin depender de que el mismo modelo esté instalado: el texto derivado guardado seguirá siendo legible aunque el motor ya no esté disponible.

## 11. Interfaz propuesta

En el lector aparecerán cuando correspondan:

- `Original / Traducción`;
- `Traducir`;
- `Reconocer texto con OCR` para documentos sin texto;
- estado breve de OCR o traducción;
- `Conseguir más voces` dentro de Voz y velocidad.

Los procesos largos no moverán el foco continuamente. Los cambios de progreso se anunciarán de forma moderada.

Al terminar OCR o traducción:

- se anunciará el resultado;
- el foco permanecerá en un lugar lógico;
- no se iniciará TTS automáticamente.

Los botones indicarán claramente si una acción abre una aplicación externa, descarga un modelo o puede consumir datos.

## 12. Manejo de errores

### 12.1 TTS

Si una voz desaparece del dispositivo, se utilizará un fallback seguro sin borrar la preferencia guardada.

Si el servicio se recrea, restaurará estado y posición, pero permanecerá pausado si Android había matado el proceso.

### 12.2 OCR

Si una página falla:

- registrar el error;
- continuar si es seguro;
- permitir reintentar;
- conservar páginas ya reconocidas.

### 12.3 Traducción

Si falta un modelo:

- informar;
- ofrecer descargarlo;
- no bloquear la lectura original.

Si una unidad falla:

- marcarla como pendiente/error;
- conservar lo ya traducido;
- permitir reintento;
- nunca sustituir el original por una cadena vacía.

### 12.4 Vídeo

Si el puente multimedia no puede controlar YouTube, los botones propios del reproductor seguirán funcionando.

La integración multimedia no romperá el fallback existente de abrir el vídeo externamente.

## 13. Privacidad

Por defecto:

- libros, OCR, traducciones, posiciones y marcas permanecen en el dispositivo;
- TifloAcosta no sube contenido de libros a sus propios servidores;
- OCR y traducción usan motores locales;
- las descargas de modelos son recursos del motor, no contenido del libro;
- cualquier futura traducción remota requerirá diseño y consentimiento separados.

## 14. Rendimiento y batería

La lectura TTS no mantendrá la pantalla encendida.

El servicio en primer plano existirá únicamente mientras una reproducción activa lo justifique.

OCR y traducción se procesarán por lotes y podrán cancelarse.

Para documentos grandes se evitará mantener simultáneamente en memoria el documento completo renderizado, todas las páginas PDF como imágenes o todas las cadenas traducidas.

Los modelos descargados se reutilizarán entre sesiones cuando el proveedor lo permita.

## 15. Pruebas obligatorias

### 15.1 Lectura con pantalla bloqueada

Prueba automatizada/instrumentada y prueba manual real:

1. abrir un libro con varias frases;
2. iniciar TTS;
3. bloquear pantalla;
4. comprobar que se pronuncen varias unidades consecutivas;
5. esperar varios minutos;
6. pausar mediante control multimedia;
7. reanudar;
8. desbloquear;
9. comprobar que UI, base de datos y servicio muestran la misma posición.

### 15.2 Interrupciones

- pérdida transitoria y permanente de audio focus;
- desconexión de auriculares;
- llamada simulada cuando sea posible;
- retorno de audio focus sin auto-reanudación;
- persistencia inmediata al pausar.

### 15.3 TalkBack y multimedia

Con TalkBack activado:

- TTS: doble toque con dos dedos alterna reproducir/pausa cuando TTS es la fuente activa;
- audiolibro/audio: alterna reproducir/pausa;
- vídeo abierto: alterna reproducir/pausa mientras el reproductor sea válido;
- sin reproducción activa: no se dispara una acción arbitraria;
- cambiar de TTS a audio o vídeo deja solo una fuente activa.

### 15.4 Voces

- enumeración antes y después de regresar de configuración externa;
- voz nueva aparece sin reiniciar la app cuando Android la expone;
- voz eliminada usa fallback seguro;
- cancelación externa devuelve el foco correctamente.

### 15.5 OCR

- PDF normal con texto;
- PDF escaneado;
- documento multipágina;
- scripts soportados y no soportados;
- descarga del módulo requerido;
- cancelación;
- página con fallo;
- conservación del original;
- búsqueda, marcas y TTS sobre OCR;
- restauración de posición.

### 15.6 Traducción

- detección de idioma;
- selección manual de destino;
- idioma no soportado;
- descarga de modelo faltante;
- traducción parcial y reanudación;
- `Original / Traducción` sin cambio de posición;
- búsqueda sobre traducción;
- marca creada en traducción y recuperada en original;
- traducción de texto procedente de OCR;
- voz TTS compatible y ausencia de voz compatible;
- documento largo sin congelar UI;
- cancelación y reintento;
- cambio del archivo fuente invalida caché derivada.

### 15.7 Regresión

Debe seguir pasando la batería existente para TXT, HTML, PDF con texto, EPUB, DOCX, DAISY, audiolibros, cola, marcas, búsqueda, copia/restauración, ajustes por libro, compartir/importar y foco de TalkBack.

## 16. Orden de implementación

1. Crear pruebas que reproduzcan el fallo de TTS al perder actividad/primer plano y definir el contrato nativo de sesión.
2. Implementar servicio TTS nativo y persistencia de posición.
3. Implementar coordinador de fuente multimedia activa y controles estándar.
4. Integrar audiolibro existente con el coordinador.
5. Añadir puente reproducir/pausa al vídeo integrado.
6. Añadir `Conseguir más voces` y refresco al regresar.
7. Añadir ML Kit OCR y modelo derivado.
8. Añadir identificación de idioma, traducción local, caché y `Original / Traducción`.
9. Ampliar copia/restauración para datos derivados.
10. Ejecutar pruebas unitarias, integración, instrumentación Android y regresión completa.
11. Generar beta nueva solo después de verificar la lectura con pantalla bloqueada y los controles de TalkBack en un dispositivo Android real.

## 17. Fuera de alcance

No se incluye:

- sincronización de biblioteca entre dispositivos;
- traducción remota obligatoria;
- sustitución del original por la traducción;
- edición manual del texto OCR;
- traducción de audio hablado en tiempo real;
- reproducción de YouTube con pantalla bloqueada si YouTube no lo permite;
- compras de voces dentro de TifloAcosta;
- compatibilidad con voces que Android no exponga mediante TTS;
- elusión de DRM;
- OCR universal de scripts que el motor elegido no soporte.

## 18. Resultado esperado

La beta posterior a 1.3.3 debe poder presentarse como una actualización centrada en convertir TifloLector en un lector de uso cotidiano: escuchar un libro con el teléfono bloqueado, controlar la reproducción mediante los mecanismos accesibles del sistema, ampliar voces cuando el motor lo permita, recuperar texto de documentos escaneados y leer traducciones sin abandonar ni destruir el original.

La prioridad de calidad es que ninguna de estas funciones comprometa biblioteca, progreso, marcas, accesibilidad o privacidad local ya obtenidas en 1.3.3.
