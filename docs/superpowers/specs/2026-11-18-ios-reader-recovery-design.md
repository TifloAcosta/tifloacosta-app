# Recuperación final del lector iOS

Requisito ya aprobado por Tony durante las pruebas: conservar sin sustituciones la pública 500157, y añadir un modo de lectura elegible entre Voz, Visual y Braille; una única opción de avance por un minuto mediante el selector de navegación; reanudar con toque mágico y mandos externos; no borrar ajustes existentes.

Enfoques: reemplazar de nuevo las pantallas completas (descartado por regresiones repetidas), o añadir estados y controles limitados al lector público (elegido por Tony al ordenar recuperar la pública). Conservar las claves persistentes de foco inicial; una clave nueva para el modo de lectura evita cambiar sus significados. Mantener el mismo cursor, marcas y texto tanto en Visual como en Braille; VoiceOver administra los dispositivos braille, sin reabrir Ajustes como único resultado. No iniciar voz automáticamente por cambiar de modo.

Límites: iOS 17+, SwiftUI y AVFoundation; prueba de hardware y compilación macOS aún necesarias. TestFlight privado solamente tras verificación.
