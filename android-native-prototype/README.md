# Prototipo 0.9 — voces, pronunciación y apagado automático

En esta fase se conservan la portada mínima y el flujo de importación del prototipo 0.8. No modifica la aplicación de Google Play.

- En Ajustes generales, dentro de **Audio y voces** (cerrado al entrar): selección de la voz del motor Android activo; botón **Buscar voces de otros proveedores** que abre otra pantalla con Acapela TTS Voices, Vocalizer TTS y Eloquence TTS. Cada enlace externo requiere confirmación. La instalación, disponibilidad, pagos, cambio de motor TTS y descarga son responsabilidad del proveedor/usuario. El lector no descarga voces privativas ni promete que cada motor aparezca en todos los dispositivos. **Actualizar voces instaladas** vuelve a consultar el motor TTS.
- **Diccionario de pronunciación**, dentro de Audio y voces y también accesible desde Audio de un documento de texto: añadir y borrar parejas «Palabra escrita / Pronunciar como». Límite de 150 entradas, sustitución por palabras completas, sin cascada, solo sobre el fragmento enviado a síntesis, preservando contenido, progreso y marcas. Al abrir su editor desde un documento se pausa la lectura para evitar solapamiento con TalkBack.
- **Apagado automático** dentro de Audio de cada texto y de cada audiolibro: Desactivado, 5, 10, 15, 30, 45 y 60 minutos. Por defecto desactivado al abrir un libro. El contador se ejecuta mientras se reproduce; al pausar se cancela y al reanudar inicia de nuevo el intervalo. Al vencer la reproducción se detiene o pausa conservando la posición. No es alarma independiente ni se mantiene contando con audio pausado.
- Pendiente validación física de enlaces de proveedores según región, motores que anuncian sus voces en Android, pronunciación en lenguas mixtas y temporizador con pantalla bloqueada.

## Inventario de formatos — estado real de prototipo 0.9

1. **Decodificadores presentes que exigen pruebas reales**: TXT, Markdown, HTML/HTM, CSV/JSON/XML/log/SRT (texto), PDF con capa de texto, EPUB sin DRM, DOCX, PPTX, XLSX, ZIP de texto/audio, DAISY/ZIP con contenido reconocible (sin sincronía SMIL), MP3, M4A/M4B, WAV, OGG y AAC (según códecs compatibles de Android). RTF se trata por ahora solo de forma básica; **no** se considera fidelidad de conversión a RTF garantizada.
2. **Prioridad alta, aún no incorporados en el prototipo nativo**: OCR de PDF escaneados, fotografías JPG/JPEG/PNG/WebP y texto integrado en imágenes; extracción estructural de tablas Office y notas/alternativas de imagen; DAISY completo con navegación/sincronía, audio en segundo plano.
3. **Office legado pendiente**: DOC binario, PPT, PPS y XLS. Formatos de presentación/Office pendientes adicionales: PPSX y OpenDocument ODT/ODS/ODP.
4. **Otros formatos posibles a evaluar según demanda y licencia/códecs**: FLAC/OPUS, FB2, MOBI/AZW3/KFX (incluido DRM, que no se promete admitir), RAR/7Z, páginas XHTML individuales y archivos de audio/vídeo MP4. MP4 es contenedor multimedia, no necesariamente un libro.
5. **Otras funciones independientes del formato** todavía pendientes de portarse del lector Android ya publicado a este prototipo nativo: OCR, traducción en dispositivo, exportación/compartir, biblioteca con firma persistente y restauración, continuidad multimedia en segundo plano; comprobar la paridad con las últimas versiones iOS.

No afirmar equivalencia funcional ni publicar hasta pruebas en Pixel con TalkBack y documentos representativos. El repositorio existente ya contiene OCR, traducción y controles avanzados para la app Android anterior, que pueden servir de referencia para portar estas funciones sin perderlas.

# Propuesta 0.8 — paridad mínima TifloLector Android/iOS (26/10/2026)

ESTADO: propuesta en PR #252, independiente de la app Google Play. No dar por aceptada ni publicar hasta ensayo físico con TalkBack y confirmación del usuario.

## Entrada a TifloLector
La portada del lector muestra únicamente **Importar**, **Ajustes**, **Filtros** (cerrados por defecto), encabezado **Mi biblioteca** y títulos paginados de diez en diez. Sin barra de búsqueda general, sin panel de cola ni bloque de marcas desplegado en Inicio. Las marcas se consultan desde la obra. Se conserva "Volver al inicio".

