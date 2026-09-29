# TifloLector 1.3.4 — diseño de lectura continua, controles multimedia, voces, OCR y traducción

Fecha: 2026-09-29
Estado: diseño conversacional aprobado; documento escrito pendiente de revisión final antes del plan de implementación
Rama de trabajo: `feature/tiflolector-1.3.4-reading-upgrade`
Plataforma inicial: Android

## 1. Propósito

Esta actualización debe convertir TifloLector en un lector realmente utilizable durante sesiones largas y corregir el principal defecto detectado por los primeros betatesters: la lectura TTS puede detenerse cuando se bloquea la pantalla porque la cola de frases todavía depende de la capa JavaScript/WebView.

La misma actualización incorporará cuatro mejoras relacionadas que comparten infraestructura de lectura y multimedia:

- lectura TTS continua con pantalla bloqueada y la aplicación en segundo plano;
- control reproducir/pausa mediante los mecanismos multimedia estándar de Android, incluido el gesto de TalkBack de doble toque con dos dedos cuando exista una reproducción activa;
- acceso para conseguir más voces compatibles con el motor TTS del dispositivo;
- OCR para documentos cuyo contenido no pueda leerse porque esté formado por imágenes;
- traducción local de documentos o libros a otro idioma, conservando siempre el original.

La prioridad de ejecución será: primero estabilidad de lectura en segundo plano y controles multimedia; después voces; después OCR; después traducción; finalmente pruebas de regresión, accesibilidad y publicación beta.

## 2. Criterios de éxito

La actualización se considerará lista para beta cuando se cumplan, como mínimo, estos criterios:

- un documento textual puede seguir leyéndose mediante TTS después de bloquear la pantalla;
- la transición entre frases no depende de que la WebView permanezca despierta;
- pausar, reanudar, perder audio focus, recibir una llamada o desconectar auriculares conserva una posición coherente y nunca provoca una reanudación automática no solicitada;
- el sistema multimedia de Android puede controlar la reproducción activa mediante reproducir/pausa;
- el doble toque con dos dedos de TalkBack actúa sobre el contenido multimedia activo cuando Android entrega el correspondiente comando multimedia;
- existe un único concepto de reproducción activa para evitar que libro TTS, audiolibro, audio y vídeo compitan entre sí;
- TifloLector puede volver a consultar las voces TTS del dispositivo después de que el usuario instale o compre una nueva voz;
- un PDF sin texto puede ofrecer OCR en vez de limitarse a fallar;
- el OCR nunca modifica el archivo original y produce texto que puede pasar al mismo modelo semántico de TifloLector;
- el usuario puede traducir un documento compatible a un idioma de destino sin destruir ni sustituir el original;
- original y traducción comparten una correspondencia estable de posiciones para poder cambiar entre ambos sin perder el punto de lectura;
- búsqueda, marcas, lectura TTS y navegación siguen funcionando sobre la versión traducida cuando exista;
- las nuevas funciones mantienen etiquetas, foco y anuncios compatibles con TalkBack;
- todos los cambios quedan cubiertos por pruebas automatizadas y pruebas Android específicas.

## 3. Diagnóstico del fallo actual de pantalla bloqueada

La implementación actual utiliza `android.speech.tts.TextToSpeech` para pronunciar una unidad semántica cada vez, pero el avance a la siguiente unidad está coordinado por `mobile/src/core/reading-speech.mjs`.

El flujo actual es:

1. JavaScript solicita a Android que pronuncie una frase.
2. Android TTS la pronuncia.
3. Android emite `ttsDone`.
4. JavaScript recibe el evento.
5. JavaScript calcula la siguiente unidad y solicita otra llamada a TTS.

Cuando la pantalla se bloquea, Android puede suspender o limitar la WebView. La frase nativa que ya estaba en curso puede terminar, pero el paso siguiente no está garantizado porque depende de JavaScript.

La corrección no consistirá en impedir que la pantalla se apague ni en mantener artificialmente una WebView despierta. La propiedad de la cola de lectura debe pasar a Android mientras exista una lectura activa.

## 4. Arquitectura seleccionada

Se mantendrá la arquitectura híbrida de TifloLector, pero la reproducción se dividirá con mayor claridad entre interfaz compartida y servicios nativos.

### 4.1 Capa compartida

La capa JavaScript seguirá siendo responsable de:

- biblioteca y navegación de pantallas;
- modelo semántico visible;
- búsqueda;
- marcas;
- selección de ajustes;
- presentación de traducciones;
- presentación del resultado OCR;
- solicitud explícita de reproducir, pausar, cambiar posición o cambiar contenido.

