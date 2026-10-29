# TifloLector Android — auditoría y protocolo de aceptación 0.18 (bloque 7 de 7)

27 de octubre de 2026. Este informe describe un **prototipo nativo Android** (paquete `com.tifloacosta.nativeprototype`), no la aplicación TifloAcosta publicada en Google Play. La compilación automática no constituye validación funcional en un Pixel ni autorización para publicar.

## Cambios auditados y reparados en este bloque

1. Biblioteca, carpetas vacías y cola de lectura: escritura atómica con recuperación de archivos de respaldo mediante `android.util.AtomicFile`. Si un índice no puede leerse, el lector conserva los archivos y explica el error; **no trata una biblioteca dañada como una biblioteca vacía**, evitando borrados posteriores.
2. Marcas, progreso y preferencias: el servicio de reproducción y la interfaz de lector aplican cambios sobre la versión actual del libro. Se evita que una actualización tardía de progreso reemplace carpetas, nombres o favoritos.
3. Eliminación: borrar un libro retira únicamente sus documentos, pistas y checkpoints OCR asociados al identificador validado; borrar una carpeta nunca borra sus libros.
4. Copia portátil: Ajustes > Copias de seguridad > Exportar copia de la biblioteca. El ZIP incluye originales, TXT accesibles, audio DAISY, marcas, seguimiento de progreso, carpetas, cola, preferencias individuales y checkpoints OCR. El selector Android permite guardarlo **fuera de la app**, incluso en un proveedor de nube configurado. Limita entradas, tamaños y rutas relativas; no ejecuta archivos.
5. Restauración: Ajustes > Copias de seguridad > Restaurar desde ZIP. Se confirma previamente, se valida por completo el archivo y se incorpora sin sobrescribir libros existentes. Una restauración cancelada no modifica el índice anterior; el progreso de copia/restauración queda anunciado en pantalla. Los errores se muestran como texto.
6. Verificación de regresión de rutas peligrosas de ZIP, PDF/OCR, progreso textual, reglas de nombres Unicode y cola de lectura.

## Pruebas manuales obligatorias (no se pueden sustituir por CI)

Accesibilidad en Pixel con TalkBack:

- Recorrer Inicio > Importar > Ajustes > Filtros > Mi biblioteca mediante deslizamientos, exploración táctil y navegación por encabezados; verificar que cada control tenga etiqueta, estado, activación y foco estable al volver.
- Títulos: acciones personalizadas de abrir, reproducir, marcas, favoritos, información, cambiar título, mover, eliminar, cola y marcar terminado. Probar con una y muchas obras y con Braille conectado, si está disponible.
- Ajustes visuales: tamaño de fuente al 200 %, contraste, modo oscuro, orientación, teclado en pantalla y zoom Android. Confirmar que se puedan encontrar botones al crecer el texto.
- Confirmaciones de eliminar carpeta o restaurar copia: evitar confirmaciones involuntarias, foco devuelto a origen y lectura del motivo antes de aceptar.

Datos y organización:

- Crear una carpeta vacía; cerrar completamente la aplicación y reabrirla; comprobar que permanece. Mover libros, renombrar carpeta, borrarla sin eliminar ningún libro; comprobar cola, favoritos y marcas.
- Crear cola con tres libros, modificar orden, eliminar uno y restaurar una copia. No deben aparecer duplicados por identificador ni desaparecidos los restantes.
- Exportar copia completa y comparar con los originales fuera de la aplicación; comprobar que ZIP contiene `index.json`, `folders.json`, `reading-queue.json`, `preferences.json` y los archivos del libro. Probar restauración sobre instalación nueva y sobre biblioteca ya existente. **No desinstalar sin comprobar que la copia es íntegra y está fuera de la aplicación.**
- Introducir una copia manipulada con `../`, extensión no admitida, entradas duplicadas, libros incompletos o ZIP truncado; comprobar error accesible y ausencia de sobrescritura. Probar falta de espacio y cancelación.
- Comprobar simulación de cierre de proceso durante guardado de progreso, renombrado y exportación; deben sobrevivir índice y respaldo transaccional. Examinar logs Android para excepciones.

Lectura y formatos:

- Audio DAISY 2.02/3 con capítulos, páginas, notas y fragmentos; comprobar saltos y regreso a la posición previa. Repetir con DAISY sin índices. Bloquear pantalla, usar controles de notificación, auriculares y llamada entrante; pérdida y recuperación de foco sin doble locución.
- TXT, HTML, EPUB, DOCX, DOC, XLSX, XLS, PPTX, PPS, FB2, ZIP, RAR, 7Z, PDF mixto, libro MOBI sin DRM y variantes de formato no admitidas; comprobar que se explique el error y se preserve el archivo original.
- Traducir fragmento/doc con ML Kit tras descargar modelo, repetir sin conexión y exportar TXT. Confirmar que no se cambia el texto original ni se comparten archivos sin una acción del usuario.
- OCR latino: PDF de más de 250 páginas y documento ilustrado DOCX/EPUB; cancelar, cerrar proceso, reabrir y reanudar. Comprobar tiempo, batería, memoria, espacio libre y OCR parcial. Documentar fallos de imágenes, tablas, fórmulas y textos no latinos.

## Impedimentos para publicación automática

- **Firma estable:** GitHub Actions genera APK de depuración y sus certificados pueden cambiar. No se garantiza una actualización encima de builds anteriores; desinstalar **borra datos** si no se ha podido conservar una copia. La exportación incorporada en 0.18 no resuelve por sí sola el paso desde 0.17 si este exige desinstalar antes de instalar 0.18. Para una distribución pública debe usarse la firma oficial autorizada y un mecanismo real de migración.
- **Pruebas reales:** no se han ejecutado aquí las pruebas físicas del Pixel, los lectores de pantalla ni la matriz real de todos los formatos. Las suites JVM/Gradle solo comprueban las rutas automatizadas cubiertas.
- **Play Store:** la versión actualmente publicada sigue intacta. La rama se conserva en PR borrador, no fusionar ni enviar a producción hasta aceptación explícita de requisitos, revisión de permisos y política de privacidad (modelos descargados bajo demanda y contenido local).
- **Alcance:** no se promete eliminar DRM, fidelidad de maquetación Office, OCR de ecuaciones, funcionamiento con todos los codecs ni continuidad OCR tras cierre con trabajo automático de fondo.

Criterio para considerar el proyecto listo: completar y registrar esta matriz en Pixel con TalkBack, resolver bloqueantes, conservar datos mediante una actualización firmada correctamente y obtener confirmación del usuario antes de fusionar o publicar.
