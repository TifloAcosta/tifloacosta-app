# Plan de acción: convergencia segura de TifloAcosta Android hacia la experiencia iOS

Fecha de apertura: 26 de octubre de 2026  
Estado: planificación aprobada para comenzar por auditoría y cambios no productivos. **No se ha publicado ninguna versión Android ni iOS.**  
Referencia inicial: `main` en `df988198227386ed3c8ccba65aab30f639944eeb`. Rama de trabajo de planificación: `plan/android-paridad-ios-segura-20261026`.

## 1. Finalidad y límites

Aproximar la organización, navegación, claridad de acciones y funciones accesibles de Android a la experiencia actual de TifloAcosta iOS, **sin sustituir la arquitectura Android ni reducir prestaciones existentes**. La prioridad es conservar los usuarios, las bibliotecas, la reproducción, las configuraciones y los permisos actuales.

- Fuente Android: `mobile/src/`, `mobile/android/`, `shared/`.
- Fuente iOS: `ios-app-native/` (SwiftUI). La adaptación debe ser **de comportamiento**, no copiar Swift, el rotor de VoiceOver o las API de iOS.
- Mantener `com.tifloacosta.app`, los identificadores y rutas existentes, la infraestructura de notificaciones, la publicación y los proveedores actuales.
- No se retoca `ios-app-native/`, su flujo TestFlight, la web pública, los workers, ni el catálogo compartido salvo que una tarea lo justifique y se revise por separado.
- Ninguna etapa autoriza por sí sola fusionar a `main` o publicar en Google Play.
- «Sin riesgo» absoluto no es verificable: cada acción debe tener alcance acotado, criterios comprobables y vuelta atrás.

## 2. Condiciones previas obligatorias (P0, solo análisis)

**P0.1 — Fijar las versiones realmente instalables**  
Responsable: auditoría + verificación de distribuciones. El código de `mobile/release/request.json` declara versión 1.3.7 en producción y `mobile/release/state.json` conserva 1.3.5 como último éxito; esto no acredita por sí solo qué versión recibe el usuario. Consultar los datos efectivos de Google Play Console y anotar versión, `versionCode`, pista, fecha y SHA del AAB. No alterar estos archivos durante la investigación.  
En iOS, reconciliar el último envío verificable en GitHub Actions (ejecución 47; código `0192e8bc589fcdca7b7badbc6976ece2cad3798b`) con la compilación 500051 referida en App Store Connect. Antes de hacer afirmaciones de paridad, confirmar binario y SHA mediante los registros Apple disponibles.  
**Salida:** ficha de referencia reproducible para ambas plataformas.

**P0.2 — Congelar la base y diseñar respaldo de datos**  
Crear una rama *específica por mejora* desde el SHA acordado de Android (no trabajar sobre `main` directamente). Mantener testigos de instalación con libros importados, posiciones, marcas, favoritos, cola, voces/ajustes, preferencias y notificaciones. Generar una copia de seguridad de prueba y verificar su restauración en entorno de pruebas, no en el teléfono de uso habitual.  
**Salida:** inventario de datos protegidos y procedimiento de recuperación.

**P0.3 — Establecer pruebas de referencia**  
Ejecutar o verificar el estado de: `npm test` en raíz; `npm test` y `npm run test:reading-beta` en `mobile/`; construcción del paquete, `npx cap sync android` y compilación Android de depuración cuando el entorno esté disponible. Los tests por patrones de texto existentes **no sustituyen pruebas de comportamiento**.  
**Salida:** lista de pruebas que pasan, fallan o requieren dispositivo. No proseguir a publicación con fallos sin explicar.

**P0.4 — Asegurar el circuito de pruebas**  
Usar una PR individual por mejora hacia `main`, con revisión del diff y GitHub Actions. Los workflows `test-mobile-foundation.yml` y `bootstrap-mobile-android.yml` se ejecutan en PR con cambios móviles. `release-mobile-android.yml` exige operación específica para publicar o marcador de publicación en `main`; **no modificar `mobile/release/prepare.once` ni ejecutar `publish`**. La validación en PR es técnica, no autorización para distribuir.  
**Salida:** política de integración «revisar → probar → aceptar → fusionar»; publicación siempre en decisión posterior.

