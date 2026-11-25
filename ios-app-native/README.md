# TifloAcosta iOS — PROYECTO OFICIAL ÚNICO (SwiftUI)

## Arquitectura y ruta única

- **Rama base:** `main`.
- **Proyecto iOS:** `ios-app-native/`, generado con XcodeGen a partir de `ios-app-native/project.yml`.
- **Interfaz:** SwiftUI nativa. El archivo de entrada único es `Sources/TifloAcostaNativeApp.swift`; no se cargan pantallas HTML, WKWebView, Capacitor ni interfaces superpuestas.
- **Identificador de aplicación:** `com.tifloacosta.app`.
- **Extensión Compartir:** `com.tifloacosta.app.ShareExtension`.
- **Grupo de intercambio:** `group.com.tifloacosta.app`.
- **Identidad:** `Sources/TifloVisual.swift`, común a todas las pantallas.
- **Contenido:** catálogo compartido `https://tifloacosta.com/mobile-content.json` (datos, nunca interfaz web).
- **Compatibilidad:** `mobile/` queda como proyecto Android; la web continúa en la raíz.

## Una sola publicación iOS

- Validación: `.github/workflows/ios-native-swiftui-build.yml` (tests y compilación de simulador, no publica).
- Envío: `.github/workflows/ios-native-testflight-upload.yml`, **exclusivamente desde main**, a la aplicación existente en App Store Connect. Firma ambos objetivos y valida que la compilación aparezca en el grupo interno.
- Nuevos cambios en SwiftUI, extensión o configuración de iOS en `main` generan una compilación para TestFlight, después de pruebas de arquitectura. También puede ejecutarse manualmente el flujo de envío.
- La numeración interna aumenta con el número de ejecución; nunca reutilizar una compilación distribuida.
- Antes de anunciar disponibilidad, confirmar que Apple indique **VALID**, estado interno **IN_BETA_TESTING** o **READY_FOR_BETA_TESTING** y grupo interno autorizado.

Los directorios `mobile/ios-swiftui` y sus compilaciones experimentales han sido retirados; el antiguo flujo iOS híbrido de Capacitor se desactiva. `mobile/ios-native` conserva únicamente código de plugin heredado referenciado por el paquete móvil/Android; **no es una app ni se usa para construir iOS**. No reactivar su compilación como una segunda vía de publicación.

## Funciones todavía por terminar

La unificación de la arquitectura no equivale a completar todas las funcionalidades. Recursos y Actualidad usan vistas y acciones nativas de VoiceOver; otras secciones todavía pueden estar incompletas. Hay que comprobar las acciones reales del rotor con VoiceOver en el iPhone. Vídeos y TifloLector requieren completar reproducción, lectura, formatos, configuración y funciones pendientes. La extensión Compartir precisa pruebas con apps externas y formatos reales.

Las compilaciones que sustituyen a la beta híbrida previa pueden necesitar migración explícita de ajustes o documentos antes de una distribución general; no se debe prometer recuperación automática de datos antiguos. La versión 500002 ya se distribuyó para pruebas internas como SwiftUI nativa. **La única fuente para futuras correcciones es este proyecto de main.**

## Reglas obligatorias

1. No añadir nuevos puntos de entrada iOS, prototipos de aplicación ni pantallas HTML.
2. No aplicar una corrección exclusivamente en ramas de experimento; integrar a `main` y comprobar CI.
3. No usar `npx cap add ios`, `npx cap sync ios` ni el paquete móvil híbrido para preparar versiones Apple.
4. No afectar al código Android, web ni al catálogo de contenidos salvo encargo separado.
5. Comprobar los controles con VoiceOver real tras la instalación; una compilación de simulador no valida por sí sola gestos.

### Identificación musical con AcoustID

Registra el cliente de TifloAcosta en https://acoustid.org/new-application si
cumple las condiciones del servicio gratuito para uso no comercial. Configura
el identificador público como ajuste de compilación `TIFLO_ACOUSTID_CLIENT`.
La app deja desactivada la consulta si se construye sin ese valor. El usuario
elige la opción durante la importación o confirma las consultas manuales.

La compilación fija Chromaprint 1.6.2, usa vDSP y prescinde de FFmpeg y de su
remuestreador incluido. AVFoundation decodifica y convierte un máximo de 120
segundos localmente a PCM mono de 11025 Hz. La petición HTTPS de AcoustID
envía la huella comprimida y la duración, sin enviar el archivo de audio.
Solo se conservan título e intérprete de los registros básicos de MusicBrainz
(CC0) ante una coincidencia inequívoca. Se incluye el aviso de licencia de
Chromaprint en la aplicación compilada.

Desde Ajustes de Mi Música, la cuenta AcoustID se puede vincular con un
código de autorización o pegando una clave personal. Para buscar, esta
implementación pide una clave personal incluso antes de enero de 2027.
La clave queda en el llavero de este iPhone y se envía solo en cabeceras
HTTPS. El código de vinculación caduca y no se usa para identificar música.
