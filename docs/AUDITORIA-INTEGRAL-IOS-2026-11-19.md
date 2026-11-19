# Auditoría integral de la actualización iOS — 19 de noviembre de 2026

## Alcance y criterio de aprobación

Versión candidata de desarrollo: `feature/mi-musica` (integración `97890c5`, corrección posterior del flujo TestFlight `08c269d`). Se contrasta contra el documento maestro `docs/PLAN-MAESTRO-PROXIMA-ACTUALIZACION-IOS-2026-11-09.md`, las decisiones posteriores de «Mi música» y la base reciente de iOS `a1137c8`.

**Dictamen: integración estática y pruebas de contratos satisfactorias; candidata todavía NO aprobada para su distribución de prueba.** Faltan el resultado verificable de compilación Swift en macOS del último commit, pruebas funcionales con iPhone/VoiceOver y comprobaciones reales de los servicios externos y permisos. Los tests Node verifican contratos y estructura, no sustituyen una compilación Swift ni una prueba funcional.

## Preservación de la versión reciente

Se tomó como base el árbol iOS de `a1137c8`, no el árbol iOS incompleto de la antigua rama musical. La comparación de `ios-app-native` respecto de dicha base muestra únicamente estos cambios funcionales: `Info.plist`, `MusicLocalized.swift`, `NativeAppleMusic.swift`, `NativeAudiusMusic.swift`, `NativeJamendoMusic.swift`, `NativeMusicPlayer.swift`, `NativeMyMusic.swift`, `NativeRadioBrowser.swift`, `NativeTifloLector.swift`, cinco catálogos `Localizable.strings`, y dos pruebas de MusicKit/consolidación. Los demás componentes iOS de la base reciente se conservan; fuera de iOS, el primer padre de la rama de música permanece como base de contenido. No se ha iniciado desarrollo Android en este proceso de integración.

## Matriz de acuerdos: estado en código y evidencia

**Leyenda:** `P` = preservado/implementado en código y cubierto por pruebas de contrato; `I` = integrado en código nuevo con contratos; `V` = pendiente de validación funcional en dispositivo; `R` = requiere revisión adicional antes de declarar cobertura completa. Ninguna marca `P` o `I` significa «validado en iPhone» ni «publicado».