## 3. Etapas de implementación ordenadas

### ETAPA A — Mejoras de interfaz con muy bajo riesgo de afectar datos

**A1. Guía de uso integrada y adaptada a TalkBack — primera mejora.**  
Prioridad: alta. Riesgo estimado: bajo. Dependencias: P0, estado de rutas actual.  
Adaptar las doce secciones de la guía iOS al funcionamiento real de Android. Añadir un destino nuevo `usage-guide` sin renombrar ni borrar rutas existentes. Respetar que Inicio comienza por Buscar y Novedades, como exigen las pruebas actuales; situar Guía de uso a continuación. Instrucciones en español e inglés, navegación por sección, botón Atrás y foco devuelto al origen. Explicar gestos TalkBack, no VoiceOver.  
Archivos previsibles: `mobile/src/screens/home.mjs`, nueva pantalla `usage-guide.mjs`, `mobile/src/app.mjs`, `mobile/src/core/i18n.mjs`, pruebas nuevas.  
Aceptación: 12 accesos, textos ES/EN, menú cerrado, cada acceso abre sólo su sección, foco correcto con TalkBack, regreso al Inicio, restantes destinos intactos, pruebas de inicio y navegación aprobadas.

**A2. Actualidad: categorías, búsqueda y paginación.**  
Prioridad: alta. Riesgo: bajo-medio. Dependencias: P0; comprobar que los elementos Android traen `categories`.  
Añadir categorías y búsqueda interna a `mobile/src/screens/actualidad.mjs`, con resultado inicial sin lista masiva, lotes de 10 y «Mostrar diez más». Mantener orden por fecha, idioma, estado leído, favorito, texto de fuente/fecha y apertura de artículos. Reutilizar el contenido ya recibido; **no cambiar workers ni fuentes RSS**.  
Aceptación: cambiar filtro no mezcla categorías; búsqueda vacía no rompe la pantalla; no hay duplicados al paginar; fecha y medio leídos correctamente; la lectura de una noticia y los favoritos funcionan igual que antes; enfoque y anuncio de resultados correctos.

**A3. Vídeos: filtros y orden, sin cambiar reproducción.**  
Prioridad: alta. Riesgo: medio. Dependencias: P0 + confirmar contrato de `youtube-auth.tifloacosta.com/search` para los filtros soportados.  
Añadir filtros de «Todos», «Vídeos», «Canales», «Cortos», «En directo» y «Con subtítulos», condicionados a compatibilidad demostrada del backend; orden reciente/antiguo para vídeos del canal; paginación conservada. Reutilizar `mobile/src/screens/videos.mjs`.  
**Prohibido en esta etapa:** cambiar `video-player.mjs`, IFrame API, política de pantalla encendida, inicio/cierre de sesión Google, acciones «Me gusta», comentarios, autenticación o permisos.  
Aceptación: búsquedas normales, fallos de red y cuotas, paginación por filtro, apertura de canal y reproducción equivalentes a la versión base, posición y saltos ±30 s, retroceso y TalkBack correctos.

**A4. Orden y presentación visual/accesible de Inicio y Recursos.**  
Prioridad: media. Riesgo: bajo-medio. Dependencias: A1 y pruebas de foco.  
Homogeneizar títulos, grupos de acciones, estados expandido/contraído, texto, contraste y espaciado de Android según la experiencia iOS, **sin imponer controles SwiftUI ni rotorcitos de VoiceOver**. Mantener búsqueda global, Novedades, categorías de Recursos y todos los destinos.  
Aceptación: no aumenta el número de gestos de TalkBack para tareas esenciales; lector de pantalla anuncia una vez cada etiqueta; controles ocultos no reciben foco; Dynamic/Font scaling y contraste verificados con vistas grandes.

### ETAPA B — Consolidación funcional conservadora

