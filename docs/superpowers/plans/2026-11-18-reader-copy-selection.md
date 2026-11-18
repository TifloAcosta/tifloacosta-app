# Copiar texto accesible en TifloLector — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copiar el párrafo actual o seleccionar un intervalo de texto continuo sin modificar la posición de lectura.

**Architecture:** La pantalla de lectura ofrece acciones explícitas. El cálculo del párrafo usa índices de caracteres en el cuerpo extraído; una hoja de selección muestra un `UITextView` continuo, no editable y seleccionable, con los mecanismos de selección y copia de iOS y VoiceOver.

**Tech Stack:** SwiftUI, UIKit `UITextView`, `UIPasteboard`, VoiceOver, pruebas Node de contratos iOS.

**Spec:** `docs/superpowers/specs/2026-11-18-reader-copy-selection-design.md`.

## Global Constraints
- Rama de recuperación privada basada en la compilación pública 500157.
- No alterar lectura actual, marcas, foco de retorno ni datos del libro.
- Sin envío a TestFlight ni App Store hasta la autorización explícita de Tony.

## Review Focus
- Posición cero o final: copiar párrafo válido o informar con claridad.
- Párrafos separados por saltos simples o dobles: copiar solo el párrafo que contiene el desplazamiento.
- Documento vacío o audio puro: ocultar acciones de copia.
- Selección que cruza varios párrafos: conservar texto completo en el mismo `UITextView`.
- VoiceOver tras cerrar la hoja: devolver foco y lectura al libro sin reproducción inesperada.

### Tarea 1. Copia rápida del párrafo
**Files:** `ios-app-native/Sources/NativeTifloLector.swift`; `ios-app-native/tests/reader-copy-selection.test.mjs`.

**Interfaces:** `private func currentParagraphText() -> String?`; `private func copyCurrentParagraph()`.

- [ ] Prueba fallida: aparecen «Copiar párrafo actual» en acciones y rotor y se usa `UIPasteboard.general.string`.
- [ ] Ejecutar `node --test ios-app-native/tests/reader-copy-selection.test.mjs`, confirmar fallo.
- [ ] Calcular los límites del párrafo que contiene `readingOffset`, copiar y anunciar éxito/error; no llamar a `jump(to:)` ni a `play()`.
- [ ] Ejecutar prueba focal y suite completa, exigir cero fallos.
- [ ] Guardar cambios en rama privada.

### Tarea 2. Selección continua accesible
**Files:** `ios-app-native/Sources/NativeTifloLector.swift`; `ios-app-native/tests/reader-copy-selection.test.mjs`.

**Interfaces:** `@State private var showTextSelection`; vista hoja con texto de `latest.body`, reutilizando `NativeBrailleContinuousText` o un `UITextView` con `isSelectable = true` e `isEditable = false`.

- [ ] Prueba fallida: «Seleccionar y copiar texto» visible en acciones, vista continua seleccionable y control «Volver al libro».
- [ ] Ejecutar prueba focal y confirmar fallo.
- [ ] Mostrar texto íntegro con selección nativa, instrucciones breves para VoiceOver y botón de cierre, sin cambiar `readingOffset`.
- [ ] Ejecutar pruebas y revisar todos los controles de lectura.
- [ ] Guardar en rama privada; dejar comprobación manual en iPhone con VoiceOver como requisito previo a compilación de prueba.
