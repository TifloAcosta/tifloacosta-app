# TifloLector — pruebas finales conjuntas de iOS y Android

Documento de trabajo. **No iniciar las pruebas manuales hasta terminar todas las novedades.**
Ninguna prueba supera las pendientes solo por compilar. No fusionar ni publicar sin autorización.

## Preparación

- Una instalación de TifloAcosta iOS con VoiceOver; una de Android con TalkBack.
- EPUB grande con índice real, DOCX con estilos de títulos, TXT sin encabezados, PDF accesible y PDF escaneado.
- Un DAISY ZIP con audio y sincronización, un MP3 y un documento largo con varias secciones.
- Clave Gemini propia con cuota conocida. Nunca anotarla ni grabarla durante la prueba.
- Phonon 31m inglés y, cuando sus condiciones lo permitan, modelo multilingüe/español compatible con cada plataforma.
- Exportaciones de prueba a MP3, M4A, WAV y DAISY.

## 1. Biblioteca e importación

- Importar los formatos compatibles y anunciar claramente éxito o error.
- Importar archivos grandes sin dejar copias corruptas o entradas fantasma.
- Conservar los títulos y sus niveles al importar EPUB, XHTML y DOCX.
- Importar DAISY ZIP de texto/audio, con índice y tiempos reales.
- Borrar varias obras; comprobar que los datos de otras obras se conservan.
- Entrar y salir de Biblioteca, Recientes, Cola y Todos sin perder el foco del lector.

## 2. Posición, marcas y navegación

- Leer unos fragmentos; cerrar TifloLector y reiniciar el dispositivo; reanudar exactamente desde la posición guardada.
- Crear, anunciar, abrir y eliminar marcas persistentes en distintos formatos.
- Cambiar entre navegación por frase, bloque, tiempo y marcas; cada cambio debe ser accesible y rápido.
- Navegar por encabezados y capítulos reales, sin inventar capítulos para documentos sin títulos.
- Avanzar y retroceder al inicio y al final del documento sin saltos inesperados.

## 3. Reproducción y accesibilidad

- Verificar con VoiceOver/TalkBack el nombre, estado, foco y acciones del rotor o controles equivalentes.
- Reproducir, pausar, reanudar y detener; comprobar que «Detener» realmente termina el sonido.
- Bloquear la pantalla; comprobar continuidad de audio, pausa/reanudación y navegación desde controles multimedia.
- Interrumpir con una llamada, una notificación y otra fuente de audio; comprobar que el foco y la reproducción se recuperan.
- Activar el apagado automático en varios tiempos; comprobar cuenta atrás, cancelación y detención final.
- Cambiar velocidad, tono y voz sin perder la posición.

## 4. Voces

- **Sistema:** voces instaladas y, en iOS, Voz personal autorizada; lectura funcional sin enviar texto a Internet.
- **Gemini:** crear/guardar/comprobar/eliminar clave; escuchar muestra y seleccionar voz; verificar cuota y mensaje de error.
- **Gemini continuo:** documento largo en varios fragmentos, pausa durante la generación, reanudación, avance, cambio de voz y cancelación.
- **Phonon:** instalar y quitar modelo, comprobar su integridad y selección de idioma; probar voces realmente disponibles.
- **Phonon sin red:** descargar/importar previamente el modelo; desconectar Internet; leer, cambiar voz, pausar y reanudar.
- **Licencias de modelos:** confirmar que los modelos CC BY-NC no se presentan como comercialmente libres.

## 5. Exportación de audio y DAISY

- Elegir motor y voz, formato y destino; verificar los mensajes de progreso, cancelación y finalización.
- Comparar un mismo texto en MP3, M4A y WAV: audio reproducible, duración y contenido íntegros, sin archivos renombrados incorrectamente.
- Generar un DAISY desde un documento con capítulos; verificar índice, texto completo, fragmentos SMIL, audio y duración.
- Abrir el ZIP DAISY en al menos dos reproductores independientes y validarlo con herramientas DAISY adecuadas. La comprobación estructural interna no basta.
- Verificar especialmente documentos grandes y fallos de espacio disponible, cuota y conexión.
- Comprobar que nunca se exporta ni comparte una clave de API ni contenido privado accidentalmente.
- Voz personal en iOS: lectura sí; la exportación de su audio no se ofrece.

## 6. Antes de una distribución pública

- Revisar licencias de Phonon (código y cada modelo) y del codificador MP3 de Android (LGPL-3), junto con mecanismos y avisos exigidos.
- Completar compilaciones, contratos y comprobaciones de accesibilidad automáticas.
- Corregir errores encontrados durante las pruebas anteriores y repetir los escenarios afectados.
- Confirmar expresamente con el responsable la fusión, nueva compilación, distribución beta y publicación.

Estado: **plan de pruebas redactado, sin ejecución manual**.