- **Importar** abre pantalla con dos accesos: «Archivos del dispositivo y nubes», mediante Android Storage Access Framework (document picker, admite proveedores instalados como Google Drive o OneDrive si el usuario tiene sesión y proveedor), y «Bibliotecas externas (OPDS)», con Proyecto Gutenberg y catálogos HTTPS añadidos por el usuario. No se implementa una integración o login de nube propio.
- **Ajustes** abre submenús independientes y cerrados: Audio y voces (velocidad, filtro de idioma, voces Android instaladas, acceso a ajustes TTS del sistema), Modo manual/automático, Presentación visual (tamaño, interlineado, negrita), Navegación y avances (bloque/párrafo/frase), Formatos reales.
- **Filtros** usan deslizadores ajustables para formato, fecha, favoritos, marcas, orden y carpeta; sin buscador textual destacado. Los títulos se pueden gestionar con acciones TalkBack: Abrir, Reproducir, Marcas, Favorito, Información, Cambiar título, Mover a carpeta y Eliminar con confirmación. El gesto vertical ajusta la acción seleccionada, y el doble toque la ejecuta; se debe confirmar físicamente porque TalkBack depende de la configuración de controles de lectura.
- Dentro de un texto, únicamente Reproducir/Pausar, progreso, Navegación, Audio, Visual y Más acciones, todos los submenús cerrados. El título también admite acciones ajustables con gestos; el texto se presenta tras los controles. Preferencias visuales y voz individuales por libro.
- Decodificadores añadidos: TXT/MD/HTML y otros textos simples; PDF que ya contenga texto (sin OCR), EPUB, DOCX, PPTX, XLSX, ZIP y DAISY de texto/audio (sin sincronización SMIL de momento); pistas MP3, M4A, M4B, WAV, OGG y AAC por reproductor local básico de primer plano. No se afirma lectura de PPT/PPS/XLS antiguos, PDF escaneado, DRM, conversión perfecta de tablas/estructuras, ni audiolibros con servicio multimedia de fondo. La lectura DAISY actual **no** promete navegación sincronizada texto/audio.
- Los archivos están en la biblioteca privada del prototipo; no se migra ni comparte la biblioteca de la app comercial. Desinstalar una APK debug de distinta firma destruye esos datos del prototipo. Conservar originales hasta que exista firma estable, pruebas de importación y persistencia verificadas.
- En esta iteración los usuarios todavía deben validar títulos/tipos distintos en Pixel, controles ajustables, su locución, reapertura de libros y estados sin conexión. Compilar NO demuestra usabilidad.

# Estado actual del prototipo — 0.7 (TifloLector, primera fase, 26/10/2026)

Esta sección actualiza el alcance inicial de este README. Las secciones históricas de fases anteriores se mantienen como registro, pero no describen la totalidad de las funciones de la versión 0.7.

- La portada tiene Actualidad, Recursos, TifloLector y Vídeos. TifloLector usa Compose nativo y una biblioteca **privada del prototipo**, sin leer, modificar ni migrar los archivos de la aplicación Android de Google Play.
- Una única opción **Importar** permite copiar de Archivos TXT, HTML, HTM, MD y Markdown (hasta 4 MB). El importador rechaza expresamente formatos aún no admitidos. Al abrir un título de Mi biblioteca se entra directamente a la lectura.
- Lectura por síntesis TTS instalada en Android, reproducir/pausar primero, selector de unidad Bloque/Párrafo/Frase (control ajustable TalkBack), anterior/siguiente, porcentaje, salto en pasos de 10 %, marcas guardadas, velocidad y retorno claro.
- Portada del lector compacta: Importar, Ajustes, Filtros, Mi biblioteca y Marcas; los submenús abren cerrados y la lista de libros está paginada de diez en diez, con títulos exclusivamente.
- Los libros se almacenan en archivos privados internos y el índice guarda posiciones y marcas. No se anuncian automáticamente en directo los cambios de progreso para evitar solapamiento con TalkBack.
- **Importante:** La firma debug de GitHub Actions aún puede variar de una compilación a otra. Desinstalar el prototipo para instalar una APK distinta **borra su biblioteca de pruebas**. No guardar documentos importantes como única copia aquí. Se debe resolver una firma de pruebas persistente antes de tratar la biblioteca como duradera.
- Todavía no están implementados el importador PDF/DOCX/EPUB/DAISY/Office, OCR, exportación, carpetas, cola, lectura de audio, biblioteca remota, motores de voz alternativos ni migración desde la app publicada. No presentar esta prueba como lector completo.
- Para considerar la fase aceptada faltan **pruebas reales en Pixel/TalkBack**: importar TXT, lectura con pantalla encendida y bloqueada (no garantizada todavía), suspender y reanudar, uso del selector vertical, marca, porcentaje, regreso a biblioteca, cierre/reapertura y contraste de idioma.
- El ajuste 0.6 de flic de Vídeos se arrastra a esta rama pero **no se considera validado en dispositivo** hasta que el usuario lo confirme.
- Sin publicación en Google Play ni cambios en iOS, la web ni las bibliotecas de usuarios.

