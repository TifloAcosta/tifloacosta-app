# TifloAcosta iOS: aplicación NATIVA, sin interfaz HTML

Este proyecto es una aplicación iOS **independiente** de la app Capacitor de `mobile/`. Su punto de entrada es `TifloAcostaNativeApp` y su interfaz se construye con SwiftUI.

- **No** carga `mobile/src/index.html`, **no** presenta WKWebView, **no** combina dos capas de pantallas ni usa controles HTML.
- **No** modifica las aplicaciones web ni Android.
- Usa el catálogo público existente `https://tifloacosta.com/mobile-content.json`; recursos, vídeos y actualidad se muestran como listas nativas y se guardan en caché cuando es posible.
- Presenta los títulos mediante controles accesibles nativos, acciones de accesibilidad SwiftUI y selectores `.accessibilityAdjustableAction` para filtros y orden.
- TifloLector empieza a migrarse con biblioteca nativa separada, importación TXT/PDF con texto, lectura por síntesis de voz, confirmación antes de borrar y regulador de tamaño.

## NO publicar como reemplazo de TestFlight todavía

El identificador temporal `com.tifloacosta.nativeprototype` **impide reemplazar por accidente** `com.tifloacosta.app` antes de alcanzar paridad funcional y migración de datos.

### Faltan funcionalidades antes de sustituir la beta

1. Migrar los documentos, ajustes, marcas y progreso de la biblioteca iOS anterior preservando los datos y sin vaciarla.
2. TifloLector: DOCX, PPTX, XLSX, EPUB, HTML, DAISY, OCR, audio, marcadores, búsqueda, cola, soporte completo de voces y lectura en segundo plano.
3. Vídeos: reproductor interno accesible y funcional, búsqueda general en YouTube, acciones avanzadas y paginación real de resultados; por ahora la reproducción abre la aplicación/sitio YouTube externo.
4. Implementar como pantallas nativas las secciones restantes (Recibidos, Descargas, Favoritos, Podcasts, Mi libro, Contacto, Configuración, búsqueda y compartir).
5. Integrar la extensión de compartir iOS nativa con rutas correctas para archivos y enlaces, notificaciones y accesibilidad del ciclo completo.
6. Verificar en dispositivo real VoiceOver y todos los gestos del rotor. Compilar en simulador **no** acredita compatibilidad del rotor.
7. Cuando todo funcione y el usuario valide la nueva app, configurar firma y publicación con `com.tifloacosta.app`, retirando del lanzamiento iOS la compilación Capacitor.

### Compilación de prueba

La acción de GitHub `iOS native SwiftUI compilation` genera un proyecto Xcode con XcodeGen y lo compila sin firma para simulador. La compilación *no* envía nada a Apple.

**Criterio de arquitectura:** una sola interfaz nativa para cada sección; el contenido remoto puede ser texto o documentos, pero nunca una segunda interfaz web superpuesta.
