# Consolidación iOS y «Mi música» — plan de integración

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar una única rama de iOS que conserve la aplicación más reciente —TifloLector, seis idiomas, radio, reproductor y accesibilidad— y añada MusicKit y Jamendo sin regresiones.

**Architecture:** La base es `recovery/ios-true-public-500157-20261118` (`a1137c8`), no `feature/mi-musica`. Conservar sus servicios existentes `NativeAppleMusicPlayer` y `NativeAudiusPlayer`; incorporar únicamente las funcionalidades que faltan mediante adaptaciones pequeñas. La rama `feature/mi-musica` original queda disponible solo como fuente de cambios hasta completar las pruebas y la consolidación.

**Tech Stack:** SwiftUI, MusicKit, AVFoundation, GitHub Actions, Node.js tests.

**Spec:** `docs/superpowers/specs/2026-11-17-mi-musica-design.md` y decisiones de Tony sobre iOS y las seis lenguas.

## Global Constraints

- No enviar a TestFlight ni publicar en App Store durante la consolidación; el envío previamente autorizado solo procede al verificar todas las funciones.
- Mantener las cuatro modalidades de pausas de TifloLector y sus ajustes por signo; conservar voces y muestra Gemini.
- No perder radio, Audius, ecualizador, reproductor compartido, carpeta «Organizar mi música» ni traducciones existentes.
- Jamendo usa exclusivamente el ID público de cliente; nunca incluir el secreto del cliente ni claves privadas de Apple.
- Los idiomas de la interfaz musical deben ser español, inglés, portugués, francés, italiano y alemán.

## Review Focus

- Comprobar que una rama antigua no sustituye `NativeReaderSettings.swift` ni sus pausas por puntuación.
- Comprobar que no se elimina `NativeReaderExternalVoiceCredentials.swift` ni la muestra Gemini.
- Garantizar que Jamendo no deja sonando Audius, Apple Music, radio o TifloLector simultáneamente.
- Garantizar que Apple Music aparece cuando la capacidad MusicKit está habilitada sin exponer claves privadas.
- Comprobar que una copia completa de listas mixtas preserva referencias remotas y reasigna los ID locales.

### Task 1: Bloqueo de regresiones de TifloLector y música existente

**Files:** `ios-app-native/tests/music-consolidation-contract.test.mjs`

- [ ] Crear una prueba que exija `NativeReaderPauseProfile`, `NativeReaderPunctuationControls`, la muestra Gemini, las seis localizaciones y las secciones de radio, Audius y Apple Music.
- [ ] Ejecutar la prueba en la base de integración y confirmar que pasa.
- [ ] Confirmar que se ejecutan sin fallos los 322 tests existentes de iOS antes de integrar cambios.

### Task 2: Incorporación de Jamendo al reproductor de la base

**Files:** `ios-app-native/Sources/NativeJamendoMusic.swift`, `ios-app-native/Sources/NativeRadioBrowser.swift`, `ios-app-native/Sources/NativeMusicPlayer.swift`, `ios-app-native/tests/music-consolidation-contract.test.mjs`

- [ ] Escribir prueba que exija el enlace Jamendo desde «Plataformas musicales», búsqueda de solo lectura y pausa de todas las fuentes antes de reproducir.
- [ ] Ejecutar y comprobar el fallo esperado.
- [ ] Integrar Jamendo de forma coherente con `NativeRemotePlaybackOwner`, sin copiar servicios duplicados antiguos.
- [ ] Ejecutar los tests y verificar que pasan.

### Task 3: Habilitación y localización de MusicKit

**Files:** `ios-app-native/Sources/Info.plist`, `ios-app-native/Sources/NativeAppleMusic.swift`, `ios-app-native/Sources/{en,pt,fr,it,de}.lproj/Localizable.strings`, tests de servicios musicales.

- [ ] Escribir prueba que compruebe la visibilidad explícita de Apple Music y que no haya material secreto.
- [ ] Ejecutar y comprobar el fallo esperado.
- [ ] Habilitar el acceso a la pantalla MusicKit con la capacidad Apple Developer activada, reutilizando `NativeAppleMusicPlayer`.
- [ ] Fusionar únicamente las nuevas cadenas musicales sin sustituir traducciones existentes.
- [ ] Ejecutar tests y comprobar ausencia de duplicados y errores en plantillas.

### Task 4: Listas mixtas y copias completas

**Files:** `ios-app-native/Sources/NativeMyMusic.swift` y tests de respaldos.

- [ ] Crear pruebas para conservar listas locales antiguas, referencias remotas y restauración sin perder ID.
- [ ] Adaptar la estructura `MusicPlaylist` del modelo reciente, sin sustituir su reproductor ni pantalla completa.
- [ ] Añadir acciones de guardado y reproducción desde las plataformas ya existentes.
- [ ] Ejecutar las pruebas locales y la suite completa de iOS.

### Task 5: Verificación de la consolidación y TestFlight

- [ ] Comprobar `git diff` contra la base de recuperación: ninguna función ajena a «Mi música» desaparece.
- [ ] Confirmar tests iOS, idioma y música, así como la compilación macOS de GitHub Actions.
- [ ] Actualizar la única rama de desarrollo consolidada sin sobrescribir a terceros.
- [ ] Usar la automatización existente de TestFlight cuando la rama consolidada supere la verificación. Mantener separada cualquier publicación pública.