# TifloAcosta Nativa Pruebas — fase 1

Prototipo **independiente** en Kotlin y Jetpack Compose. Instalación paralela
con paquete `com.tifloacosta.nativeprototype`; **no** reemplaza TifloAcosta de Google Play
(`com.tifloacosta.app`) ni las APK de pruebas del proyecto Capacitor.

## Alcance de este primer prototipo
- Portada mínima: Actualidad y Recursos.
- Catálogo publicado `https://tifloacosta.com/mobile-content.json` (solo consulta).
- Selector de formato multimedia y selector de categoría en Actualidad.
- Selector de categoría en Recursos y listado inferior filtrado.
- Selector accesible discreto basado en Slider nativo Compose y acciones
  personalizadas de anterior/siguiente. TalkBack debe comprobarse físicamente:
  los gestos arriba/abajo dependen del elemento enfocado y de la configuración.
- Un solo título accesible por documento o noticia, con su detalle al activar.
- Selecciones que se conservan en pantalla; listado de hasta diez entradas y
  botón para mostrar otras diez; cache local del último catálogo válido.
- Español e inglés según idioma del dispositivo, texto grande y tema oscuro.

## Segunda revisión — tras prueba en Pixel
- El selector ajustable **ya fue probado en Pixel con TalkBack**: funcionan
  los gestos arriba y abajo, y actualiza los resultados.
- Portada auténtica con entradas a Actualidad y Recursos; botón «Volver» en
  ambas pantallas, junto con el gesto o botón Atrás del sistema.
- Al regresar se conserva la opción elegida; los resultados permanecen filtrados.
- Menos indicaciones repetidas: se elimina la acción accesible «Abrir detalles»
  que duplicaba la activación normal del título, y el mensaje de instrucción
  innecesario que aparecía antes de seleccionar una categoría.
- Mantener las indicaciones nativas útiles del control ajustable. Para
  identificar cualquier repetición que persista, registrar la frase exacta
  que TalkBack anuncia en la prueba física antes de suprimir semántica que
  sostiene los gestos ya confirmados.
- En TalkBack existe «Activación con un toque» en Configuración avanzada:
  ajuste **del sistema**, opcional, a decisión del usuario. También admite
  el gesto «toque dividido» con dos dedos, uno manteniendo contacto.
- La firma efímera del APK debug puede exigir desinstalar **solo** «TifloAcosta
  Nativa Pruebas» antes de instalar un nuevo APK; nunca la app de Google Play.

## Quinta revisión — módulo Vídeos, cuenta de Google y gestos TalkBack (0.5)

- Nuevo botón «Vídeos» en la portada, separado del catálogo editorial de
  Actualidad, para los vídeos del catálogo de TifloAcosta.
- El reproductor integrado permite navegar con **flic arriba/abajo** por un
  selector ajustable de acciones; control separado «Ejecutar» evita depender
  de pulsar todos los botones. Conserva botones individuales y saltos 30 s.
- Acciones de Google dentro del reproductor: «Me gusta», «Suscribirme»,
  «Comentar» (campo editable + «Publicar» explícito), «Cerrar sesión»,
  compartir y enlace alternativo a YouTube.
- Se reutiliza el **Worker OAuth de YouTube ya desplegado**:
  `/auth/native/start`, `/auth/native/exchange`, `/session`, `/state`,
  `/like`, `/subscribe`, `/comment`. No cambian rutas del servidor.
- La identificación de Google se abre en el navegador externo. Android recibe
  el retorno `tifloacosta://youtube-auth` en la app nativa de pruebas; la
  app original Android no registra este filtro. Se utiliza desafío PKCE
  adicional; se cifra la credencial de sesión con Android Keystore (AES-GCM).
  No se solicita ni almacena la contraseña de Google, ni sus refresh tokens.