| Acuerdos | Estado | Evidencia local y comprobación pendiente |
| --- | --- | --- |
| A01 búsqueda en documentos; A02 diccionario y ayudas; A03 estadísticas; A04 colecciones | P/V | Pruebas de lectura, búsqueda, biblioteca y actividad en `ios-app-native/tests/`; recorrer con documentos reales y VoiceOver. |
| A05 respaldo de TifloLector | P/V | Pruebas de biblioteca, exportación, conservación de originales y recuperación; verificar copia/restauración con datos preexistentes. |
| A06 continuar vídeo; A07 ver después; A08 búsqueda por canal | P/V | `videos-watch-later-resume-20261110.test.mjs`, `youtube-discovery-contract.test.mjs`, `youtube-followed-publication-order-20261111.test.mjs`. |
| A09 pódcast: posición y descarga; A10 reproducción continua | P/V | `podcast-downloads-offline-20261110.test.mjs`, `podcast-resume-continuous-20261110.test.mjs`. |
| A11 noticias para después; A12 filtros de Actualidad | P/V | `reading-activity-news-resources-20261110.test.mjs`, `actualidad-contract.test.mjs`. |
| A13 favoritos Recursos; A14 comprobación de enlaces; A15 historial consultado | P/V | `resource-actions-contract.test.mjs`, `favorites-share-search-contract.test.mjs`, `reading-activity-news-resources-20261110.test.mjs`; enlaces públicos requieren red real. |
| A16 retomar actividad; A17 verbosidad | P/V | Pruebas de actividad y `simple-settings-accessibility-20261111.test.mjs`, `global-voiceover-minimalism-20261119.test.mjs`. |
| A18 enviar incidencias; A19 versión y novedades; A20 diagnóstico accesibilidad | P/V | `accessibility-diagnostics-phase9-20261110.test.mjs` y pruebas de ajustes; verificar acción final del envío. |
| A21 Siri y Atajos | P/V | `siri-shortcuts-20261110.test.mjs`; invocar atajos en iPhone. |
| B01 control ajustable VoiceOver; B02 salto 5 %; B04 toque mágico | P/V | `reader-phase-two-contract.test.mjs`, `quick-bookmark-shortcuts-20261111.test.mjs`, `reader-final-recovery-controls.test.mjs`. |
| B03 pausas por puntuación | P/V | `NativeReaderSettings.swift`: Normal, Mayor, Expresiva y Personalizadas con coma, punto y coma, dos puntos, fin de frase y párrafo. `music-consolidation-contract.test.mjs`. Verificar auditivamente cada modo. |
| B05 nombre original; B06 Guardar; B07 DAISY en biblioteca; B08 título al eliminar | P/V | `reader-phase-three-contract.test.mjs`, `reader-safe-export-library-20261113.test.mjs`, `reader-phase3-original-preservation-20261109.test.mjs`. |
| B09 marcas con contexto; B11 índices DAISY y tiempos internos | P/V/R | `reader-phase-two-contract.test.mjs`, `reader-daisy-clock-consistency.test.mjs`; el soporte universal de todas las estructuras DAISY no queda demostrado sin corpus representativo. |
| B10 Eloquence y otras voces del sistema | P/V/R | Pruebas de motores/lector; confirmar en un dispositivo las voces efectivamente instaladas y su salida de audio. |
| Voces Gemini y muestra de ajustes | P/V | `NativeReaderExternalVoiceCredentials.swift`: botón «Escuchar muestra» y `geminiPreview.listen`; la integración de MusicKit no sustituye este módulo. |
| Catálogo de Píldoras 25, Novedades, Recursos y descarga alternativa | P/V | `catalog-sync-phase-one.test.mjs`, `novedades-contract.test.mjs`; comprobar dominio público y actualización manual en iPhone. |
| Traducción bajo petición, notificaciones solo propias, seis idiomas | P/V | `on-demand-translation-20261110.test.mjs`, `own-updates-notifications-20261110.test.mjs`, `final-language-coverage-20261112.test.mjs`. Español de base y catálogos completos en EN/PT/FR/IT/DE. |
| «Mi música»: archivos, carpetas, listas, reproductor, ecualizador y respaldo | P/V | `NativeMyMusic.swift`, `NativeMusicPlayer.swift`, `music-navigation-equalizer-20261119.test.mjs`, `recovery-true-public-music-contract.test.mjs`; ensayo de copia, mezcla y restauración con biblioteca real. |
| Radio y Audius; Apple Music con autorización individual | P/V | `music-free-radio-20261119.test.mjs`, `music-audius-free-20261119.test.mjs`, `music-apple-musickit-20261119.test.mjs`; servicios, suscripción y red requieren ensayos reales. |
| Jamendo sin inicio de sesión y listas mixtas Apple/Audius/Jamendo/locales | I/V | `NativeJamendoMusic.swift`, `NativeMyMusic.swift`, `music-consolidation-contract.test.mjs`; confirmar reproducción, licencias/condiciones de uso y recuperación de canciones remotas. |
| Exclusión mutua del audio y mandos de auriculares | I/V | `NativeRemotePlaybackOwner`, pruebas `headphone-remote-playback-20261119.test.mjs` y consolidación; prueba con auriculares, pantalla bloqueada e interrupciones. |
| Permisos y secretos | P/V/R | MusicKit habilitado en `Info.plist`, sin añadir secreto Jamendo ni clave privada Apple al código. Revisar credenciales de firma y entitlements de distribución del archivo IPA. |
| Automatización de TestFlight | P/V | `.github/workflows/ios-native-testflight-upload.yml`: inicio solo manual, versiones de app/extensión coordinadas, validación IPA antes de subir. No se ha ejecutado el envío para esta candidata. |

## Resultados reproducidos en esta auditoría

- `npm test`: **461 tests aprobados, cero fallidos**.
- `node --test ios-app-native/tests/*.test.mjs`: **332 tests aprobados, cero fallidos**.
- Cinco catálogos adicionales de traducción preservados: **879 entradas por idioma**, sin claves duplicadas ni formatos incompatibles en la revisión de consolidación.
- GitHub: rama existente `feature/mi-musica`, sin abrir una rama remota adicional. La corrección del flujo de publicación se incorporó a su commit `08c269d`.
- **No** se ha obtenido en esta auditoría un registro verificable de `xcodebuild` sobre el último commit. El entorno Linux local no dispone de Xcode. No declarar la compilación nativa aprobada sin ese resultado.