No será responsable de encadenar cada frase mientras la lectura esté activa en segundo plano.

### 4.2 Coordinador multimedia nativo

Se añadirá un coordinador multimedia Android que conozca cuál es la reproducción activa y enrute los comandos de reproducir/pausa hacia uno de estos backends:

- lectura TTS de texto;
- audiolibro/audio local;
- vídeo integrado de YouTube cuando el reproductor esté abierto y disponible en primer plano.

Solo un backend podrá declararse activo al mismo tiempo.

El cambio de backend pausará correctamente el anterior antes de activar el nuevo.

### 4.3 Servicio TTS nativo de lectura

La lectura textual activa pasará a un servicio nativo de Android que pueda continuar cuando la actividad/WebView no esté en primer plano.

El servicio deberá recibir una cola o una representación suficiente del documento para avanzar entre unidades sin depender de callbacks JavaScript entre frase y frase.

Responsabilidades mínimas:

- abrir una sesión de lectura asociada a `bookId`;
- conocer la secuencia de unidades semánticas que debe pronunciar;
- mantener `blockIndex` y `unitIndex` actuales;
- aplicar voz y velocidad;
- pronunciar la unidad actual;
- avanzar a la siguiente unidad al recibir `onDone` del TTS;
- persistir progreso de forma periódica y al pausar/interrumpir/terminar;
- exponer estado a la UI cuando esta vuelva a primer plano;
- detenerse al llegar al final real del documento;
- soportar reproducción, pausa y salto a una nueva posición;
- reconstruir una sesión después de recreación del servicio sin iniciar reproducción automáticamente.

Mientras esté reproduciendo se utilizará un servicio en primer plano apropiado para reproducción/lectura, con notificación multimedia cuando Android lo requiera.

### 4.4 Persistencia y recuperación

La posición principal seguirá siendo la posición semántica común del libro.

El servicio nativo actualizará la misma base de datos de TifloLector y no creará una segunda posición paralela.

Al volver a la pantalla del libro, la UI consultará el estado nativo antes de mostrar la posición para evitar que una WebView antigua sobrescriba un progreso más reciente.

Si Android mata el proceso, la sesión podrá reconstruirse desde la última posición persistida, pero nunca se reanudará automáticamente sin una acción explícita del usuario.

## 5. Controles multimedia y TalkBack

### 5.1 Principio

No se inventará un gesto privado de TifloAcosta.

TifloAcosta se integrará con el sistema multimedia estándar de Android para que cualquier comando estándar de reproducir/pausa pueda actuar sobre la reproducción activa.

Esto incluye, cuando TalkBack y Android lo entreguen como comando multimedia, el doble toque con dos dedos utilizado para iniciar o detener contenido multimedia.

### 5.2 Fuente activa

El coordinador mantendrá un estado de fuente activa:

- `tts`;
- `audio`;
- `video`;
- `none`.

Cuando un usuario pulse Reproducir en una fuente nueva, cualquier fuente anterior deberá pausarse antes.

### 5.3 TTS

El servicio TTS expondrá una sesión multimedia con al menos:

- reproducir;
- pausa;
- estado reproduciendo/pausado;
- título del documento;
- nombre de la aplicación;
- progreso lógico cuando pueda representarse sin engañar al sistema.

### 5.4 Audiolibros y audio

La implementación actual basada en Media3 y `MediaSessionService` seguirá siendo la base. Se integrará con el coordinador para que no compita con la sesión TTS.

No se degradarán funciones ya existentes: posición exacta, pistas, velocidad, temporizador, marcas, audio focus y controles de auriculares.

### 5.5 Vídeo de YouTube

El reproductor actual de vídeo usa la YouTube IFrame API dentro de la WebView.

El objetivo de esta actualización será permitir que el comando multimedia estándar de reproducir/pausa controle ese reproductor mientras el vídeo esté abierto y la WebView esté disponible.

El coordinador nativo enviará el comando a un puente que invoque `playVideo()` o `pauseVideo()`.

No se prometerá reproducción de YouTube con la pantalla bloqueada ni se intentará eludir restricciones de YouTube.

Si el reproductor no está disponible o la WebView ha sido destruida, el comando se ignorará de forma segura y la sesión de vídeo dejará de declararse activa.

## 6. Interrupciones de audio

La política será común para TTS y audio:

