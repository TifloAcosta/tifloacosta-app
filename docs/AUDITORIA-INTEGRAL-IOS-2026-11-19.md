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