## Barreras antes del TestFlight integral

1. Verificar que GitHub Actions `iOS native SwiftUI compilation` terminó correctamente para la revisión consolidada, incluidas la extensión Compartir y la compilación del simulador; corregir cualquier error Swift encontrado.
2. Verificar que los perfiles de aprovisionamiento renovados incluyen MusicKit, sin modificar credenciales ajenas, y que el IPA firmado contiene los entitlements y números de compilación coherentes.
3. Confirmar el uso permitido por las condiciones de Jamendo en una aplicación distribuida y, si hay finalidad comercial, tramitar el permiso o plan correspondiente; no deducir derechos de reproducción por disponer de un ID de API.
4. Preparar una única ronda de prueba integral en TestFlight: lector, voces, pausas, marcas, DAISY, catálogo público, idiomas, YouTube, pódcast, Actualidad, Recursos, Siri y música de los cuatro orígenes; accesibilidad con VoiceOver y auriculares.
5. Probar con datos previos las rutas de actualización y restauración sin pérdida de bibliotecas, marcas, listas ni archivos originales.
6. Una vez superada la compilación y la revisión técnica y alcanzado el punto de prueba conjunta acordado, ejecutar el flujo manual ya existente. **No publicar en App Store sin validación posterior de Tony.**

## Política de ramas

La única rama activa de integración para esta candidata es `feature/mi-musica`. No crear ramas adicionales para cambios de esta versión. Las referencias antiguas de recuperación pueden conservarse temporalmente para trazabilidad y no deben fusionarse de nuevo como fuente de código. Cualquier borrado de ramas históricas debe efectuarse solo después de comprobar su finalidad y que no contienen trabajo exclusivo necesario.

## Rectificación de auditoría funcional: decisiones de 16–19 de noviembre

**Esta sección sustituye cualquier afirmación anterior de «completo» para las funciones que se detallan.** La auditoría inicial contrastó principalmente nombres presentes en código y pruebas de contrato, no el comportamiento solicitado en las conversaciones. El historial conversacional recuperado es parcial; las referencias conocidas se separan de las promesas del asistente. No se autoriza cerrar la candidata todavía.

### TifloLector: discrepancias demostradas

- **Muestra de cambios de voz: AUSENTE.** En `NativeReaderAudioControls` no hay botón para probar conjuntamente velocidad, tono, pausas y voz. Los botones de muestra existentes están dentro de Gemini y Phonon. **Decisión corregida por Tony:** personalizar una voz concreta, escuchar una muestra **antes de guardar**, confirmar o cancelar; otras voces conservan su comportamiento natural. Debe conservar ajustes independientes por identificador de voz y ofrecer restablecimiento natural. Los actuales controles generales y por documento no equivalen a este requisito.
- **Braille continuo: AUSENTE.** `NativeReaderTextLayout` divide el texto en fragmentos de hasta 1800 caracteres y `readerFragment` expone elementos separados. Falta una modalidad de recorrido continuo de todo el documento sin tener que pasar manualmente al siguiente fragmento.
- **OCR multilingüe: PARCIAL.** `NativeReaderOCRSettingsScreen` ofrece detectar automáticamente, español, inglés y ambos. Vision dispone de detección automática, pero no existe una selección explícita de otros idiomas acordados ni una lista dinámica de los idiomas realmente soportados.
- **Enlaces con doble toque en la lectura: PARCIAL.** Se extraen enlaces HTML/EPUB, existe navegación «Enlaces» y la acción «Abrir enlace actual», pero los fragmentos normales del lector siguen siendo `Text` estáticos, no enlaces interactivos activables directamente con doble toque. Las URLs visibles detectadas sin estructura no se resuelven en `activateCurrentLink` como enlaces externos.
- **Seleccionar y copiar: PRESENTE EN CÓDIGO.** `NativeReaderSelectableText` presenta un `UITextView` seleccionable y la acción `Seleccionar y copiar texto` conserva la posición al cerrar; pendiente ensayo VoiceOver.
- **Nombre de conversión: PRESENTE EN CÓDIGO.** Decisión recuperada del 19/11: sustituir «Exportar audio o DAISY» por «Convertir a audio o DAISY». En biblioteca y lector aparece el nuevo nombre; «Compartir documento original» y «Compartir libro DAISY completo (ZIP)» son acciones distintas.
- **Voice Dream y DAISY con audio: SIN VALIDACIÓN COMPLETA.** El diálogo recuperado del 17/11 describió que Voice Dream ignoraba el audio del DAISY texto+audio; hay que acreditar un audiolibro exportado con MP3 reproducible, no inferir compatibilidad a partir de generar un ZIP.

