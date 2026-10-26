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