**B1. TifloLector: ergonomía sin cambiar motores.**  
Prioridad: alta tras Etapa A. Riesgo: medio.  
Comparar los paneles Audio/Voz, Visual, General, Biblioteca y documento individual. Simplificar el orden y evitar controles duplicados sin alterar claves de configuración, filtros, tipos de marcas, persistencia ni acciones existentes. Conservar navegación por frase, párrafo, encabezado y demás unidades, cola y porcentajes.  
**Prohibido:** reemplazar Media3, TTS de fondo, el sistema de voces, la base de datos o los servicios ML Kit.  
Aceptación: leer y reanudar TXT, EPUB, PDF, Office y audio reales; conservar voz, velocidad, temporizador, marcas, porcentaje, cola, botones del sistema, segundo plano, llamadas/Bluetooth y archivos originales.

**B2. Recursos, Descargar desde un enlace, Compartir, Podcasts y Ajustes.**  
Prioridad: media. Riesgo: medio.  
Revisar los recorridos de acciones y etiquetas; corregir únicamente discrepancias demostrables. Mantener Share intents y FileProvider, descargas, permisos, notificaciones OneSignal y la actualización integrada de Play. No añadir permisos o proveedores sin un caso de uso verificado.  
Aceptación: enlace directo y Drive, compartir archivo y texto, importar en TifloLector, favoritos, podcasts, búsqueda/orden y configuración sin regresiones.

### ETAPA C — Carpetas de Biblioteca (diseño separado, NO ejecución por defecto)

**C1. Estudio de migración y copia/restauración.**  
Prioridad: optativa y posterior. Riesgo: medio-alto.  
En Android, `ReadingLibraryDatabase` está en versión 6 y `ReadingBackupService` conserva su formato de paquete. Antes de modificarlo, diseñar carpetas virtuales y migración aditiva 6→7; los libros preexistentes han de quedar en «Sin carpeta» y seguir abriéndose en su misma ubicación. Evitar mover archivos físicos. Definir eliminación de carpeta sin eliminación de documentos. Revisar compatibilidad de importación/exportación y restauración de respaldos v1.  
Aceptación: upgrade con BD poblada y prueba de restauración, reversión documentada, pruebas de instalaciones antiguas y de pérdida de alimentación.  
**No implementar ni fusionar mientras no exista una prueba repetible de migración sin pérdida de datos**.

### ETAPA D — Protección de la cuenta Google y acciones YouTube ya existentes

**D1. Mantener y comprobar, NO rediseñar.**  
El responsable del producto confirma que Android ya ofrece inicio y cierre de sesión de Google y acciones como «Me gusta» y comentar. Son **funciones existentes protegidas**, no mejoras pendientes de desarrollar. Durante A3 y cualquier revisión posterior, no modificar el mecanismo de autenticación, tokens, sesiones, permisos ni acciones sobre cuentas; comprobar inicio, cierre, «Me gusta», comentarios y estados de sesión en la versión Android real. Una diferencia entre la edición distribuida y la rama inspeccionada exige una conciliación del código antes de tocar esa pantalla.

## 4. Reglas estrictas de seguridad y retorno

1. Una rama y una PR por acción A1, A2, A3, A4 y B1/B2. No mezclar migraciones con pantallas ni con credenciales.
2. No tocar `mobile/release/request.json`, `mobile/release/state.json`, `mobile/release/prepare.once` ni workflows de publicación salvo auditoría específica; no aumentar `versionCode` en pruebas.
3. No borrar ni renombrar almacenamiento, bases de datos, identificadores, preferencias o rutas públicas.
4. No ejecutar una actualización destructiva de base de datos (ni reinstalar y perder datos como método de reparación).
5. Cada PR incluye pruebas positivas, pruebas de error y un procedimiento para volver al estado anterior.
6. Antes de integrar: comparar diff, pruebas automatizadas, instalación sobre APK anterior sin desinstalación y batería de TalkBack en teléfono físico, además de controles básicos visuales.
7. No entregar Google Play mientras falte una aceptación funcional expresa. Producción se decide separadamente tras una prueba interna satisfactoria.
8. No interpretar «compila» como «funciona con TalkBack» y no interpretar «iOS tiene el método» como «Android necesita esa misma implementación».
9. Bloquear integración si una función previa deja de funcionar, si se pierde una marca/documento/ajuste, si el foco queda atrapado o si se abre accidentalmente una vía de publicación.