### «Mi música»: contraste de diseño aprobado frente a pantalla actual

Fuente de requisitos: `docs/superpowers/specs/2026-11-17-mi-musica-design.md` y decisiones recuperadas del 17–19 de noviembre.

- **Menú de organización: PRESENTE.** La pantalla conserva «Organizar mi música» con Importar canciones, Importar carpeta, Crear carpeta, Crear lista de reproducción y Crear carpeta inteligente. Es un menú dentro de una sección final, después de listas y carpetas; verificar si el acceso y el orden final cumplen la prioridad de diseño indicada por Tony.
- **Fuentes externas de archivos: PENDIENTE.** La especificación contempla Google Drive, Dropbox, OneDrive y MEGA con autorización, elección de carpeta y adaptadores. `NativeMyMusic.swift` solo importa archivos o carpetas seleccionados mediante el selector de Archivos; esto no es una conexión persistente ni un adaptador autenticado de dichos servicios. «Desde Archivos o nube» no equivale a conectores API completos.
- **Biblioteca virtual avanzada: PARCIAL.** Existen carpetas virtuales y listas; las carpetas inteligentes solo admiten la regla «título contiene». No hay reglas completas por artista, género, fecha y reproducciones ni una interfaz para reordenar canciones de una lista. Las carpetas virtuales no deben tocar archivos originales.
- **Listas mixtas: PARCIAL.** Se guardan referencias a Apple Music, Audius, Jamendo y pistas locales, pero «Reproducir lista» construye la cola exclusivamente con `playlist.trackIds` locales; las entradas remotas tienen botones individuales. Falta reproducción continua y secuencial de listas mixtas, incluida gestión de pistas no disponibles.
- **Ecualizador: PARCIAL.** Hay cinco bandas, perfiles predefinidos, ajuste general y excepción por canción **local**. No aparecen los perfiles por álbum ni por lista acordados, ni una precedencia canción > lista > álbum > general para todas las fuentes.
- **Destino de copia automática: PENDIENTE.** Tony aprobó respaldo manual y automático con destino predeterminado modificable. El destino automático actual está fijado dentro del almacenamiento de `MiMusica/Respaldos` y solo se comprueba al abrir la sección, sin selector de destino. Las copias completas manuales existen.
- **Reproductor: PRESENTE PARCIAL.** AVAudioEngine local tiene cola, anterior/siguiente, salto de 15 s, aleatorio, repetición, temporizador y controles remotos. Falta demostrar continuidad y equivalencia de las funciones en Apple Music, Audius, Jamendo y radio, además de accesibilidad real.
- **Plataformas: INTEGRADAS A NIVEL DE CÓDIGO.** Radio, Audius, Apple Music y Jamendo aparecen enlazadas; la autorización, disponibilidad de catálogo, licencias de Jamendo y reproducción real aún requieren comprobación.
- **Idiomas: PENDIENTE AUDITORÍA EN PANTALLA.** Hay catálogos ES/EN/PT/FR/IT/DE y pruebas de presencia, pero las interpolaciones, descripciones y errores de las nuevas pantallas no están acreditados individualmente en cada idioma de dispositivo. La existencia de 879 claves por idioma no demuestra cobertura total de la experiencia musical.

### Criterio de salida

No dar por concluida la compilación candidata ni ejecutar TestFlight hasta: (1) recuperar y clasificar la mayor cantidad verificable de decisiones de los intercambios originales, (2) resolver cada incumplimiento funcional anterior, (3) probar contratos de comportamiento y compilación Swift en macOS, (4) preparar una única prueba integral en iPhone con VoiceOver. Las partes del historial a las que no se tenga acceso deben quedar identificadas explícitamente como no verificadas. No abrir ramas remotas adicionales.

### Progreso de corrección — 19/11, revisión posterior

Commit de trabajo `d13305e` en la misma rama `feature/mi-musica`:

- OCR: añadidas selecciones de portugués, francés, italiano y alemán, conservando índices antiguos; se consulta la compatibilidad de Vision y, si el idioma no está disponible, se utiliza detección automática. **Implementado en código, sin compilación Swift ni validación de dispositivo todavía.**
- Enlaces de documentos: los URL externos y enlaces descriptivos estructurados con destino web se representan como atributos `.link` dentro de los fragmentos visibles, además de conservar la navegación existente. **Implementado en código, falta comprobar doble toque de VoiceOver en iPhone y textos extensos.** No se afirma activación directa de referencias internas.
- Pruebas automatizadas iOS de la nueva revisión: **336 aprobadas, cero fallidas**. Pruebas generales: **461 aprobadas, cero fallidas**. Estos contratos no equivalen a compilación Swift.
- Permanecen pendientes: vista previa/guardar perfiles por voz individual, braille continuo, las diferencias de listas mixtas, perfiles de ecualización, destino de copias, reglas inteligentes, fuentes remotas y auditoría de idiomas en pantallas.

No ejecutar TestFlight todavía.

### Progreso de corrección — perfiles individuales de voz

Commit `358ef47` sobre la misma rama, sin TestFlight:

- Se añadió un perfil opcional por identificador de voz del sistema, con velocidad, tono, modalidad de pausas y cinco duraciones individuales. Una voz sin perfil conserva velocidad y tono normales, sin pausas adicionales. Las preferencias generales antiguas que no sean naturales se migran a la voz que estaba seleccionada, sin extenderlas a las demás.
- Los ajustes se editan en un borrador. «Escuchar muestra» usa ese borrador, «Guardar cambios de esta voz» lo confirma, «Descartar cambios» recupera el guardado y «Restablecer voz natural» elimina el perfil de esa voz. Hay botón «Detener muestra».
- El lector consulta el perfil de la voz seleccionada tanto desde la biblioteca como dentro de la obra; las preferencias particulares ya existentes del documento conservan precedencia cuando están configuradas.
- Se añadieron traducciones de los nuevos controles a EN/PT/FR/IT/DE. **339 pruebas automatizadas iOS y 461 generales aprobadas.** La compilación Swift y la prueba auditiva con VoiceOver siguen pendientes. No declarar el comportamiento validado en iPhone.
- Continúan abiertos braille continuo y las discrepancias de «Mi música» descritas anteriormente.

### Progreso de corrección — lectura braille continua

Commit `5369940` en `feature/mi-musica`:

- En modo Braille, los documentos de texto utilizan una superficie `UITextView` continua en vez de los fragmentos independientes de 1800 caracteres de SwiftUI. El resto de modalidades conserva el diseño actual.
- Se intenta recuperar el cursor de lectura y guardar sus cambios en caracteres mediante el delegado de selección; los enlaces URL conservan la detección nativa de iOS. Los prefijos Markdown `#` de encabezados se ocultan sustituyendo caracteres por espacios de igual longitud para no desplazar las posiciones guardadas.
- Pruebas automatizadas: **342 de iOS y 461 generales aprobadas**, sin fallos. **Pendiente de compilación Swift y validación en dispositivo con línea braille real**: estos tests no demuestran por sí solos que VoiceOver permita recorrer todo el documento sin una acción adicional.

Las diferencias de «Mi música» siguen pendientes; no se ha ejecutado TestFlight.

### Progreso de corrección — destino de copias de «Mi música»

Commit `7e9e461`:

- Se añadió «Elegir destino de copias automáticas» en Ajustes de Mi Música, con selector de carpetas, conservación del permiso mediante bookmark de URL, indicación del destino actual y «Restablecer destino interno».
- Si un destino previamente elegido es inaccesible o el bookmark ha caducado, no se marca la copia como completada: se muestra un error. La copia automática continúa intentándose únicamente al abrir Mi Música cuando vence su intervalo; no se promete ejecución en segundo plano.
- Se añadieron las etiquetas a EN/PT/FR/IT/DE. **344 tests iOS y 461 generales aprobados**; pendiente compilación Swift y comprobación con carpetas reales de Archivos/iCloud y VoiceOver.

Se mantienen pendientes la reproducción continua de listas mixtas, perfiles de ecualización por lista/álbum, reglas inteligentes y las conexiones de almacenamiento externo.
