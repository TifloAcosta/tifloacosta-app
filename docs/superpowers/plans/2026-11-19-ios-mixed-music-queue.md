# Cola mixta de Mi Música — plan de implementación iOS

> **Para la implementación:** ejecutar tareas secuenciales con pruebas primero y comprobación nativa de Xcode. No crear ramas remotas ni enviar a TestFlight.

**Objetivo:** reproducir en orden listas de canciones locales, Apple Music, Audius y Jamendo, sin que una fuente externa interrumpa o descarte las siguientes.

**Arquitectura:** una única cola de referencias `MusicPlaylistEntry`, independiente de los cuatro reproductores. Un coordinador principal conserva índice, repetición, aleatorio y estado de transición; cada reproductor informa del final natural de la pista a través de un adaptador. Avanzar manualmente invalida los callbacks de la pista anterior. Una canción inaccesible se anuncia, se omite y se continúa sin eliminarla de la lista.

**Tecnologías:** Swift, SwiftUI, AVAudioEngine, AVPlayer, MusicKit, pruebas de contrato Node y compilación Xcode de iOS.

**Especificación:** `docs/superpowers/specs/2026-11-17-mi-musica-design.md` y `docs/AUDITORIA-INTEGRAL-IOS-2026-11-19.md`.

## Restricciones

- Exclusivamente iOS; preservar `feature/mi-musica`.
- No mezclar credenciales privadas con datos de listas ni copias.
- No prometer reproducción de canciones que el proveedor bloquee o para las que falte suscripción.
- VoiceOver debe poder iniciar, pausar, avanzar, retroceder y conocer errores y fuente de la pista.
- La cola local existente y los controles de auriculares no deben perder funcionalidad.

## Casos de riesgo para revisar

1. Lista con solo referencias remotas: el botón de reproducir está disponible.
2. Secuencia local → Jamendo → Apple Music → Audius → local: no se detiene tras la primera pista.
3. Pista remota sin permiso, sin conexión o retirada: se anuncia y continúa con la siguiente.
4. Salto manual mientras llega un evento tardío de fin: no se saltan dos canciones.
5. Pausa voluntaria, cambio de sección y bloqueo de pantalla: no se confunden con fin natural.

## Tarea 1: cola con identidad y navegación

**Archivos:** nuevo `ios-app-native/Sources/NativeMixedMusicQueue.swift`, cambios mínimos en `NativeMyMusic.swift` y prueba nueva `ios-app-native/tests/music-mixed-queue-20261119.test.mjs`.

- [ ] Red: comprobar que «Reproducir lista» utiliza `playlistEntries(playlist)`, también para listas sin archivos locales, y conserva el orden.
- [ ] Verde: introducir el coordinador de cola, índice y generación de transición; preparar el reproductor de una entrada según su proveedor.
- [ ] Comprobar que cada proveedor recibe el ID correcto y los locales una URL existente.
- [ ] Ejecutar pruebas iOS y generales; guardar el cambio en la rama existente.

## Tarea 2: avance al terminar una pista

**Archivos:** `NativeMusicPlayer.swift`, `NativeAudiusMusic.swift`, `NativeJamendoMusic.swift`, `NativeAppleMusic.swift`, `NativeMixedMusicQueue.swift` y pruebas de fin/pausa/salto.

- [ ] Red: verificar la señal de fin natural para cada motor, diferenciándola de pausa y detención.
- [ ] Verde: conectar notificaciones de fin de AVAudioEngine/AVPlayer y estado de MusicKit con la generación de la cola.
- [ ] Verificar que saltos y repeticiones no generan doble avance y que ninguna señal de otro reproductor avanza la cola.
- [ ] Ejecutar pruebas y compilación real de Xcode antes de dar por cubierta la reproducción continua.

## Tarea 3: accesibilidad y fallos recuperables

**Archivos:** pantalla y coordinador de lista, catálogos ES/EN/PT/FR/IT/DE y pruebas de traducción/VoiceOver.

- [ ] Red: lista remota sin acceso, canción retirada, autorización cancelada y cola agotada muestran estado diferenciado.
- [ ] Verde: ofrecer avance/retroceso accesible, anuncio de pista y plataforma, estado de carga, mensaje de pista omitida y opción de detener toda la lista.
- [ ] Verificar copias/restauración con referencias mixtas y los seis idiomas.
- [ ] Compilación Xcode, auditoría de contratos y prueba manual final con VoiceOver antes de TestFlight.

## Criterio de cierre

La lista completa debe reproducirse en orden y pasar automáticamente entre proveedores, salvo restricciones externas comunicadas. Las pruebas estáticas por sí solas no certifican este objetivo: la ejecución de Xcode y la prueba real de VoiceOver siguen siendo obligatorias.
