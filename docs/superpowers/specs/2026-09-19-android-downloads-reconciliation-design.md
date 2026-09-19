# Diseño: reconciliación Android e integración de Descargas

Fecha: 2026-09-19
Estado: diseño aprobado en conversación; pendiente de revisión del documento por el usuario

## Objetivo

Poner operativa en la aplicación Android de TifloAcosta la nueva arquitectura de Descargas ya disponible en la web, sin perder el trabajo móvil existente ni degradar accesibilidad, navegación, guardado nativo o estabilidad.

El resultado debe conservar el Android ya probado por usuarios y añadir una entrada propia de `Descargas` con dos herramientas:

1. `Descargar desde un enlace`.
2. `Buscar sonidos`.

La solución Android debe usar su arquitectura móvil nativa basada en Capacitor, no incrustar la web como sustituto de una pantalla móvil.

## Contexto actual

La rama móvil existente es `feature/mobile-capacitor-foundation`.

En la revisión realizada el 19 de septiembre de 2026:

- `feature/mobile-capacitor-foundation` y `main` están divergidas.
- La rama móvil contiene el proyecto Capacitor, el proyecto Android, router propio, pantallas propias, internacionalización, acciones nativas, favoritos, preferencias y guardado mediante `TifloSave`.
- `main` contiene cambios posteriores relevantes, entre ellos el nuevo centro de Descargas, el analizador de enlaces, el Worker de Cloudflare, la búsqueda de sonidos, privacidad y cambios recientes de contenido e infraestructura.

La implementación no debe limitarse a copiar los archivos web nuevos sobre una rama móvil antigua.

## Decisión arquitectónica

La estrategia aprobada es:

1. Conservar como base funcional el Android existente.
2. Reconciliar primero la rama móvil con el `main` actual.
3. Resolver los conflictos en una rama de integración, nunca directamente en producción.
4. Mantener la arquitectura móvil existente.
5. Crear pantallas móviles propias para Descargas.
6. Reutilizar los servicios remotos existentes cuando corresponda:
   - Worker `https://download.tifloacosta.com/analyze` para analizar enlaces.
   - Worker `https://download.tifloacosta.com/sounds/search` para búsqueda interna de sonidos cuando el proveedor esté disponible.
7. Reutilizar las acciones nativas de Android para abrir enlaces externos y guardar archivos.
8. Generar y validar un nuevo AAB firmado solo después de superar pruebas de regresión, navegación y accesibilidad.

## Reconciliación de ramas

### Rama de integración

La implementación debe realizarse en una rama nueva derivada del Android existente, por ejemplo:

`feature/android-downloads-reconciliation`

No se debe trabajar directamente sobre `main` ni sobre la rama móvil estable mientras se resuelven conflictos.

### Integración de main

La rama de integración debe incorporar el `main` más reciente mediante una fusión explícita.

La resolución debe respetar estas prioridades:

- Los archivos `mobile/**` específicos de Android conservan la arquitectura móvil existente salvo cambios intencionados incluidos en este diseño.
- Los catálogos y fuentes de contenido generados desde `main` deben quedar actualizados.
- Los workflows de la web y el Worker se conservan desde `main`.
- Los workflows móviles deben mantenerse y actualizarse solo cuando haga falta para validar la integración.
- No se debe reemplazar el router móvil por el router web.
- No se debe sustituir el guardado nativo por descargas del navegador.

### Criterio de éxito de reconciliación

Antes de añadir Descargas, la rama reconciliada debe:

- instalar dependencias;
- superar la suite del repositorio;
- superar la suite móvil;
- compilar el bundle móvil;
- sincronizar Capacitor Android;
- compilar al menos APK debug y AAB release de validación;
- conservar las pantallas móviles existentes.

## Navegación Android

### Inicio

La pantalla principal debe incorporar una nueva entrada:

`Descargas`

Debe formar parte de la colección estable de opciones del inicio y recibir un identificador de foco propio.

### Centro de Descargas

La nueva pantalla `Descargas` será una pantalla móvil real con encabezado accesible y botón `Volver`.

Contendrá dos opciones claramente separadas:

- `Descargar desde un enlace`.
- `Buscar sonidos`.

Cada opción abrirá una ruta hija dentro del router móvil.

### Rutas previstas

Se usarán nombres móviles estables, equivalentes a:

- `downloads`
- `downloads-link`
- `downloads-sounds`

El router seguirá gestionando una pila de navegación, por lo que:

- el botón Android Atrás volverá primero a la pantalla anterior;
- el botón visible `Volver` tendrá el mismo destino lógico;
- al volver debe restaurarse el foco al control que abrió la pantalla hija;
- salir desde la pantalla inicial seguirá manteniendo el comportamiento actual de Android.

## Pantalla: Descargar desde un enlace

### Objetivo

Trasladar al Android la utilidad ya disponible en web para analizar una URL y presentar archivos descargables sin incrustar la interfaz web.

