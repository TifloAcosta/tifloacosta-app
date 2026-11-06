# Fase 6 — auditoría integral previa a pruebas con usuarios

Estado: fase 5 cerrada a nivel de implementación; fase 6 iniciada. Sin fusión, TestFlight ni publicación en Google Play.

## Objetivo
Comprobar que las funciones preparadas en las fases 1–5 conviven sin pérdida de datos, regresiones o bloqueos. Las pruebas automáticas no sustituyen las pruebas finales con VoiceOver y TalkBack. No anticipar pruebas manuales hasta acabar todas las novedades.

## Bloque A: lectura y biblioteca
- Abrir y cerrar EPUB, PDF accesible, DOCX, DAISY ZIP, MP3, TXT, y formatos realmente admitidos.
- Comprobar persistencia de posición y marcas por documento y formato; nunca limitarlo a EPUB.
- Navegar por títulos reales, frase, bloque, tiempo y marcas según el formato; controles al alcance de lectores de pantalla.
- Temporizador: iniciar, modificar, cancelar, finalizar y detener sonido de verdad.
- Evitar pérdida de enfoque, duplicación de anuncios y controles sin etiqueta.

## Bloque B: voces y exportación
- Sistema: cambiar voz y velocidad sin perder posición; Voz personal de iOS solo cuando el sistema lo permita.
- Gemini: clave personal protegida, validación, cuotas y errores, cancelación sin audio pendiente.
- Phonon: modelo e idioma compatibles, verificación del paquete, reproducción offline y pausas.
- Revisar licencias de modelos Phonon 40m CC BY-NC, del modelo 31m Apache 2.0 y del codificador MP3 en Android. No distribuir componentes sin cumplimiento confirmado.
- Exportación WAV, M4A, MP3 y DAISY: integridad, títulos, fragmentos sincronizados, permisos y apertura externa.

## Bloque C: Vídeos y Pódcast
- YouTube: búsqueda pública sin sesión, login Google opcional, cierre y recuperación de sesión, lista paginada de suscripciones, reproducción, me gusta y comentarios cuando se permiten.
- Pódcast: seguir/dejar de seguir, importar OPML con límite, guardar favoritos reproducibles tras reiniciar, obtener episodios y detectar nuevas entregas.
- Distinguir claramente actualizaciones bajo demanda de alertas automáticas: no se prometen notificaciones push.
- Confirmar compatibilidad con pantalla bloqueada donde proceda y comportamiento de audio con VoiceOver y TalkBack.

## Bloque D: regresión y publicación
- CI nativa iOS y Android sobre ramas de la fase 6; ejecutar pruebas de contratos y compilar.
- Corregir defectos reproducibles por código; guardar cambios y volver a verificar.
- Auditar persistencia, red, privacidad, permisos, foco, navegación y mensajes hablados.
- Solo cuando estén terminadas las novedades: pruebas únicas de accesibilidad y funcionamiento en dispositivos físicos.
- Mantener las PR en borrador. No fusionar, enviar a tiendas ni distribuir beta sin verificar y acordar el siguiente paso.

## Límites
El éxito de una compilación no equivale a un ensayo de reproducción real, ni certifica la accesibilidad. Las fases anteriores permanecen identificables en su historial y sus PR.
