# Ajustes inmediatos de lectura y exportación accesible — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar los cambios de voz, velocidad, tono y pausas sin cerrar el libro; hacer navegables y ajustables con VoiceOver los selectores de exportación MP3/DAISY.

**Architecture:** Los ajustes por obra ya se persisten mediante `NativeReaderLibrary.updatePreferences`, pero la cola de `AVSpeechUtterance` captura los valores al comenzar y no escucha cambios. Se introducirá una actualización controlada de la cola en la siguiente frontera de frase, preservando el cursor; la hoja de exportación reutilizará `NativeAdjustableChoice` o su equivalente accesible, evitando que los cambios de motor pierdan el foco.

**Tech Stack:** SwiftUI, AVFoundation, VoiceOver; pruebas contractuales Node.js existentes.

**Spec:** Decisiones aprobadas por Tony en la conversación del 13 de noviembre de 2026: aplicación en la siguiente frase sin perder posición; controles ajustables y navegables mediante flicks.

## Global Constraints

- No reiniciar el documento ni perder posición, marcas o ajustes por obra.
- Mantener la navegación horizontal por los controles y el ajuste vertical con VoiceOver.
- No modificar el comportamiento de reproducción de DAISY o audio grabado sin una prueba específica.
- No subir una compilación nueva a TestFlight antes de verificar y pedir el envío explícito.

## Review Focus

- Ajustes mientras está pausado: reanudar con el valor nuevo sin desplazar el cursor.
- Cambios rápidos sucesivos: prevalece la última selección, sin duplicar frases.
- Fin del documento y frases vacías: no reiniciar ni quedar bloqueado.
- Motores externos y audio ya generado: no anunciar aplicación inmediata que no sea posible.
- Motor de exportación con voces no disponibles: mantener foco y elegir un valor válido.

---

### Task 1: Ajustes de voz en vivo

**Files:**
- Modify: `ios-app-native/Sources/NativeTifloLector.swift`
- Modify: `ios-app-native/Sources/NativeReaderSettings.swift` si se necesita emitir cambios de preferencias de obra
- Test: `ios-app-native/tests/reader-live-settings-20261113.test.mjs`

**Interfaces:** Consume `NativeReaderLibrary.updatePreferences`, `NativeReadingSpeech.play`, `NativeReaderPauseProfile.segments`, `readingOffset` y `effectiveSpeedIndex`. Produce actualización diferida a la siguiente frase y persistencia de la posición de lectura.

- [ ] Step 1: Añadir prueba contractual que falle si los cambios de velocidad, voz, tono o perfil de pausas no disparan una actualización de reproducción.
- [ ] Step 2: Ejecutar `node --test ios-app-native/tests/reader-live-settings-20261113.test.mjs`; confirmar fallo esperado.
- [ ] Step 3: Implementar detección de cambios y reconfiguración al límite de frase, conservando el offset y distinguiendo pausa/reproducción y motores externos.
- [ ] Step 4: Ejecutar el test específico hasta obtener PASS; comprobar cambios rápidos y fin del libro.
- [ ] Step 5: Revisar diferencia con `git diff` y confirmar que no se perdió la persistencia por obra.

### Task 2: Hoja de exportación accesible

**Files:**
- Modify: `ios-app-native/Sources/NativeTifloLector.swift`
- Test: `ios-app-native/tests/reader-audio-export-adjustable-20261113.test.mjs`

**Interfaces:** Consume `audioExportFormat`, `audioExportLanguage`, `audioExportEngine`, `audioExportSystemVoice`, `audioExportGeminiVoice`, `NativeAdjustableChoice`. Produce controles ajustables separados y foco estable al cambiar de motor.

- [ ] Step 1: Añadir prueba contractual que falle con los `Picker` existentes, y exija controles accesibles para formato, idioma, motor y voz.
- [ ] Step 2: Ejecutar `node --test ios-app-native/tests/reader-audio-export-adjustable-20261113.test.mjs`; comprobar fallo esperado.
- [ ] Step 3: Cambiar los selectores por elecciones ajustables etiquetadas; controlar el cambio de motor y actualizar la voz seleccionada sin pérdida de foco.
- [ ] Step 4: Ejecutar el test específico hasta PASS; comprobar opciones vacías, idioma y motor condicional.

### Task 3: Verificación y empaquetado

**Files:** Los anteriores; no subir todavía a TestFlight.

- [ ] Step 1: Ejecutar `node --test ios-app-native/tests/*.test.mjs` y confirmar cero fallos.
- [ ] Step 2: Ejecutar las verificaciones Swift disponibles en el entorno; si no hay Xcode, declarar que la compilación iOS y prueba física de VoiceOver siguen pendientes.
- [ ] Step 3: Revisar `git diff --check`, el estado de Git y los recorridos de voz, cursor y hoja de exportación.
- [ ] Step 4: Confirmar a Tony los cambios preparados y las verificaciones reales antes del siguiente paso de compilación.