- pérdida permanente de audio focus: pausar y guardar;
- pérdida transitoria: pausar y guardar;
- desconexión de auriculares o salida ruidosa: pausar y guardar;
- llamada o interrupción equivalente: pausar y guardar;
- recuperación del audio focus: no reanudar automáticamente;
- nueva orden explícita de Reproducir: continuar desde la posición guardada.

Nunca habrá dos fuentes de TifloAcosta reproduciendo a la vez.

## 7. Conseguir más voces

### 7.1 Objetivo

Añadir a “Voz y velocidad” una acción clara: `Conseguir más voces`.

### 7.2 Comportamiento

Al activarla:

1. TifloAcosta informa de que se abrirá una pantalla o aplicación externa.
2. Se intenta abrir la configuración/gestión del motor TTS activo mediante intents estándar de Android cuando estén disponibles.
3. Si el motor ofrece una aplicación propia o una ficha utilizable para instalar recursos adicionales, se podrá abrir por el mecanismo seguro que corresponda.
4. El usuario puede descargar, instalar o comprar voces fuera de TifloAcosta.
5. Al regresar, TifloAcosta vuelve a enumerar `TextToSpeech.getVoices()`.
6. Las voces recién expuestas por Android aparecen en el selector.

### 7.3 Límites

TifloAcosta no venderá voces ni realizará compras dentro de la aplicación.

No se afirmará que todas las voces de TalkBack pueden utilizarse. Solo aparecerán las que el motor TTS exponga a aplicaciones mediante Android.

Si el motor no dispone de una pantalla de instalación o compra accesible mediante intents públicos, se mostrará una explicación breve en vez de inventar un destino.

## 8. OCR de documentos sin texto

### 8.1 Cuándo se ofrece

El OCR no se ejecutará automáticamente sobre todos los PDF.

Se ofrecerá cuando el extractor detecte que el documento no contiene texto utilizable o cuando el usuario solicite expresamente reconocimiento sobre páginas concretas o sobre todo el documento.

### 8.2 Principios

- el archivo original nunca se modifica;
- el OCR se ejecuta sobre una copia o render de las páginas necesarias;
- se procesa por páginas o lotes limitados para evitar consumo excesivo de memoria;
- el resultado se almacena como contenido derivado asociado al mismo libro;
- la posición del usuario sigue refiriéndose al libro original, con referencias de página conservadas cuando sea posible;
- OCR puede cancelarse;
- el progreso del OCR se anuncia de forma accesible sin saturar TalkBack;
- un fallo en una página no debe destruir lo reconocido en páginas anteriores.

### 8.3 Modelo derivado

El texto reconocido se convertirá al mismo modelo semántico que usa el resto de TifloLector.

Cuando no exista estructura fiable, se representará al menos como:

- página;
- bloques de texto;
- párrafos aproximados cuando el motor pueda determinarlos.

Nunca se inventarán encabezados, listas o tablas si el OCR no puede justificarlos.

### 8.4 Scripts e idiomas

El motor OCR elegido deberá declarar explícitamente qué alfabetos/scripts soporta.

Si una página usa un script no soportado, TifloLector deberá informar de ello y conservar el libro sin alteraciones.

La arquitectura permitirá añadir reconocedores adicionales sin cambiar biblioteca, posiciones, búsqueda o marcas.

## 9. Traducción de documentos y libros

### 9.1 Objetivo

Permitir que el usuario lea un documento en un idioma distinto sin tener que sacarlo de TifloLector ni sustituir el original.

### 9.2 Detección y selección

Cuando el documento tenga idioma conocido o pueda identificarse con suficiente confianza, TifloLector podrá ofrecer `Traducir`.

El usuario elegirá el idioma de destino. Por defecto puede proponerse el idioma actual de la interfaz, pero nunca se iniciará una traducción sin confirmación explícita.

### 9.3 Traducción local

La implementación Android priorizará traducción en el dispositivo.

Los modelos de idioma necesarios podrán descargarse cuando falten. La interfaz deberá informar antes de una descarga relevante y mostrar estado accesible de preparación.

No se enviará el contenido del libro a un servidor de TifloAcosta.

Si en una versión futura se añadiera un proveedor remoto opcional, requerirá diseño y consentimiento separados; no forma parte de este alcance.

### 9.4 Traducción por bloques

Los libros no se enviarán al motor como una única cadena gigante.

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

### 9.5 Correspondencia original/traducción

Cada bloque traducido conservará una referencia al bloque fuente.

Esto permite:

- alternar entre `Original` y `Traducción` conservando el punto de lectura;
- mantener una única posición principal;
- asociar marcas a la posición fuente aunque se creen mientras se visualiza la traducción;
- regenerar una traducción sin perder marcas;
- mostrar el original de un fragmento traducido cuando el usuario lo solicite.

### 9.6 Caché

Las traducciones se guardarán localmente como contenido derivado.

La identidad de la caché incluirá al menos:

- huella del contenido fuente;
- idioma fuente;
- idioma destino;
- versión o identificador del motor/modelo cuando sea necesario.

Si cambia el archivo fuente, la traducción anterior no se reutilizará silenciosamente.

### 9.7 Lectura TTS de la traducción

Cuando se muestra la traducción, TifloLector intentará seleccionar una voz compatible con el idioma de destino.

La voz elegida por el usuario sigue teniendo prioridad si es compatible.

Si no existe una voz adecuada, la lectura visual y TalkBack seguirán disponibles y se informará sin bloquear el documento.

### 9.8 Calidad

La función se presentará como ayuda de traducción para lectura y comprensión, no como traducción literaria o profesional garantizada.

El usuario siempre podrá consultar el original.

## 10. Datos derivados y almacenamiento

Se distinguirán claramente tres tipos de contenido:

- original importado;
- OCR derivado;
- traducciones derivadas.

El original nunca se reemplaza.

Los datos derivados podrán eliminarse sin eliminar el libro.

La copia de seguridad de TifloLector deberá decidir explícitamente si incluye derivados o si permite regenerarlos. Para esta actualización, la opción preferida será incluir metadatos y conservar los derivados cuando sea razonable, pero nunca hacer que una restauración dependa de que sigan existiendo modelos externos concretos.

## 11. Interfaz propuesta

### 11.1 En el lector

Además de los controles actuales, aparecerán cuando correspondan:

- `Original / Traducción`;
- `Traducir`;
- `Reconocer texto con OCR` para documentos sin texto;
- estado breve de OCR o traducción;
- acceso a `Conseguir más voces` dentro de Voz y velocidad.

### 11.2 Accesibilidad

Los procesos largos no moverán el foco continuamente.

Los cambios de progreso se anunciarán de forma moderada.

Al terminar OCR o traducción:

- se anunciará el resultado;
- el foco permanecerá en un lugar lógico;
- no se iniciará lectura TTS automáticamente.

Los botones deberán indicar con claridad si una acción abre una aplicación externa, descarga un modelo o puede consumir datos.

## 12. Manejo de errores

### 12.1 TTS

Si una voz desaparece del dispositivo, se utilizará un fallback seguro sin borrar la preferencia guardada.

Si el servicio TTS se recrea, restaurará estado y posición, pero permanecerá pausado hasta nueva orden explícita si Android había matado el proceso.

### 12.2 OCR

Si una página falla:

- registrar el error de esa página;
- continuar si es seguro;
- permitir reintentar;
- no borrar páginas ya reconocidas.

### 12.3 Traducción

Si falta un modelo:

- informar;
- ofrecer descargarlo;
- no bloquear la lectura original.

Si una unidad falla:

- marcar esa unidad como pendiente/error;
- conservar traducciones ya completadas;
- permitir reintento;
- nunca sustituir la unidad original por una cadena vacía.

### 12.4 Vídeo

Si el puente multimedia no puede controlar YouTube, la reproducción seguirá siendo controlable desde los botones propios del reproductor.

La integración multimedia no debe romper el fallback actual de abrir el vídeo externamente.

## 13. Privacidad

Por defecto:

- libros, OCR, traducciones, posiciones y marcas permanecen en el dispositivo;
- TifloAcosta no sube el contenido de los libros a sus propios servidores;
- OCR y traducción priorizan motores locales;
- las descargas de modelos se consideran recursos del motor, no contenido del libro;
- cualquier futura traducción remota exigiría un diseño específico y consentimiento explícito antes de enviar texto fuera del dispositivo.

## 14. Rendimiento y batería

La lectura TTS no mantendrá la pantalla encendida.

El servicio en primer plano existirá únicamente mientras haya una reproducción activa que lo justifique.

OCR y traducción se procesarán por lotes y deberán poder cancelarse.

Para documentos grandes se evitará mantener simultáneamente en memoria:

- el documento completo renderizado;
- todas las imágenes de páginas PDF;
- todas las cadenas traducidas en una única operación.

Los modelos descargados deberán reutilizarse entre sesiones.

## 15. Pruebas obligatorias

### 15.1 Lectura con pantalla bloqueada

