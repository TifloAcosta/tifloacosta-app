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

### Avance adicional de listas mixtas — 19/11/2026

- El botón «Reproducir lista» ahora utiliza las entradas ordenadas de proveedores mixtos en lugar de solo los IDs locales. Se añadió `NativeMixedMusicQueue` con índice, navegación y descarte de entradas inexistentes.
- El avance al finalizar pistas locales, Audius y Jamendo ya tiene conexiones en código. Para Apple Music se observa el cambio de estado de `playing` a `stopped` mediante MusicKit; la conducta exacta en canciones del catálogo requiere prueba con suscripción e iPhone.
- La pantalla presenta controles accesibles de anterior, siguiente, detener y posición de lista, con traducciones en los cinco catálogos adicionales. Se prepararon rutas de recuperación de referencias remotas inválidas y cancelación de búsquedas al saltar pista.
- Pruebas locales en esta etapa: 357 iOS y 461 generales. Compilación nativa confirmada hasta el cambio `30356451` (fase de compilación Xcode satisfactoria), última modificación `19c4f5fe` aún pendiente de compilación en GitHub.
- **NO CERRADO FUNCIONALMENTE:** no hay todavía prueba real de transiciones entre los cuatro proveedores, fallo tardío de streaming, notificaciones de fondo ni VoiceOver en dispositivo. No confundir pruebas de contrato con reproducción real verificada.

### Avance de ecualización — 19/11/2026

- Ya hay persistencia de perfiles de ecualización para cada lista (`UUID` de lista) en el reproductor local. En una canción de lista se aplica la precedencia **canción > lista > general**. La interfaz permite guardar o retirar el perfil de esa lista y conserva etiquetas traducidas ES/EN/PT/FR/IT/DE.
- Esta mejora no garantiza ecualización de streams externos: Apple Music, Audius y Jamendo utilizan motores diferentes, sin pasar por `AVAudioUnitEQ` local.
- **Pendiente por álbum:** `MusicLocalFile` no almacena álbum ni artista; incorporar un perfil de álbum sin metadatos persistentes asociaría canciones incorrectamente. Falta obtener y conservar esa identidad, con respaldo/restauración.
- Pruebas de la fase: **361 pruebas iOS y 461 generales**. La compilación Swift de `9ca597c3` terminó satisfactoriamente; queda verificación del resultado global de GitHub y prueba funcional en dispositivo.

### Consolidación de álbumes y copias — 19/11/2026

- `MusicLocalFile` y los registros portables del respaldo incluyen ahora álbum y artista opcionales. La importación solicita metadatos comunes de `AVURLAsset` de forma asíncrona; al abrir la biblioteca también se intenta completar información de archivos importados anteriormente. Los archivos sin álbum conocido no reciben identificaciones inferidas.
- Se añadió una sección «Álbumes» accesible con opciones para guardar/quitar perfiles por identidad estable de artista y álbum; la normalización no depende del idioma de dispositivo. El orden del EQ local es ahora **canción > lista > álbum > general**, incluida la reproducción de listas mixtas para sus pistas locales.
- Exportación y restauración de respaldo conservan perfiles de canción, lista, álbum y general mediante el campo existente `audioProfiles` (datos validados, sin secretos ni credenciales). Los respaldos antiguos sin metadatos de álbum siguen siendo decodificables por sus campos opcionales.
- 369 pruebas iOS y 461 generales pasaron. Compilación Swift de `0d0a6751` y comprobación de metadatos `.appex` **correctas**; la acción GitHub puede seguir finalizando su captura no bloqueante.
- **Validación pendiente:** comprobación en iPhone del reconocimiento de metadatos de varios formatos reales, restauración entre dispositivos, controles VoiceOver y reproducción/equalización de servicios externos. Las pistas que un servicio externo reproduce fuera de AVAudioEngine local no reciben estas bandas; la equivalencia no debe anunciarse.

### Fase 1 de 6: organización musical — 19/11/2026

- Se amplían las carpetas inteligentes: título, artista, género, fecha de importación y número mínimo de reproducciones. Las carpetas antiguas siguen usando la regla original por título; los campos nuevos son opcionales para conservar bibliotecas y respaldos anteriores.
- El género puede asignarse dentro de la biblioteca sin alterar el archivo original; la fecha se registra al importar (con consulta de fecha de creación para archivos antiguos) y el contador avanza al iniciar la reproducción local.
- Las listas admiten botones accesibles para subir o bajar cada entrada, también si proviene de Apple Music, Audius o Jamendo. Su orden se guarda en la lista virtual y no mueve ni elimina archivos musicales.
- Los respaldos de índice y completos transportan regla inteligente, género, fecha de importación y contador; sus formas anteriores siguen siendo decodificables.
- Los nuevos textos de controles y criterios tienen traducciones en inglés, portugués, francés, italiano y alemán, además del español original.
- Comprobaciones locales: **373 contratos iOS y 461 pruebas generales correctas**. Commit de código remoto `692938e3`; compilación Xcode para simulador de iPhone y validación de la extensión **correctas** en GitHub Actions `44636112209`. La captura visual auxiliar no forma parte de esta validación.
- No se ha creado otra rama ni publicado compilación en TestFlight. Queda para la fase de validación probar con VoiceOver en iPhone los cambios de orden, las fechas, los respaldos restaurados y los filtros sobre archivos musicales reales.