### Flujo

1. El usuario abre `Descargar desde un enlace`.
2. El foco se coloca en el encabezado de pantalla mediante el sistema móvil existente.
3. Se muestra un campo etiquetado para pegar o escribir una URL.
4. El usuario activa `Analizar`.
5. La app aplica primero resoluciones locales que ya puedan resolverse de forma segura, si corresponde.
6. Para páginas generales usa el Worker `/analyze`.
7. Presenta resultados como una lista accesible.
8. Cada resultado ofrece `Guardar` cuando existe una URL descargable directa.
9. El guardado usa `nativeActions.saveFile`, que a su vez utiliza `TifloSave`.
10. Cuando el análisis externo sea bloqueado por el sitio, se ofrece `Abrir sitio externo` y `Reintentar análisis`, manteniendo la distinción entre bloqueo automatizado y autenticación.

### Datos por resultado

Cuando estén disponibles:

- nombre del archivo;
- tipo/formato;
- tamaño;
- proveedor u origen;
- acción Guardar.

Los valores desconocidos permanecerán desconocidos; no se mostrarán como cero.

### Seguridad

- Solo se aceptan HTTP/HTTPS.
- La app no debe enviar credenciales del usuario al Worker.
- No se deben exponer secretos en el bundle Android.
- El Worker no se convierte en proxy del archivo completo.

## Pantalla: Buscar sonidos

### Objetivo

Ofrecer en Android la misma idea funcional aprobada para la web: buscar por término, navegar por categorías y combinar ambos criterios, con acceso a diferentes bancos de sonidos.

### Controles

La pantalla debe incluir:

- campo `Buscar sonidos`;
- selector de categoría;
- botón `Buscar`;
- región de estado accesible;
- lista de resultados;
- sección de bancos externos cuando corresponda.

### Categorías iniciales

En español e inglés:

- Tonos de llamada / Ringtones
- Notificaciones / Notifications
- Alarmas / Alarms
- Teléfonos / Phone sounds
- Tecnología / Technology
- Naturaleza / Nature
- Animales / Animals
- Ambiente / Ambience
- Divertidos / Fun
- Juegos / Games

Se podrá usar solo término, solo categoría o ambos.

### Proveedor interno

La app Android consultará el mismo endpoint del Worker:

`https://download.tifloacosta.com/sounds/search`

No contendrá una clave de Freesound.

Mientras `FREESOUND_API_KEY` no esté configurada en el Worker:

- la pantalla no debe romperse;
- debe explicar el estado de forma breve;
- los bancos externos deben seguir disponibles.

Cuando la clave exista en el futuro, Android obtendrá automáticamente resultados internos sin necesidad de publicar otra versión si el contrato del endpoint se mantiene.

### Resultados internos

Cuando existan resultados, cada elemento podrá mostrar:

- nombre;
- autor;
- banco;
- duración;
- formato;
- tamaño;
- licencia;
- preescucha;
- acción para abrir el original.

Solo se mostrarán campos que realmente existan.

### Preescucha

- No habrá autoplay.
- Se usarán controles de audio accesibles.
- Al iniciar una muestra, debe detenerse cualquier muestra anterior.
- El resultado debe poder identificarse por nombre junto al control de audio.

### Bancos externos

Mientras un banco no disponga de integración interna estable, Android lo abrirá mediante `nativeActions.openExternal` y Capacitor Browser.

Inicialmente se mantendrán al menos:

- Mixkit.
- Pixabay.

Las acciones externas deben informar claramente qué banco se va a abrir.

## Guardado nativo

El guardado de archivos directos debe continuar usando `TifloSavePlugin`.

No se introducirá un segundo sistema de guardado si el plugin existente puede resolver la descarga.

La implementación debe conservar:

- nombre de archivo útil;
- MIME cuando esté disponible;
- retorno booleano limpio ante éxito o fallo;
- manejo de errores sin cerrar la app.

Los sonidos externos que solo puedan descargarse desde la web del proveedor se abrirán en el navegador del sistema o Capacitor Browser en vez de intentar saltarse su flujo normal.

## Accesibilidad

La función se considera incompleta si solo funciona visualmente.

### TalkBack y navegación por teclado

Se deben verificar como mínimo:

- encabezado principal único por pantalla;
- botón `Volver` al comienzo de cada pantalla interior;
- etiquetas explícitas para campos;
- botones con nombre que describa la acción y, cuando proceda, el archivo o sonido;
- orden lógico de foco;
- restauración de foco al regresar;
- estado de carga y error anunciable sin mover el foco innecesariamente;
- listas de resultados navegables secuencialmente;
- no autoplay;
- botón Android Atrás coherente con el botón visible;
- ausencia de trampas de navegación.

### Bilingüe

Todas las cadenas nuevas se añadirán a `mobile/src/core/i18n.mjs` en español e inglés desde el principio.

