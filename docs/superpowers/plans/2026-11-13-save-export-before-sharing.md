# Guardado seguro de MP3 y DAISY — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Guardar la conversión MP3/DAISY como un libro nuevo en la biblioteca antes de ofrecer Compartir o Cancelar, evitando pérdidas si el usuario no comparte.

**Architecture:** Después de `NativeGeminiAudioExport.export`, importar el archivo generado a `NativeReaderLibrary` con identidad y título propios. La vista mostrará confirmación con dos acciones; Compartir utilizará el archivo original almacenado, y Cancelar solo cerrará la confirmación.

**Tech Stack:** SwiftUI, almacenamiento local de TifloLector, Node.js contract tests, compilación Xcode en GitHub Actions.

**Spec:** Aprobación expresa de Tony, 13 de noviembre de 2026: guardado automático, luego Compartir o Cancelar, sin borrar el guardado.

## Global Constraints

- Nunca sobrescribir ni transformar el documento fuente.
- No anunciar éxito antes de guardar correctamente el archivo permanente.
- No generar otra conversión al compartir nuevamente desde la biblioteca.
- La acción Cancelar no elimina el nuevo documento.
- Publicación pública únicamente tras pruebas y aprobación posterior de Tony.

## Review Focus

- Falla la importación: error explícito, sin anuncio de éxito.
- Cierra la hoja de compartir: la conversión sigue en la biblioteca.
- MP3: reproducible desde la biblioteca y con archivo original compartible.
- DAISY: permanece un paquete ZIP importable y compartible.
- Conversión cancelada antes de terminar: no se genera documento incompleto.

---

### Task 1: Persistir y confirmar la exportación

**Files:** `ios-app-native/Sources/NativeTifloLector.swift`; prueba `ios-app-native/tests/reader-safe-export-library-20261113.test.mjs`.

- [ ] Escribir pruebas de contrato de guardado previo a compartir, nombre de formato, alerta y cancelación sin borrado.
- [ ] Ejecutar el test nuevo y confirmar que falla por el comportamiento actual.
- [ ] Importar el archivo con `NativeReaderLibrary.importDocuments` después de generar y antes de darlo por completado; usar el `originalRelativePath` guardado para Compartir.
- [ ] Presentar confirmación accesible con «Compartir» y «Cancelar» después de cerrar el formulario de exportación.
- [ ] Ejecutar el test hasta PASS, toda la batería Node y `git diff --check`.
- [ ] Enviar a GitHub para compilar con Xcode y, si todo pasa, desencadenar una nueva beta de TestFlight 1.3; comprobar aceptación y grupo de probadores.