### Fase 2 de 6: destino y seguridad de los respaldos — 20/11/2026

- La selección de destino y los respaldos manuales/completos ya existían antes de esta fase; la revisión detectó que cambiar la carpeta dejaba el destino nuevo sin una copia inicial hasta la siguiente fecha programada.
- Al elegir una carpeta, ahora se escribe primero un índice actualizado y solo después se guarda el destino elegido y la fecha de la copia. Si falla la escritura, se conserva el destino previo y se comunica el error.
- Al restablecer el destino interno también se crea primero su copia inicial y solo después se retira la configuración del destino anterior.
- La programación de 7 o 30 días sigue siendo bajo demanda al abrir Mi música, sin afirmar que iOS ejecute respaldos en segundo plano. Las copias automáticas siguen siendo del índice, no del audio; para trasladar audio existe la copia completa manual.
- Se añadieron dos pruebas para los cambios de carpeta y se mantienen los contratos de compatibilidad de las restauraciones. **375 contratos iOS correctos** en entorno local Linux. Compilación Swift en macOS y restauración funcional entre dispositivos todavía pendientes de comprobación.

### Fase 3 de 6: abrir enlaces visibles desde la navegación — 20/11/2026

- La revisión del código actual confirmó que la muestra previa por voz, el perfil individual, el braille continuo, seis opciones lingüísticas de OCR y los enlaces interactivos en el texto ya estaban implementados. Los apartados anteriores de esta auditoría describen el estado inicial, no el posterior a esas reparaciones.
- Se corrigió «Abrir enlace actual» cuando la navegación encuentra una URL escrita literalmente en el documento, aunque no exista un enlace HTML/EPUB estructurado. Se comprueba que el desplazamiento corresponde al inicio de una URL web y se valida protocolo y dominio antes de abrirla.
- La navegación anuncia ahora también la dirección de los enlaces visibles, y elimina la puntuación final habitual de la dirección antes de abrirla.
- Se añadió un contrato de regresión para este caso. La activación física mediante doble toque y la compilación Swift siguen requiriendo verificación en macOS/iPhone.

### Fase 4 de 6: transparencia de idiomas OCR — 20/11/2026

- El motor ya admitía español, inglés, portugués, francés, italiano y alemán, con detección automática de reserva si Vision no reconocía el idioma en el dispositivo.
- La pantalla de OCR consulta ahora los idiomas efectivamente disponibles en Vision para la precisión seleccionada, los presenta con nombres comprensibles y actualiza la lista al cambiar entre reconocimiento preciso o rápido.
- Se mantiene la codificación de preferencias anterior, sin alterar los ajustes guardados ni impedir la importación por falta de algún idioma.
- La prueba de regresión comprueba la consulta dinámica y el comportamiento de reserva. Pendiente compilación Swift macOS y verificación del anuncio en VoiceOver.

### Fase 5 de 6: importación musical recuperable — 20/11/2026

- En importaciones múltiples mediante Archivos, una copia fallida podía dejar archivos nuevos en el almacenamiento aunque la operación no hubiese terminado de guardar la biblioteca. Se conserva el estado previo y se eliminan exclusivamente los archivos recién copiados si falla la importación; se intenta restaurar el índice anterior.
- Se mantiene el selector nativo de Archivos con acceso a proveedores instalados, sin afirmar que exista integración OAuth/API persistente con Google Drive, Dropbox, OneDrive o MEGA. **La implementación de adaptadores independientes sigue pendiente** y no queda cubierta por esta reparación de seguridad.
- Se añadieron pruebas para la reversión de una importación múltiple y para verificar que la actualización de metadatos no se inicia antes de guardar el índice.

### Fase 6 de 6: textos de error de importación en seis idiomas — 20/11/2026

- Los tres mensajes de error del flujo de importación musical —fallo de copia, carpeta inaccesible y carpeta sin audio compatible— utilizan ahora el mismo mecanismo de traducción que el resto de «Mi música», con variantes para EN/PT/FR/IT/DE y conservación del español de base.
- Las traducciones parametrizadas conservan el detalle técnico de error sin romper el formato en otros idiomas.
- Se añadieron contratos de presencia y de uso de la traducción. **Esto no constituye una auditoría lingüística exhaustiva**: siguen sin verificarse todas las interpolaciones, errores de servicios, pantallas con VoiceOver y combinaciones de idioma.