No se dejarán textos importantes codificados únicamente en español dentro de las pantallas.

## Privacidad

La versión móvil debe respetar el mismo modelo ya descrito públicamente:

- el análisis de URL es transitorio;
- las búsquedas de sonidos se envían al servicio necesario para responder;
- TifloAcosta no crea un historial personal de términos de sonido;
- no se envían credenciales del usuario;
- los bancos externos mantienen sus propias condiciones y políticas.

Si la aplicación Android ofrece un acceso a privacidad, deberá apuntar a la política pública actualizada o reproducir únicamente información sincronizada con ella.

## Estructura de código prevista

Sin fijar nombres irrevocables, la implementación debería encajar aproximadamente así:

- `mobile/src/app.mjs`: registrar nuevas pantallas.
- `mobile/src/core/i18n.mjs`: cadenas ES/EN.
- `mobile/src/screens/home.mjs`: nueva entrada Descargas.
- `mobile/src/screens/downloads.mjs`: centro de Descargas.
- `mobile/src/screens/download-link.mjs`: análisis por URL.
- `mobile/src/screens/sound-search.mjs`: búsqueda de sonidos.
- `mobile/src/core/downloads.mjs`: normalización y cliente del analizador.
- `mobile/src/core/sound-search.mjs`: normalización y cliente del buscador de sonidos.
- `mobile/src/core/native-actions.mjs`: reutilización; cambios solo si una necesidad Android real lo exige.
- `mobile/test/**`: pruebas nuevas de navegación, análisis, sonidos y accesibilidad estructural.

No se copiarán directamente los módulos web `downloads*.js` y `sound-search*.js` dentro de Android si dependen del DOM y router web. Se reutilizarán contratos, reglas y casos de prueba, no una arquitectura incompatible.

## Pruebas obligatorias

### Reconciliación

- suite raíz del repositorio;
- suite móvil completa;
- build móvil;
- `cap sync android`;
- compilación Gradle.

### Descargas por enlace

Casos mínimos:

- URL vacía;
- esquema inseguro;
- enlace directo;
- Google Drive cuando el resolver existente lo soporte;
- Dropbox cuando el resolver existente lo soporte;
- página con varios archivos;
- tamaño desconocido;
- respuesta 401;
- bloqueo 403 automatizado;
- error temporal del Worker;
- guardado nativo correcto;
- fallo de guardado sin cierre de app.

### Sonidos

Casos mínimos:

- término vacío y sin categoría;
- término solo;
- categoría sola;
- término + categoría;
- proveedor interno no configurado;
- proveedor interno disponible mediante respuesta simulada;
- datos parciales;
- lista vacía;
- error temporal;
- bancos externos siempre accesibles;
- ninguna muestra se reproduce automáticamente;
- iniciar una muestra detiene la anterior.

### Navegación y accesibilidad

- inicio → Descargas;
- Descargas → Enlace → Volver → Descargas;
- Descargas → Sonidos → Volver → Descargas;
- botón Android Atrás en ambas rutas hijas;
- restauración de foco al botón de origen;
- cadenas ES y EN presentes;
- controles críticos con nombre accesible.

## Build y firma

El workflow móvil existente ya contempla secretos de firma.

La versión final debe:

- usar `TIFLOACOSTA_KEYSTORE_BASE64`;
- usar `TIFLOACOSTA_KEYSTORE_PASSWORD`;
- detectar el alias privado del PKCS12;
- generar APK debug para validación;
- generar AAB release firmado cuando ambos secretos estén presentes.

No se cambiarán contraseña, keystore ni alias manualmente salvo que una validación real demuestre que están dañados.

## Publicación

La integración no se fusionará en `main` hasta que:

1. la reconciliación esté verde;
2. Descargas esté verde;
3. Buscar sonidos esté verde con fallback sin Freesound;
4. las pruebas móviles y raíz estén verdes;
5. la compilación Android esté verde;
6. se genere el AAB firmado;
7. se realice revisión de código final;
8. no queden regresiones conocidas en navegación o guardado.

La subida a Google Play será un paso posterior y separado de la integración técnica del repositorio.

## Fuera de alcance de esta fase

- Conseguir o automatizar el registro de una cuenta Freesound.
- Implementar OAuth2 de Freesound para descargar originales.
- Scraping de bancos de sonidos sin API estable.
- Reescribir la aplicación Android desde cero.
- Sustituir las pantallas móviles por WebView de la web pública.
- Cambiar el sistema de firma Android existente.
- Publicar automáticamente en producción de Google Play sin revisión previa.

## Criterio final de aceptación

La fase queda completada cuando la aplicación Android conserva las funciones móviles existentes, incorpora un centro Descargas accesible con las dos herramientas aprobadas, utiliza el Worker y las acciones nativas de forma segura, funciona correctamente aunque Freesound siga sin clave, supera las suites y compilaciones correspondientes y produce un AAB release firmado listo para el siguiente paso de Play Console.