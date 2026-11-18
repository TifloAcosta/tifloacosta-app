# Recuperación iOS desde compilación pública 500157 — 18 noviembre 2026

Responsable: Tony Acosta. Estado: preparación. Sin autorización para envío a TestFlight ni publicación.

## Origen
- App Store Connect: iOS 1.3, build 500157.
- GitHub Actions ejecución 157: https://github.com/TifloAcosta/tifloacosta-app/actions/runs/43744112701
- Commit: 440010a2643b88f359474819a6f3d5f11ec9406a.
- El proceso genera build 500000 + número de ejecución.
- ADVERTENCIA: ese código aún sitúa Ajustes, filtros y carpetas antes de Mi biblioteca, y no contiene búsqueda interna nativa. La procedencia de 500157 no garantiza que refleje la presentación aprobada. Los criterios de diseño acordados prevalecen.

## Requisitos aprobados
1. Portada: Importar; Mi biblioteca visible inmediatamente; después filtros/ordenación, carpetas y Ajustes.
2. Documento: Reproducir/Pausa, Modo de navegación, Crear marca, Buscar en el documento, Apagado automático, Ir a posición, texto, Marcas guardadas, ajustes de audio y visuales. Información en Acciones.
3. Buscar en documento con resultados accesibles, navegación de coincidencias y retorno a la posición previa, incluidos PDF texto/OCR, EPUB, TXT y DOCX.
4. Selector ajustable Modo de lectura: Voz TTS, Lectura visual, Línea braille; braille continuo sin límite artificial y posición persistente.
5. Pausa y reanudación exacta; toque mágico alterna los estados; marcas con VoiceOver.
6. Exportar/Compartir original real; DAISY completo con texto, audio, NCX y SMIL; audiolibro MP3 ZIP para Voice Dream sin resintetizar; validar compatibilidad.
7. Importación desde Compartir distingue EPUB de DAISY, incluso desde Drive.
8. Listas YouTube con reproducción automática del vídeo siguiente, orden y navegación accesible; novedades de canales con fecha y orden real.
9. Selección múltiple y carpetas navegables; preferencias particulares por documento independientes.
10. Mi Música desde feature/mi-musica, con importación, listas, carpetas inteligentes y copia/restauración.
11. Traducción y retorno, atajos Siri, incrementos velocidad 0,05, accesibilidad e idiomas; comparar estado real antes de incorporar.
12. Eliminar Azure Speech completamente del selector, pantallas, credenciales, ayuda y rutas de ejecución de TifloLector.

## Restricciones
- No sustituir la base pública por main ni por feature/mi-musica.
- No modificar distribución pública ni datos; no enviar a TestFlight ni App Store sin autorización nueva.
- Mantener rama privada de recuperación; no borrar ramas históricas hasta cerrar trazabilidad.

## Verificaciones obligatorias
- Contratos de orden de portada y controles; revisar con VoiceOver.
- Búsqueda PDF texto/OCR, EPUB, TXT, DOCX, tildes y retorno a posición.
- Toque mágico, posición, marcas, tres modos de lectura.
- DAISY real en reproductor compatible, Voice Dream ZIP.
- Listas YouTube continuas y Mi Música sin regresiones.
- Tests automatizados, compilación iOS y aceptación física antes de enviar otra actualización.