## 5. Matriz de pruebas manuales mínima por iteración

- Iniciar con idioma ES e EN, recorrer Inicio, cambiar idioma y regresar con foco intacto.
- Actualidad: categorías, búsqueda, resultado vacío, enlace, artículo, medio/fecha y favoritos.
- Recursos: seleccionar categoría, leer, guardar, descargar y compartir.
- Vídeos: buscar, «diez más», reproducir, pausar, ±30 s, porcentaje, pantalla visible, pausa y bloqueo normal. No anunciar reproducción con pantalla apagada como disponible.
- TifloLector: importar TXT/PDF con texto/PDF escaneado/EPUB/DOCX/PPTX/XLSX/audio/DAISY de prueba, reproducir, cambiar voz, leer con TalkBack, marcar, reanudar y probar pantalla bloqueada.
- OCR de PDF y traducción por ML Kit con/sin modelos descargados; exportar sin sobrescribir original.
- Descargar desde enlace y Drive, importar desde Compartir, guardar ficheros, recuperar favoritos/cola/puntos de lectura.
- Podcasts, notificaciones y ajuste de tema/tamaño con TalkBack; salida y vuelta de la app; llamada o Bluetooth durante audiolibro.
- Actualizar sobre la compilación Android anterior sin desinstalar y verificar que la base mantiene sus datos.

Las pruebas en dispositivo se harán con TalkBack —preferentemente Pixel 10— y con archivos de test sin datos privados.

## 6. Orden operativo y definición de éxito

- **Paso inicial:** completar P0.1–P0.4 y abrir la tarea A1 en rama aislada.
- **Primera entrega candidata:** A1, únicamente si supera las pruebas de aceptación y no altera funciones existentes.
- **Siguientes candidatos:** A2 → A3 → A4 → B1 → B2. Cambiar el orden solo si una dependencia técnica lo justifica.
- **Fuera de la primera entrega:** carpetas (C1). La cuenta Google, el inicio/cierre de sesión, los «Me gusta» y los comentarios **ya existen y deben preservarse**, sin reimplementación.
- **Éxito:** Android mantiene las funciones actuales, mejora la organización y localización de operaciones, permite acceder con TalkBack sin obstáculos nuevos y alcanza una mayor paridad de experiencia con iOS sin sustituir sus motores.

## 7. Puntos abiertos

- ¿Cuál es la versión y SHA del AAB efectivamente visible en Google Play, frente a los registros locales 1.3.7/1.3.5?
- ¿Cuál es el SHA exacto del binario iOS 500051 en App Store Connect y cómo se relaciona con los envíos de GitHub?
- ¿Qué atributos de categorías ofrece hoy el `mobile-content.json` en Android? ¿Son equivalentes a los de iOS?
- ¿Responde el backend de YouTube correctamente para `all`, `channel`, `short`, `live`, `captions` desde Android sin afectar a la sesión Google y acciones ya operativas?
- ¿Hay un dispositivo de pruebas y un conjunto de archivos de prueba para comprobar upgrades sobre datos persistidos?
- ¿Qué resultados reales de TalkBack deben priorizarse frente a las diferencias puramente estéticas?

## 8. Archivos de partida

- `ios-app-native/Sources/NativeScreens.swift`, `NativeNews.swift`, `NativeUsageGuide.swift`, `NativeTifloLector.swift`, `NativeYouTubeAccount.swift`.
- `mobile/src/screens/home.mjs`, `actualidad.mjs`, `videos.mjs`, `video-player.mjs`, `library.mjs`, `reading-library.mjs`, `reading-book.mjs`.
- `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`.
- `mobile/test/android-start-experience.test.mjs`, `android-resources-youtube-parity.test.mjs`, `reading-library-screen.test.mjs`.
- `docs/platform-convergence.md`, `docs/android-release.md`.
- `.github/workflows/test-mobile-foundation.yml`, `bootstrap-mobile-android.yml`, `release-mobile-android.yml`.

Este plan es un documento operativo, no una prueba de ejecución completada ni una orden de publicación.
