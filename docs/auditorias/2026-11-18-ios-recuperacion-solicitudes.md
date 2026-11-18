# Auditoría de recuperación iOS — 18 de noviembre de 2026

**Producto:** TifloAcosta / TifloLector, canal privado TestFlight.  
**Referente obligatorio:** versión **1.3 (500157)** aprobada para App Store. Commit de procedencia **`93dd4573fb2b32dc38bffd3c9b7f9871905b1575`**, ejecución de compilación pública **43600921226** y publicación **43601415447**.  
**Rama de recuperación:** `recovery/ios-true-public-500157-20261118`.  
**Criterio:** ninguna función se considera comprobada en un iPhone por superar pruebas de inspección del código. «En código» significa que la implementación está en la rama; «Pendiente» significa que falta implementación o evidencia de funcionamiento real.

## Diagnóstico de la regresión

Las compilaciones privadas de recuperación anteriores se prepararon desde ramas que **no correspondían al código de la compilación pública 500157**. Se mezcló trabajo de Mi Música con pantallas antiguas. De ahí la reaparición de Recibidos y otros accesos en Inicio, la pérdida de idiomas, la desaparición de preferencias de VoiceOver y los controles diferentes dentro de los libros. Esta rama se reconstruyó desde el commit exacto de la pública, incorporando cambios concretos por separado. No se reutilizaron las pantallas de las ramas regresivas.

## Contraste de solicitudes y estado

| Solicitud de Tony | Estado en la rama actual | Comprobación o siguiente acción |
|---|---|---|
| Partir de la **verdadera pública**, preservando Inicio y presentación de libros | **En código** | Antecedente `93dd4573`, `NativeScreens.swift`, tests de pantalla principal. Pendiente inspección en iPhone. |
| En Inicio, protagonismo a libros; Recibidos, Contacto y Redes, Privacidad y Accesibilidad en Configuración | **En código** | `NativeScreens.swift`, `NativeUpdatesSettings.swift`; contrastar orden exacto con Tony en dispositivo. |
| Recuperar presentación compacta *dentro* de cada libro, sin botones duplicados | **Parcial** | Se conserva el lector público y se sitúa Buscar al lado de Añadir marca. Auditar orden mediante VoiceOver en iPhone. |
| Seis idiomas de interfaz, no solo español e inglés | **En código** | Recursos `es/en/pt/fr/it/de.lproj`, selector `NativeAppLanguage`; faltan comprobaciones de todas las pantallas y nuevas cadenas en dispositivo. |
| Recuperar las tres opciones de detalle que VoiceOver anuncia de cada libro | **En código** | `voiceOverDetailIndex` en ajustes, heredado de pública. Pendiente prueba real. |
| Selección ajustable única de modo de lectura: **voz, visual y braille** | **En código; pendiente dispositivo** | `NativeReaderSettings.swift` presenta tres valores y una preferencia separada para no pisar el foco inicial heredado. |
| Modo braille operable desde la app, no mero envío a ajustes de VoiceOver | **Parcial; pendiente hardware** | La elección Braille es interna y usa el texto nativo con posición y marcas; VoiceOver sigue gestionando la línea física. Validar avance real en braille antes de darlo por resuelto. |
| Pausar sin retroceso; al reanudar continuar exactamente desde la posición | **En código; pendiente dispositivo** | `NativeReadingSpeech.pause/resume` usa detención inmediata y posición de lectura. Falló para Tony en una compilación anterior. **Bloqueante hasta prueba física.** |
| Toque mágico VoiceOver para reproducir/pausar y reanudar desde otra app | **En código; bloqueante de dispositivo** | La acción ahora pausa, reanuda e inicia a petición; falta verificar comportamiento de sistema al regresar a la app y bloqueo de pantalla. |
| Controles de auriculares equivalentes al toque mágico | **En código; pendiente dispositivo** | `MPRemoteCommandCenter` maneja reproducir, pausar y alternar y retira sus acciones al cerrar. No basta para demostrar eventos físicos. |
| Eliminar el ajuste redundante de avance por minuto; ofrecer «un minuto» dentro del modo de navegación | **En código; pendiente dispositivo** | `quickControls` ya no presenta «Intervalo de tiempo» y el selector de navegación incluye «Un minuto», salto de 60 segundos. |
| Buscar texto de un documento, especialmente PDF legible | **Parcial** | Búsqueda nativa `documentSearchSheetContent`; ahora botón visible después de «Añadir marca». Faltan pruebas con PDF reales y normalización de texto. |
| Seleccionar y copiar cualquier fragmento del texto leído | **En código; pendiente dispositivo** | Nuevo `NativeReaderSelectableText.swift` (UITextView de solo lectura y seleccionable), hoja «Seleccionar y copiar texto» y acceso desde Acciones. Validar rotor y selección en VoiceOver. |
| Abrir enlaces y contenido multimedia embebidos en documentos | **Parcial** | Navegación de enlaces y `UIApplication.shared.open` ya estaban; falta probar EPUB/PDF específicos y audio/vídeo embebido. |
| Compartir un DAISY original **completo** (audio y texto), no únicamente su texto | **En código; pendiente dispositivos** | `shareCurrentDocument` intenta compartir `originalURL` del archivo DAISY, conservando el contenedor. Probar ZIP multipista en receptor externo. |
| Exportar documentos a MP3, M4A, WAV o DAISY | **En código** | `NativeGeminiAudioExport.Format`. Esta posibilidad **ya existía** en la pública; no es una función nueva de recuperación. |
| Diferenciar Exportar de Compartir y ofrecer «No compartir y volver a la biblioteca» al terminar | **En código; pendiente dispositivo** | Alerta de exportación completada con salida a biblioteca. Verificar archivo guardado sin compartir. |
| DAISY compatible con otros reproductores, incluidas obras con varias pistas | **PENDIENTE DE PRUEBA** | Hace falta matriz de DAISY text+audio/multipista, reimportación y reproductores independientes. |
| Listas de vídeos con reproducción automática del vídeo siguiente | **En código; pendiente dispositivo** | `NativeYouTubePlayer.swift` enlaza finalización de reproducción y siguiente en secuencias. Probar búsqueda, canales y listas reales. |
| No perder funciones previas de Vídeos: Ver después, canales seguidos, reanudar | **En código** | Se conservaron las pantallas públicas; pruebas de contratos automatizadas. Validación VoiceOver pendiente. |
| Recuperar Mi Música sin sustituir las pantallas correctas | **En código; pendiente dispositivo** | `NativeMyMusic.swift`, `NativeMusicPlayer.swift`, integración aislada en Inicio, cadenas de seis idiomas y guía. Tony tiene propuestas adicionales todavía no detalladas. |
| Eliminar **todo Azure** de motores y opciones | **En código; comprobar distribución** | En esta línea pública no se reintrodujo Azure. Inspeccionar app compilada para referencias antiguas. |
| Mantener Gemini y Phonon como motores externos | **En código** | Integración heredada de pública `NativeReaderExternalVoiceCredentials.swift`; no se sustituyó. |
| Gemini: obtener clave API con ayuda accesible, copiarla y regresar al campo de TifloLector | **Parcial** | Flujo Safari, campo de clave, Keychain y retorno de foco en código; no puede imponerse un botón de regreso dentro de la web de Google. Probar salida de Safari y pegado con VoiceOver. |
| Phonon visible únicamente como disponible si iOS lo soporta, con explicación si no | **En código; pendiente dispositivo** | Comprobación condicional del sistema en ajustes del motor. |
| Idioma en los desplegables de Actualidad | **En código** | `NativeNews.swift`, «Idioma de las noticias»; requiere lectura de VoiceOver real. |
| Acciones de compartir desde las opciones accesibles de documentos | **En código; pendiente dispositivo** | Acción accesible y tratamiento de URL original. Probar rotor y menú de compartir. |
| Preferencias de voz, volumen por voz y demás ajustes acordados | **SIN CIERRE DOCUMENTAL** | Hay controles de voz y velocidad en la pública, pero no hay prueba de la totalidad de los ajustes históricos; revisar solicitudes originales y definir aceptación. |
| Corregir regresiones generales por restaurar versiones antiguas | **En curso** | Las pruebas automatizadas de estructura no sustituyen prueba de navegación real en Inicio, biblioteca, lector, Vídeos, Actualidad y Configuración. |

