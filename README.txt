TIFLOACOSTA APP — GUÍA VIGENTE DE MANTENIMIENTO
Estado actual: versión 1.3

Aplicación pública:
https://tifloacosta.github.io/tifloacosta-app/

Repositorio:
https://github.com/TifloAcosta/tifloacosta-app

OBJETIVO
Esta es la documentación vigente para mantener TifloAcosta App. Sustituye las instrucciones de versiones y paquetes anteriores.

TifloAcosta App 1.3 es una PWA bilingüe y accesible que reúne recursos, novedades, el catálogo del Canal TifloAcosta en YouTube, información del libro, contacto y redes, configuración visual, notificaciones web y funcionamiento sin conexión.

CRITERIO DE ACCESIBILIDAD
La versión 1.3 mantiene como referencia funcional y de accesibilidad la experiencia validada durante el cierre de la versión 1.0.

Se conserva la semántica que realmente ayuda: contenido principal, encabezados jerarquizados, etiquetas de formularios, controles nativos, avisos dinámicos y enlace para saltar al contenido principal.

Se evitan contenedores semánticos innecesarios que provoquen anuncios repetitivos como “inicio de región”, “fin de región”, “inicio de grupo”, “fin de artículo” u otros similares cuando no aporten orientación real.

No debe añadirse ARIA si el HTML nativo ya expresa correctamente la función del elemento.

APERTURA Y GESTIÓN DE DOCUMENTOS
Desde la versión 1.2, el título de cada documento es el único control de entrada al recurso en Novedades, búsquedas, categorías y favoritos. Al activarlo, la aplicación muestra un cuadro de opciones antes de abrir el contenido.

Opciones disponibles:
- Abrir documento.
- Descargar documento.
- Compartir documento. Cuando el sistema no ofrece una hoja de compartir compatible, la aplicación intenta copiar el enlace al portapapeles y lo comunica de forma accesible.
- Añadir a favoritos o quitar de favoritos, según el estado actual.
- Cancelar.

Para mantener la presentación limpia, las fichas de resultados no muestran botones separados de “Abrir recurso” ni de favoritos debajo del título. El cuadro utiliza un diálogo nativo. Al cancelarlo, el foco vuelve al título desde el que se abrió. Los favoritos continúan siendo una forma de localizar rápidamente un recurso y no deben describirse como almacenamiento sin conexión.

Desde la versión 1.3, Abrir documento y Descargar documento abren el contenido externo sin sustituir la PWA. Al regresar a TifloAcosta, la aplicación permanece en la búsqueda, categoría o lista de favoritos desde la que se abrió el recurso. Los vídeos de YouTube y los enlaces web externos siguen el mismo criterio. La pantalla de vídeos ofrece además un enlace explícito para volver a la pantalla principal tanto antes como después del catálogo.

MANTENIMIENTO DE RECURSOS: MODO MANUAL BAJO DEMANDA
Los documentos de Google Drive no se incorporan automáticamente al catálogo de recursos.

Procedimiento acordado:
1. El nuevo documento se coloca en la carpeta de Google Drive que corresponda, en español o en inglés.
2. Se solicita la actualización de TifloAcosta App indicando qué documento se ha incorporado.
3. Se localiza el archivo en Drive y se comprueban su título, idioma, categoría y enlace definitivo.
4. Se actualiza data.js conservando la estructura existente y sin alterar otros recursos.
5. Si el documento debe aparecer en Novedades, se marca como nuevo. La portada muestra un máximo de tres novedades por idioma, por lo que se revisan las marcas anteriores para que aparezcan las tres que correspondan.
6. Se comprueba que funcionan búsqueda, categorías, favoritos, cambio de idioma y enlaces.
7. Se prepara un paquete mínimo con únicamente los archivos que sea necesario sustituir.
8. Se suben esos archivos a la rama main de GitHub.
9. Después de la publicación se verifica la aplicación pública.

Una actualización de contenido que solo modifique data.js no obliga por sí misma a cambiar la versión de la aplicación. La numeración se reserva para cambios de interfaz, comportamiento, accesibilidad o infraestructura.

REGLA IMPORTANTE PARA LAS SUBIDAS
No se debe sustituir ningún archivo que no forme parte expresamente del paquete preparado para una actualización.

En especial, no se debe reemplazar videos.json por un archivo vacío, de prueba o antiguo.

CATÁLOGO DE YOUTUBE: AUTOMÁTICO
El catálogo de vídeos se mantiene mediante GitHub Actions.

Archivo de automatización:
.github/workflows/sync-youtube.yml

El proceso consulta periódicamente el Canal TifloAcosta en YouTube y solo modifica videos.json cuando detecta cambios reales en el catálogo.

Por tanto:
- No editar videos.json manualmente durante el mantenimiento normal.
- No incluir videos.json en paquetes de actualización de la interfaz.
- Cuando se publique un nuevo vídeo, comprobar posteriormente que aparece de forma automática en la app.

Canal:
https://www.youtube.com/@tifloacosta

NOTIFICACIONES
Las notificaciones web están integradas mediante OneSignal.

Archivo principal:
notifications.js

Trabajador de OneSignal:
push/onesignal/OneSignalSDKWorker.js