- El vídeo puede reproducirse sin iniciar sesión. Si el servicio de YouTube
  falla, el reproductor y el acceso externo siguen disponibles.
- El usuario debe probar **en su Pixel 10** el ciclo completo Google → regreso
  a la app nativa → Me gusta → Suscripción → Comentar → Cerrar sesión.
  Compilar no certifica el funcionamiento real de OAuth, cuotas o TalkBack.
- La firma de las APK de prueba puede cambiar entre compilaciones:
  el usuario puede tener que desinstalar solo el prototipo. PENDIENTE firma fija.

## Cuarta revisión — reproductor nativo accesible de YouTube (0.4)

- Al abrir un título de vídeo de YouTube se presenta la reproducción dentro
  de TifloAcosta, sin salir automáticamente a la app de YouTube.
- Se usa **exclusivamente la API oficial YouTube IFrame**, a través de WebView
  con `loadDataWithBaseURL` y origen identificado con el ID de esta aplicación.
  No se descargan ni extraen contenidos de YouTube.
- Controles Android Compose accesibles por TalkBack: Reproducir/Pausar,
  retroceder/avanzar 30 segundos y posición ajustable, con botón Volver.
- Si el vídeo no tiene un enlace individual o YouTube impide embeberlo,
  sigue disponible «Abrir en YouTube (alternativa)».
- No se afirma que todos los vídeos se puedan embeber; depende de
  restricciones del contenido, YouTube y WebView. Validación física pendiente.
- Los podcasts todavía usan enlace externo hasta añadir reproductor
  de audio Media3 en la siguiente fase.
- No modifica TifloAcosta Play Store ni la instalación antigua.

## Tercera revisión — multimedia editorial en Actualidad

- Contenidos «Podcasts», «Canales de YouTube» y «Todos los formatos»,
  integrados en el selector nativo de Actualidad y cargados desde el mismo
  catálogo `https://tifloacosta.com/actualidad-media.json` usado por iOS.
- Al elegir el formato, se filtran los episodios/vídeos debajo, sin presentar
  noticias de otra categoría. Se puede ajustar «Fuente o canal» e «Idioma»
  deslizando arriba/abajo con TalkBack.
- Un único botón por título; detalle con fuente, descripción y enlace.
  El audio y los vídeos se abren en su fuente externa: **todavía no existe
  reproductor multimedia nativo ni autenticación YouTube**.
- Mantiene copia del catálogo válido para la consulta sin conexión.
- Pruebas unitarias de filtros, idioma, canales y enlaces HTTPS seguros.
- Se mantiene el botón Volver de 0.2 y el regreso desde el diálogo.
- Versión interna `0.3-prototipo`. No modifica TifloAcosta de Google Play.

## Fuera de alcance de la fase 1
Autenticación de Google, comentarios y acciones de YouTube, reproductores,
reproductores y reproducción integrada, biblioteca personal, TifloLector, importación,
archivos, OCR, Media3, notificaciones y migración de datos. Esas funciones
**siguen en las aplicaciones existentes**. Las opciones de multimedia de esta
prueba muestran el catálogo editorial por enlace externo; no hay reproductor integrado.

## Compilación
Con JDK 17, Android SDK API 36 y Gradle 8.14.3:
`gradle -p android-native-prototype :app:testDebugUnitTest :app:assembleDebug`

La APK se genera como `android-native-prototype/app/build/outputs/apk/debug/app-debug.apk`.
CI de esta rama no tiene claves de firma de publicación, no toca Play Console y
sube solo la APK de prueba como artefacto.

## Validación obligatoria con TalkBack
1. Enfocar «Categoría» y comprobar que anuncia la opción seleccionada.
2. Probar gestos arriba/abajo y menú de acciones personalizadas en Pixel.
3. Cambiar de categoría sin perder foco y recorrer solo los títulos filtrados.
4. Probar doble toque en un título, abrir/cerrar detalle y volver al título.
5. Probar modo de letra grande, tema oscuro, idioma inglés y conexión fallida.
6. Verificar que las tres apps se pueden instalar sin afectarse entre sí.

No fusionar ni publicar hasta pruebas reales y decisión expresa.
Relacionado: incidencia #249 y estudio maestro #243.
