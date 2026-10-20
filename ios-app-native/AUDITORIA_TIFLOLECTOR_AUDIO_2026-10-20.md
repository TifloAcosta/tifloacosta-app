# Auditoría funcional de TifloLector iOS — 20 de octubre de 2026

## Alcance

Revisión del código SwiftUI nativo, el importador de archivos, los controles de audio, la persistencia de biblioteca, el listado de formatos, los contratos de pruebas y la distribución mediante GitHub Actions. Una compilación correcta no equivale a una reproducción probada en un iPhone con VoiceOver.

## Comprobado en código antes de esta intervención

- Textos TXT, TEXT, MD, MARKDOWN, CSV, JSON, XML, LOG, SRT.
- PDF con texto y OCR parcial de páginas escaneadas; EPUB; HTML, HTM, RTF y DOCX.
- PPTX por diapositivas y XLSX por hojas/filas/columnas; **no** los binarios antiguos PPT/PPS/XLS.
- Imágenes JPG/JPEG/PNG/HEIC/HEIF/TIF/TIFF mediante OCR.
- Audio MP3/M4A/M4B/AAC/WAV/AIF/AIFF/CAF mediante AVAudioPlayer (la decodificación depende también del archivo real y del sistema).
- Paquetes DAISY ZIP o .daisy con detección de NCC/SMIL/NCX, texto extraíble y pistas de audio. No hay reproducción sincronizada texto-audio ni interpretación completa de SMIL.
- OPDS 1 y 2; Proyecto Gutenberg y catálogos HTTPS personalizados; Bookshare se abre externamente a la espera de autorización de su API.
- Voz sintetizada, modo de lectura automático/manual, control de velocidad, posiciones y temporizador por documento.
- Reproducción en segundo plano declarada en Info.plist.

## Deficiencias detectadas y modificaciones aplicadas

1. Un ZIP de capítulos MP3/M4A/M4B sin marcadores DAISY era rechazado. Ahora se trata como audiolibro, con pistas ordenadas por nombre de forma natural, límites de extracción, descarte de rutas inseguras y rechazo de ZIP que no contienen audio ni DAISY.
2. AVAudioPlayer no encadenaba pistas automáticamente. Se añadió delegado de fin de pista y cola de reproducción dentro de la misma obra; la pausa y el cierre detienen correctamente la cola.
3. La posición guardada sólo incluía porcentaje, no número de pista. La biblioteca ahora guarda ambos, conservando compatibilidad con los documentos anteriores.
4. Las marcas en audiolibros distintos capítulos colisionaban por porcentaje. Se añadieron marcas por pista con recuperación y eliminación.
5. Para moverse a capítulos lejanos había que pulsar siguiente repetidamente. Se añadió un selector de pista ajustable con VoiceOver; permanecen controles anterior/siguiente.
6. El progreso se identificaba como porcentaje leído de la obra completa aunque sólo medía la pista activa. El texto ahora señala explícitamente **pista y porcentaje de esa pista**.

## Funcionalidades que aún NO deben anunciarse como completas

- DAISY 2.02 y DAISY 3 con sincronización SMIL, jerarquía, páginas, frases y saltos por tiempo; DAISY protegido (DRM/credenciales).
- EPUB con gestión exhaustiva de orden de lectura *spine*, tablas, notas, enlaces, multimedia, EPUB 3 media overlays, EPUB con DRM.
- Múltiples variantes de audio de terceros: OGG/Vorbis, Opus, WMA, FLAC, AMR, y conversiones de audio no soportadas por decodificador nativo; no prometerlas sin decodificador y pruebas de dispositivo.
- Audiolibros ZIP con listas de reproducción internas M3U/PLS o estructura de capítulos no alfabética.
- RAR y 7Z; CBR/CBZ y otros archivos arbitrarios; formatos Braille BRF, BRL y PEF.
- Office binario antiguo PPT, PPS y XLS; ODT/ODS/ODP (LibreOffice) y formatos propietarios. PPSX/PPTM/XLSM se procesan como Office XML sin ejecutar macros, pero necesitan pruebas reales.
- Audio de múltiples pistas con metadatos de capítulos, duración total de la obra, carátulas o velocidad fina, controles de la pantalla bloqueada / auriculares (MPRemoteCommandCenter), y control continuo desde la biblioteca sin abrir la obra.
- Importación desde catálogos restringidos sin API, préstamos con DRM, audiolibros de servicios de suscripción o aplicaciones externas.
- Restauración del punto exacto en la pista a nivel de segundos (la persistencia es porcentual), y reproducción sin huecos exacta entre archivos; AVAudioPlayer encadena al finalizar con una transición, no audio gapless.
- Pruebas de reproducción en dispositivo real con diferentes codecs, daisy completos, archivos largos, llamadas, Bluetooth y VoiceOver.

## Matriz mínima de pruebas manuales para TestFlight

1. Abrir MP3, M4A, M4B, AAC y WAV reales; comprobar inicio, pausa, salto de 30 segundos, porcentaje, velocidad y fin.
2. ZIP con 01.mp3, 02.mp3 y 10.mp3, verificar orden numérico natural y reproducción de la siguiente pista sin pulsar nada.
3. ZIP DAISY con NCC/SMIL y audio; validar lectura de texto y audio, verificando que no se promete sincronización.
4. ZIP de fotos o textos sueltos sin audio ni DAISY: debe mostrar error explícito y no dar por importado un documento ilegible.
5. Marcar pista 1 al 40% y pista 2 al 40%, comprobar marcas independientes y regreso a la posición correcta.
6. Salir y reabrir en pista 3 al 55%; confirmar la pista y porcentaje, también después de reiniciar la app.
7. Iniciar lectura con pantalla bloqueada, cambiar velocidad, usar VoiceOver y recibir una llamada; comprobar reanudación y no solapamiento de voz.
8. Comprobar EPUB, PDF mixto con OCR, DOCX, PPTX y XLSX para detectar regresiones.
9. Comprobar modo automático/manual y temporizador con varias obras, sin perder marcas ni preferencias preexistentes.
10. Probar archivos dañados, cifrados, ZIP con rutas inseguras, miles de entradas y tamaños grandes, sin bloqueo ni fugas de datos.

## Criterios de distribución

- Ejecutar node --test ios-app-native/tests/*.test.mjs y la compilación SwiftUI de Xcode.
- No mezclar esta mejora con cambios ajenos o con publicación Android.
- TestFlight se genera por el workflow que escucha cambios fusionados en main, y sólo estará listo cuando Apple complete el procesamiento y GitHub Actions confirme probadores internos.