Caso mínimo automatizado/instrumentado y prueba manual real:

1. abrir un libro con al menos varias frases;
2. iniciar TTS;
3. bloquear pantalla;
4. comprobar que se pronuncian varias unidades consecutivas;
5. esperar varios minutos;
6. pausar mediante control multimedia;
7. reanudar;
8. desbloquear;
9. comprobar que UI, base de datos y servicio muestran la misma posición.

### 15.2 Interrupciones

- pérdida transitoria de audio focus;
- pérdida permanente;
- desconexión de auriculares;
- llamada simulada cuando sea posible;
- retorno de audio focus sin auto-reanudación;
- persistencia inmediata al pausar.

### 15.3 TalkBack/media

Con TalkBack activado:

- TTS: doble toque con dos dedos alterna reproducir/pausa cuando la sesión TTS es activa;
- audiolibro/audio: alterna reproducir/pausa;
- vídeo abierto: alterna reproducir/pausa mientras la sesión de vídeo sea válida;
- sin reproducción activa: no se dispara una acción arbitraria de TifloAcosta;
- cambiar de TTS a audio o vídeo deja solo una fuente activa.

### 15.4 Voces

- enumeración antes y después de regresar de configuración externa;
- voz nueva aparece sin reiniciar la aplicación cuando Android la expone;
- voz eliminada usa fallback seguro;
- cancelación externa devuelve el foco correctamente.

### 15.5 OCR

- PDF normal con texto no ofrece OCR como requisito;
- PDF escaneado ofrece OCR;
- documento multipágina;
- cancelación;
- página con fallo;
- conservación del original;
- búsqueda sobre OCR;
- marcas sobre OCR;
- TTS sobre OCR;
- restauración de posición.

### 15.6 Traducción

- detección de idioma;
- selección manual de idioma de destino;
- descarga de modelo faltante;
- traducción parcial y reanudación;
- alternancia Original/Traducción sin cambio de posición;
- búsqueda sobre traducción;
- marca creada en traducción y recuperada en original;
- voz TTS compatible con destino;
- ausencia de voz compatible;
- documento largo sin congelar UI;
- cancelación y reintento;
- cambio del archivo fuente invalida caché derivada.

### 15.7 Regresión

Debe seguir pasando la batería existente de TifloLector para:

- TXT;
- HTML;
- PDF con texto;
- EPUB;
- DOCX;
- DAISY;
- audiolibros;
- cola;
- marcas;
- búsqueda;
- copia/restauración;
- ajustes por libro;
- compartir/importar;
- foco de TalkBack.

## 16. Orden de implementación

1. Crear pruebas que reproduzcan el fallo de TTS al perder actividad/primer plano y definir contrato nativo de sesión.
2. Implementar servicio TTS nativo y persistencia de posición.
3. Implementar coordinador de fuente multimedia activa y controles estándar.
4. Integrar audiolibro existente con el coordinador.
5. Añadir puente de reproducir/pausa al vídeo integrado.
6. Añadir `Conseguir más voces` y refresco al regresar.
7. Añadir motor OCR y modelo derivado.
8. Añadir traducción local, caché y conmutación Original/Traducción.
9. Ejecutar pruebas unitarias, de integración, instrumentación Android y regresión completa.
10. Generar beta nueva solo después de verificar que la lectura con pantalla bloqueada funciona en dispositivo Android real.

## 17. Decisiones expresamente fuera de alcance

No se incluye en esta actualización:

- sincronización de biblioteca entre dispositivos;
- traducción remota obligatoria;
- sustitución del original por la traducción;
- edición manual del texto OCR;
- traducción de audio hablado en tiempo real;
- reproducción de YouTube con pantalla bloqueada si YouTube no lo permite;
- compras de voces dentro de TifloAcosta;
- garantía de compatibilidad con voces que Android no exponga mediante TTS;
- elusión de DRM;
- OCR universal de cualquier escritura si el motor elegido no la soporta.

## 18. Resultado esperado para la beta

La beta posterior a 1.3.3 debe poder presentarse como una actualización centrada en convertir TifloLector en un lector de uso cotidiano: escuchar un libro con el teléfono bloqueado, controlar la reproducción con los mecanismos accesibles del sistema, ampliar voces cuando el motor lo permita, recuperar texto de documentos escaneados y leer traducciones sin abandonar ni destruir el original.

La prioridad de calidad es que ninguna de estas funciones comprometa la estabilidad de biblioteca, progreso, marcas, accesibilidad o privacidad local ya obtenidas en 1.3.3.
