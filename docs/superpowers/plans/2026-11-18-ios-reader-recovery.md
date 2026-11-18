# Recuperación final del lector iOS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** completar controles pendientes manteniendo el código de App Store 500157 y preparar pruebas privadas.

**Architecture:** modificar las vistas nativas existentes de ajustes y lector; persistir el nuevo modo por separado; reutilizar el cursor y avance existentes. Integrar comandos remotos con su ciclo de vida acotado.

**Tech Stack:** SwiftUI, UIKit, AVFoundation, MediaPlayer, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-18-ios-reader-recovery-design.md`.

## Global Constraints

- No sustituir las pantallas de la pública ni borrar ramas.
- No enviar a App Store. TestFlight requiere compilación macOS y verificación.

## Review Focus

- Modo Braille nunca abre Ajustes de VoiceOver al seleccionarse.
- Opciones ya guardadas de foco inicial conservan su significado.
- Avance de un minuto tanto para audio como texto.
- Pausa de auriculares y toque mágico guarda posición sin reanudar al principio.
- Al cerrar libro se desactivan controles remotos del lector anterior.

### Task 1: selector accesible de modo

**Files:** `ios-app-native/Sources/NativeReaderSettings.swift`, `ios-app-native/Sources/NativeTifloLector.swift`, nuevo test en `ios-app-native/tests/`.

- [x] Crear prueba que falle si no hay selección de tres modos separada de foco inicial.
- [x] Confirmar fallo de prueba.
- [x] Añadir selector y comportamiento de foco de lectura manual.
- [x] Ejecutar pruebas y confirmar aprobación.

### Task 2: avance fijo de un minuto

**Files:** `ios-app-native/Sources/NativeTifloLector.swift`, test de lector.

- [x] Crear prueba fallida de control único «Un minuto» sin otro ajuste.
- [x] Confirmar fallo.
- [x] Reusar salto de 60 segundos para audio y estimación para texto.
- [x] Ejecutar pruebas y confirmar aprobación.

### Task 3: controles externos

**Files:** `ios-app-native/Sources/NativeTifloLector.swift`, test de lector.

- [x] Crear prueba fallida para acción de toque mágico inactiva y mandos de auricular.
- [x] Confirmar fallo.
- [x] Unificar acciones de reproducir y pausar y enlazar controles remotos al ciclo de vida del lector.
- [x] Ejecutar pruebas y confirmar aprobación.

### Task 4: entrega verificable

- [x] Ejecutar toda la batería Node y diff check.
- [ ] Verificar compilación Xcode en CI antes de aceptar TestFlight.
- [ ] Actualizar auditoría y registrar SHA y estado real del envío.
