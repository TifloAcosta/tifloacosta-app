# Publicación de TifloAcosta iOS 1.0 — preparación (20/10/2026)

## Estado contrastado
- Aplicación: `com.tifloacosta.app`; destino: iPhone (TARGETED_DEVICE_FAMILY=1). El proyecto de producción es `ios-app-native`, SwiftUI, rama `main`.
- GitHub Actions de 20/10/2026: ejecución 39412294166 completada correctamente; exportó el IPA y confirmó la beta disponible para el grupo interno en Apple. Esto NO constituye aprobación para App Store.
- Capturas y ficha: fueron preparadas parcialmente en App Store Connect. Su estado actual **no se ha podido consultar automáticamente**; abrir la ficha para verificar cada campo.
- Guía de uso: incorporación en PR #242. Capturar pantalla solo después de instalar su compilación integrada.
- No enviar a revisión sin ejecutar las pruebas de aceptación en un iPhone real.

## Aceptación funcional en TestFlight
1. Pantalla Inicio: logo, tamaño y contraste, botón único «Guía de uso» antes de «Secciones», búsqueda global.
2. Guía: exactamente 12 destinos; cada botón abre solo las instrucciones correspondientes, con Atrás, sin contenido de otras secciones. Idiomas ES/EN según Configuración; Dynamic Type; lector VoiceOver sin ruidos, foco coherente.
3. Actualidad: noticias y selección de multimedia, búsqueda, acciones y actualización.
4. Recursos: selector de categorías, abrir, leer, guardar y descargar.
5. Vídeos: buscar en YouTube, filtro, reproducir y opciones de sesión/comentarios cuando proceda.
6. Podcasts: reproducir dentro de la aplicación, buscar episodios recientes y paginar.
7. Compartir/Recibidos, Descargas desde enlaces y Drive: una prueba real con archivo compatible y su importación a TifloLector.
8. TifloLector: texto, EPUB, PDF (con y sin capa de texto), presentaciones PPS/PPT/PPTX, Excel XLS/XLSX, DOC/DOCX y formatos de audio/DAISY admitidos; controles de lectura, modo persistente, búsqueda, marcas, progresos, voz, configuración general e individual. Indicar funciones no soportadas con claridad, sin prometer compatibilidad total antes de probarla.
9. Persistencia: cerrar y volver a abrir, reanudar documentos, importar archivos y comprobar accesos tras reinicio/actualización.
10. Revisar icono y presentación visual en todas las pantallas y la navegación por VoiceOver.

## Capturas para la ficha (iPhone)
Tomarlas DE LA VERSIÓN DEFINITIVA ya probada, con contenido representativo, sin datos privados ni avisos de TestFlight. Sugerencia editorial de ocho:
1. Inicio con el acceso a Guía de uso.
2. Guía de uso — listado de secciones.
3. Actualidad — resultados de noticias.
4. Recursos — categoría seleccionada y materiales.
5. Vídeos — búsqueda accesible o reproductor.
6. TifloLector — biblioteca con documentos de prueba.
7. TifloLector — lectura abierta con controles.
8. Podcast — lista de episodios o reproductor.

La App Store permite entre 1 y 10 capturas según el dispositivo. El proyecto solo apunta a iPhone, no a iPad. Confirmar los grupos de pantalla marcados como obligatorios en App Store Connect antes de exportar imágenes; el iPhone 15 Pro utiliza 1179 × 2556 píxeles en vertical. No ampliar capturas estirándolas ni poner capturas antiguas de interfaces retiradas.
Referencias: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ y https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/

## Ficha y declaraciones, por verificar en App Store Connect
- Elegir compilación de distribución definitiva (no una beta antigua).
- Nombre, subtítulo, descripción, palabras clave, capturas, texto promocional y localización ES; valorar versión EN de metadatos tras comprobar idioma real.
- URL de soporte y URL de política de privacidad válidas; coherencia con el tratamiento real de datos, incluidos inicio de sesión Google/YouTube y proveedores externos. No conservar «No se recopilan datos» sin comprobarlo.
- Clasificación por edades; accesibilidad declarada solo si funciona conforme a las evaluaciones de Apple.
- Derechos sobre el contenido y uso de enlaces; copyright de la ficha.
- Precio gratuito y disponibilidad por países (si esa es la política del proyecto); categoría fiscal/tributaria que exija el formulario.
- Información para el equipo de revisión: acceso sin cuenta, qué funciones utilizan Google/YouTube, cómo acceder a ellas y, si Apple lo solicita, cuenta de demostración sin datos personales.
- Exportación y cifrado: revisar la declaración vigente con los usos criptográficos y permisos de la compilación.
- Fecha o modalidad de publicación (automática o manual) y acuerdos de cuenta pendientes, si los hubiera.
- Comprobar el formulario de contacto y política europea aplicable cuando Apple la solicite.

## Envío final
En App Store Connect > TifloAcosta > iOS 1.0: adjuntar la compilación, guardar información y capturas, resolver avisos, pulsar «Añadir a revisión» y revisar el borrador. La entrega real a Apple ocurre al pulsar «Enviar para revisión». Esta operación queda pendiente hasta verificar el punto anterior y contar con la aprobación del titular.

Referencias Apple: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price
https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
