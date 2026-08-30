TIFLOACOSTA APP — GUÍA VIGENTE DE MANTENIMIENTO
Estado actual: versión 0.16.1, fase final previa a la versión 1.0

Aplicación pública:
https://tifloacosta.github.io/tifloacosta-app/

Repositorio:
https://github.com/TifloAcosta/tifloacosta-app

OBJETIVO
Esta es la documentación vigente para mantener TifloAcosta App. Sustituye las instrucciones antiguas de las versiones 0.4, 0.12, 0.13 y posteriores paquetes intermedios.

La aplicación es una PWA bilingüe, accesible y orientada especialmente al uso con lectores de pantalla. Reúne recursos, novedades, vídeos, información del libro, contactos, redes, configuración visual y notificaciones.

CRITERIO DE ACCESIBILIDAD
La referencia de accesibilidad es la experiencia conseguida en la versión 0.16.1.

Se conserva la semántica que realmente ayuda: contenido principal, encabezados bien jerarquizados, etiquetas de formularios, controles nativos, estados dinámicos y enlace para saltar al contenido principal.

Se evita añadir contenedores semánticos innecesarios que provoquen anuncios repetitivos como “inicio de región”, “fin de región”, “inicio de grupo”, “fin de artículo” u otros similares cuando no aporten orientación real.

No debe añadirse ARIA si el HTML nativo ya expresa correctamente la función del elemento.

MANTENIMIENTO DE RECURSOS: MODO MANUAL BAJO DEMANDA
Los documentos de Google Drive NO se sincronizan automáticamente con la app.

Procedimiento acordado:
1. El nuevo documento se coloca en la carpeta de Google Drive que corresponda, en español o en inglés.
2. Se solicita la actualización de TifloAcosta App indicando qué documento se ha incorporado.
3. Se localiza el archivo en Drive y se comprueban su título, idioma, categoría y enlace definitivo.
4. Se actualiza data.js conservando la estructura existente y sin alterar otros recursos.
5. Si el documento debe aparecer en Novedades, se marca como nuevo. La portada muestra un máximo de tres novedades por idioma, por lo que se revisan también las marcas de novedades anteriores para que se muestren las tres que realmente correspondan.
6. Se comprueba que funcionan búsqueda, categorías, favoritos, cambio de idioma y enlaces.
7. Se prepara un paquete mínimo con únicamente los archivos que sea necesario sustituir.
8. Se suben esos archivos a la rama main de GitHub.
9. Después de la publicación, se verifica la aplicación pública.

Una actualización de contenido que solo modifique data.js no obliga por sí misma a cambiar la versión de la aplicación. La numeración de versión se reserva para cambios de interfaz, comportamiento, accesibilidad o infraestructura.

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

La prueba completa de notificaciones en iPhone se realizará al final del proceso de cierre, con la PWA instalada en la pantalla de inicio.

No modificar la configuración de OneSignal ni su trabajador durante una actualización normal de recursos.

PWA, CACHÉ Y ACTUALIZACIONES
manifest.webmanifest define la instalación de la aplicación.

sw.js es el trabajador de servicio de la PWA. Su caché está versionada y la aplicación utiliza estrategia de red prioritaria para páginas, scripts, estilos y videos.json.

El botón “Actualizar aplicación” está destinado a ayudar a renovar la versión instalada sin eliminar la configuración independiente de OneSignal.

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

VERSIÓN 1.0
La versión 0.16.1 es la referencia funcional y de accesibilidad previa al cierre.

Antes de declarar la versión 1.0 se completará la prueba final de notificaciones en iPhone y se realizará una última revisión de publicación. Si no aparecen incidencias, la 1.0 deberá limitarse a consolidar el estado estable, retirar la indicación “de prueba” y actualizar la numeración, evitando introducir funciones nuevas en ese momento.