## Pruebas y límites

- **290/290 pruebas Node aprobadas** para contratos y lógica incluidos en este repositorio, ejecutadas el 18-11-2026 en la rama de recuperación. Se incluyen contratos de Mi Música, búsqueda visible, selección/copia y controles de lectura. Son fundamentalmente pruebas de contratos de código, no de hardware.
- **Sin compilación Xcode ni IPA verificada en esta sesión.** No hay macOS/Xcode disponible aquí; por tanto, tampoco se ha comprobado el comportamiento con VoiceOver, braille, auriculares, PDF real, DAISY multipista o listas reales de YouTube.
- **No se ha enviado esta rama a TestFlight** ni se ha alterado la versión pública. Una batería de tests estáticos aprobada no equivale a un visto bueno de distribución.
- No se ha borrado el historial ni otras ramas: hacerlo antes de compilar, probar y aprobar esta recuperación pondría en riesgo pruebas y trabajo recuperable. Una limpieza de ramas debe limitarse a referencias identificadas tras el visto bueno.

## Puertas obligatorias antes de una compilación privada de prueba

1. Comprobar en iPhone el selector **Voz/Visual/Braille**, el avance de un minuto y especialmente la navegación de una línea braille física.
2. Compilar en macOS con la configuración real de distribución y corregir cualquier error Swift/Xcode.
3. Comprobar con VoiceOver el orden y el contenido de Inicio, Configuración, biblioteca y lector en los seis idiomas; contrastar con la versión 500157 instalada.
4. Probar pausa/reanudación y toque mágico tanto dentro como fuera de la app; probar botón físico de auriculares y bloqueo de pantalla. Si falla cualquiera, **no declarar resuelta la reproducción**.
5. Probar búsqueda en PDF legible, selección y copia, enlaces, compartir DAISY completo y exportación con cancelación de compartir.
6. Probar DAISY multipista con un reproductor ajeno a TifloLector, listas de vídeo consecutivas y Mi Música.
7. Generar un informe de diferencias entre la pública y el candidato, identificar commit/build exactos y solo después autorizar una entrega privada.

**Conclusión:** recuperación correcta del **punto de partida público** y varias novedades incorporadas en código, pero **la próxima compilación aún no supera las puertas de aceptación**. No se debe presentar como terminada o apta para TestFlight hasta cerrar los bloqueantes y las pruebas físicas.
