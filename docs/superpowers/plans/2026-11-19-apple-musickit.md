# Apple Music en Mi Música — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir Apple Music como fuente opcional a Mi Música sin alterar la biblioteca personal.

**Architecture:** MusicKit nativo en iOS administra autorización, catálogo y reproducción de Apple Music. Las referencias del catálogo quedan separadas de los archivos locales y las listas conservan origen y disponibilidad. La clave privada multimedia jamás se incorpora al cliente ni al repositorio; una eventual API directa se pospone hasta justificar un backend.

**Tech Stack:** SwiftUI, MusicKit (iOS 17+), XCTest/contratos Node.js y proyecto XcodeGen.

**Spec:** `docs/superpowers/specs/2026-11-17-mi-musica-design.md`, ampliada por la aprobación de Tony del 19-11-2026 para Apple Music opcional, búsqueda, autorización y listas mixtas.

## Global Constraints

- Mantener importación, reproducción, carpetas, listas, copias y datos existentes sin migración destructiva.
- VoiceOver anuncia estados, selección, errores, permisos y suscripción; no exige cuenta Apple Music para archivos locales.
- Sin clave `.p8`, token de desarrollador ni credenciales en fuentes, pruebas, registros o exportaciones.
- No enviar a TestFlight, Play Store o App Store sin autorización expresa.
- Las referencias Apple Music no conceden acceso al audio fuera de las condiciones de Apple.

## Review Focus

- Permiso rechazado: mensaje accesible y biblioteca local intacta (Task 2).
- Usuario sin suscripción: búsquedas según capacidad disponible y reproducción bloqueada con explicación (Task 3).
- Canción retirada del catálogo: referencia conservada y error reversible (Task 4).
- Lista mixta después de restaurar: referencias preservadas sin introducir tokens (Task 4).
- Usuario desconectado o sin red: manejo de error sin bloquear funciones locales (Task 3).

---

### Task 1: Configuración nativa y seguridad

**Files:** Modify `ios-app-native/project.yml`, `ios-app-native/Sources/Info.plist`; Test `ios-app-native/tests/music-apple-config-contract.test.mjs`.

**Interfaces:** MusicKit importable; descripción de acceso a música mediante `NSAppleMusicUsageDescription`; configuración del App ID debe verificarse aparte en Apple Developer.

- [ ] Escribir prueba que exija la descripción de permiso y ausencia de `AuthKey`, claves `.p8` y secretos MusicKit en el cliente.
- [ ] Ejecutar `node --test ios-app-native/tests/music-apple-config-contract.test.mjs` y verificar fallo.
- [ ] Incorporar configuración mínima de proyecto y permisos, sin introducir credenciales.
- [ ] Repetir prueba y verificar éxito; confirmar con Apple Developer que `com.tifloacosta.app` tiene habilitado MusicKit antes de firmar una compilación.
- [ ] Commit con cambios y prueba.

### Task 2: Autorización y estado de cuenta

**Files:** Create `ios-app-native/Sources/NativeAppleMusicService.swift`; Modify `ios-app-native/Sources/NativeMyMusic.swift`; Test `ios-app-native/tests/music-apple-auth-contract.test.mjs`.

**Interfaces:** `@MainActor final class NativeAppleMusicService: ObservableObject` con `authorizationStatus`, `subscriptionAvailable`, `requestAuthorization() async`, `refreshSubscription() async` y mensajes accesibles.

- [ ] Escribir contratos de estado inicial, denegación de permiso, no suscripción y reconexión.
- [ ] Ejecutar prueba y comprobar fallo.
- [ ] Implementar adaptador con `MusicAuthorization` y `MusicSubscription`, interfaz opcional en Mi Música y estados anunciados por VoiceOver.
- [ ] Ejecutar prueba y comprobar éxito; preservar ruta de biblioteca local cuando no hay autorización.
- [ ] Commit con adaptador, UI y pruebas.

### Task 3: Buscar y reproducir catálogo Apple Music

**Files:** Modify `ios-app-native/Sources/NativeAppleMusicService.swift`, `ios-app-native/Sources/NativeMyMusic.swift`; Test `ios-app-native/tests/music-apple-catalog-contract.test.mjs`.

**Interfaces:** `searchCatalog(query: String) async` devuelve resultados etiquetados por tipo y origen; `playCatalogSong(id: MusicItemID) async` verifica permisos/suscripción y utiliza reproductor MusicKit.

- [ ] Escribir pruebas de consulta vacía, errores de red, resultados y restricción por suscripción.
- [ ] Ejecutar prueba y verificar fallo.
- [ ] Implementar búsqueda y reproducción nativa con controles VoiceOver y distinción respecto a audio local.
- [ ] Ejecutar prueba y verificar éxito; revisar compilación Swift en runner macOS.
- [ ] Commit con código y pruebas.

### Task 4: Referencias mixtas y persistencia

**Files:** Modify `ios-app-native/Sources/NativeMyMusic.swift`; Modify `shared/music-playlists.mjs` solo si contrato compartido es compatible; Test `ios-app-native/tests/music-apple-playlists-contract.test.mjs`.

**Interfaces:** Referencia serializable con `provider` (`local` o `appleMusic`) e identificador estable; nunca incluir audio, tokens ni credenciales en respaldos.

- [ ] Escribir pruebas de lista mixta, orden, canción retirada y copia/restauración sin secretos.
- [ ] Ejecutar prueba y verificar fallo.
- [ ] Añadir persistencia compatible hacia atrás y acciones accesibles para añadir/quitar referencias.
- [ ] Ejecutar prueba y verificar éxito, además de los contratos actuales de música.
- [ ] Commit con persistencia y pruebas.

### Task 5: Auditoría y entrega para pruebas

**Files:** Update `ios-app-native/README.md`; Test existing `test/music-*.test.mjs`, `ios-app-native/tests/*music*.test.mjs`.

**Interfaces:** Informe de estado y límites de suscripción, autorización y compatibilidad; sin envío automático.

- [ ] Ejecutar contratos JS, verificación de proyecto y compilación de iOS en runner macOS cuando esté disponible.
- [ ] Revisar VoiceOver, navegación, reproducción y ausencia de secretos en diff y artefactos.
- [ ] Documentar lo validado automáticamente y lo que requiere prueba en dispositivo.
- [ ] Commit; solicitar autorización separada antes de TestFlight.