URL pública del trabajador:
https://tifloacosta.github.io/tifloacosta-app/push/onesignal/OneSignalSDKWorker.js

La validación específica de notificaciones en iPhone queda pendiente y no bloquea la publicación de la versión 1.3. En iPhone y iPad, las notificaciones web requieren abrir la PWA instalada desde la pantalla de inicio.

Hasta realizar esa prueba específica, no debe afirmarse que las notificaciones en iPhone están validadas. La integración de OneSignal se conserva sin cambios y no debe modificarse durante una actualización normal de recursos.

PWA, CACHÉ Y ACTUALIZACIONES
manifest.webmanifest define la instalación de la aplicación.

sw.js es el trabajador de servicio de la PWA. La versión 1.3 utiliza la caché tifloacosta-app-v1-3 y mantiene estrategia de red prioritaria para páginas, scripts, estilos y videos.json.

El botón “Actualizar aplicación” ayuda a renovar la versión instalada sin eliminar la configuración independiente de OneSignal.

PUBLICAR UNA ACTUALIZACIÓN EN GITHUB
1. Abrir:
https://github.com/TifloAcosta/tifloacosta-app
2. Activar “Añadir archivo”.
3. Elegir “Subir archivos”.
4. Seleccionar únicamente los archivos descomprimidos que se hayan preparado para esa actualización.
5. Escribir un resumen claro del cambio.
6. Guardar los cambios directamente en main, salvo que se indique expresamente otra cosa.
7. Comprobar que GitHub Pages termina la publicación correctamente.
8. Verificar después:
https://tifloacosta.github.io/tifloacosta-app/

No se sube el archivo ZIP. Se descomprime y se suben los archivos que contiene.

ARCHIVOS PRINCIPALES
index.html — portada de la aplicación.
app.js — funcionamiento de la portada, recursos, idiomas y configuración.
data.js — catálogo de recursos en español e inglés.
styles.css — presentación visual.
manifest.webmanifest — instalación PWA.
sw.js — caché y funcionamiento offline.
offline.html — pantalla sin conexión.
videos.html — pantalla del catálogo de YouTube.
videos.js — interfaz y comportamiento del catálogo.
videos-core.js — búsqueda, ordenación y paginación del catálogo.
videos.json — catálogo generado automáticamente desde YouTube.
notifications.js — integración de notificaciones.
push/onesignal/OneSignalSDKWorker.js — trabajador de OneSignal.

AUTOMATIZACIONES
.github/workflows/jekyll-gh-pages.yml — publicación de GitHub Pages.
.github/workflows/sync-youtube.yml — sincronización automática del catálogo de YouTube.

ANALÍTICA
La aplicación conserva GoatCounter:
https://tifloacosta.goatcounter.com

VERSIÓN 1.3
La versión 1.3 corrige la navegación al abrir contenidos externos desde la PWA. Los documentos de Google Drive, las descargas, los vídeos de YouTube y los principales enlaces web se abren sin sustituir TifloAcosta, de modo que al regresar se conserva el punto de trabajo. El catálogo de vídeos incorpora un enlace de vuelta a la pantalla principal tanto al comienzo como al final. También se renueva la caché de la PWA para distribuir correctamente los archivos de esta versión.

VERSIÓN 1.2
La versión 1.2 simplifica la presentación de los recursos: el título del documento pasa a ser el único control visible para abrir el cuadro de gestión. Se eliminan de las fichas los controles separados “Abrir recurso” y “Añadir/Quitar de favoritos”. Las acciones de abrir, descargar, compartir y gestionar favoritos se concentran en el cuadro de opciones, junto con Cancelar.

VERSIÓN 1.1
La versión 1.1 incorpora el nuevo cuadro de gestión de documentos con apertura, descarga, compartir, favoritos y cancelación. Mantiene el catálogo de recursos, YouTube, notificaciones, analítica, configuración y estructura visual de la versión 1.0.

VERSIÓN 1.0
La versión 1.0 consolidó el estado estable alcanzado tras las pruebas de la serie 0.16.x, oficializó la aplicación, retiró la indicación “de prueba” y estableció esta guía como referencia de mantenimiento.

Las mejoras futuras se harán de forma incremental, procurando no alterar la experiencia de lector de pantalla ya validada.

PRIVACIDAD, ACCESIBILIDAD Y SEGURIDAD
La portada explica qué preferencias se guardan localmente y qué servicios externos carga realmente la aplicación (GoatCounter y OneSignal), además de resumir las ayudas de accesibilidad disponibles y cómo comunicar barreras.

GitHub Pages publica esta aplicación en la URL de proyecto indicada al comienzo de este documento. No existe un archivo CNAME ni se ha configurado un dominio personalizado.

Las limitaciones de las cabeceras HTTP en GitHub Pages y las medidas aplicables están documentadas en SECURITY.md. No deben añadirse etiquetas meta para aparentar cabeceras que requieren control del servidor.

La sincronización de YouTube ejecuta scripts/sync-youtube.mjs desde un único workflow. Si cambia videos.json, el workflow crea y sube el commit; ese push activa el workflow general de Pages, que realiza el único despliegue.
