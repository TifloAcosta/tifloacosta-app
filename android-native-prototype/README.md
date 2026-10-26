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

## Fuera de alcance de la fase 1
Autenticación de Google, comentarios y acciones de YouTube, reproductores,
podcasts y contenido multimedia, biblioteca personal, TifloLector, importación,
archivos, OCR, Media3, notificaciones y migración de datos. Esas funciones
**siguen en las aplicaciones existentes**. Las opciones de multimedia de esta
prueba indican claramente que todavía no están integradas.

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
