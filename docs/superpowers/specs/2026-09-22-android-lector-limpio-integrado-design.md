# Diseño: Android 1.1.0 con lector limpio integrado y Compartir con TifloAcosta

Fecha: 2026-09-22

## 1. Objetivo

Preparar una única versión Android que reúna, sin publicar una entrega intermedia, las correcciones ya incorporadas en `main`, la función **Compartir con TifloAcosta** y un **lector limpio común** reutilizado por Actualidad, Buscar y Compartir.

El punto de partida será la rama `main` actual, que ya contiene las correcciones de apertura exacta de resultados y la versión 1.0.4 con `versionCode 5`. Sobre esa base se integrarán de forma controlada las piezas válidas de `feature/compartir-con-tifloacosta` y se adaptarán para que el lector deje de depender de una sesión Compartir.

La siguiente candidata completa usará `versionName 1.1.0` y `versionCode 6`.

## 2. Resultado esperado

La versión se considerará correctamente integrada cuando:

- Actualidad abra el artículo exacto dentro de TifloAcosta mediante lectura limpia.
- Buscar abra el resultado exacto: noticia al lector, vídeo al reproductor y recurso/documento a su contenido concreto.
- Android ofrezca TifloAcosta como destino al compartir texto o enlaces.
- Las páginas web compartidas utilicen el mismo lector limpio que Actualidad y Buscar.
- Los enlaces de YouTube utilicen el reproductor accesible, sin reproducción automática.
- Las descargas conocidas reutilicen el analizador de Descargas.
- Volver y el foco regresen al punto exacto desde el que se abrió el contenido cuando sea posible.
- Los fallos de red o extracción no dejen al usuario bloqueado.
- No se publique la 1.0.4 actualmente preparada como entrega intermedia.

## 3. Estrategia de integración

Se seguirá la opción aprobada: **partir de `main` y construir encima la versión completa**.

No se fusionará a ciegas la rama existente de Compartir. Se reutilizarán sus componentes ya probados de forma selectiva y se resolverán explícitamente las diferencias con `main`.

Esto evita perder las correcciones ya integradas en 1.0.4 y reduce el riesgo de sobrescribir cambios recientes en `app.mjs`, Actualidad, Buscar, vídeos o la configuración Android.

## 4. Arquitectura común

La aplicación tendrá cuatro responsabilidades separadas:

1. **Entrada**: Actualidad, Buscar o Compartir identifican qué contenido eligió el usuario y desde qué control.
2. **Clasificación**: un clasificador común decide si el destino es vídeo, descarga, página web o texto.
3. **Lectura**: un cargador y limpiador común obtiene contenido textual remoto de forma controlada y lo convierte en un modelo semántico seguro.
4. **Presentación y retorno**: un controlador de lector común mantiene la pila temporal, los estados de carga/error y el contexto necesario para volver y restaurar el foco.

El lector limpio no dependerá de `share-session`. La sesión Compartir podrá utilizarlo, pero Actualidad y Buscar podrán abrirlo de forma independiente.

## 5. Flujo de Actualidad

El titular de una noticia será la acción principal de lectura.

Flujo:

`Actualidad → titular → clasificador común → obtención segura → lector limpio`

Si el destino final se reclasifica como YouTube o descarga, se utilizará el reproductor o Descargas en lugar de forzar la lectura como artículo.

**Abrir fuente original** se mantendrá como acción secundaria para noticias. Si la extracción falla, se ofrecerán como mínimo Reintentar, Abrir fuente original y Volver.

Al regresar, la aplicación volverá a Actualidad e intentará restaurar el foco sobre el titular que abrió el contenido.

## 6. Flujo de Buscar

Cada resultado conservará suficiente identidad para abrir exactamente el elemento seleccionado.

- **Vídeo**: abre ese vídeo concreto en el reproductor accesible.
- **Noticia**: abre esa noticia concreta en el lector limpio común.
- **Recurso/documento**: abre ese recurso concreto mediante el flujo accesible que le corresponda; no se limitará a mostrar Biblioteca.
- **Otros tipos futuros**: solo podrán ser activables cuando definan cómo abrir su contenido exacto.

Al volver, se conservarán consulta y resultados, y se intentará restaurar el foco en el resultado activado.

## 7. Flujo Compartir con TifloAcosta

Android registrará `ACTION_SEND` para contenido textual. No se incluirán archivos binarios ni `ACTION_SEND_MULTIPLE` en esta versión.

`TifloSharePlugin` se limitará a recibir Intents, entregar el texto a Capacitor y finalizar el flujo mediante `moveTaskToBack(true)`.

La sesión Compartir será temporal y reemplazará completamente cualquier sesión anterior al recibir un nuevo contenido.

Comportamiento:

- varias URLs → anunciar cantidad y permitir elegir;
- texto puro → precargar Buscar sin ejecutar automáticamente;
- YouTube → reproductor accesible;
- descarga reconocida → Descargas;
- web normal → lector limpio común.

Desde la raíz de Compartir, Volver o Cancelar destruye la sesión y envía TifloAcosta al segundo plano.

## 8. Lector limpio común

`TifloWebFetchPlugin` obtendrá páginas externas con límites estrictos:

- solo HTTP/HTTPS;
- máximo 5 redirecciones;
- 15 segundos de tiempo total;
- máximo 5 MiB;
- `text/html`, `application/xhtml+xml` y `text/plain`;
- sin ejecución de JavaScript remoto;
- sin cookies ni sesiones autenticadas del navegador.

El limpiador producirá un modelo seguro; nunca se insertará HTML remoto directamente mediante `innerHTML`.

Se conservarán título, encabezados, párrafos, listas y enlaces editoriales útiles. Se eliminarán scripts, estilos, navegación global, publicidad, promociones, afiliados, formularios, comentarios, newsletters, redes sociales, iframes y bloques no necesarios para la lectura.

Una lectura no se considerará válida si no alcanza criterios mínimos objetivos de contenido útil. No se mostrará basura o fragmentos incompletos como si fueran una lectura correcta.

## 9. Enlaces dentro del lector

Los enlaces útiles conservados volverán al clasificador común:

- YouTube → reproductor accesible;
- descarga conocida → Descargas;
- página web → nueva lectura limpia dentro de la misma pila temporal.

El lector mantendrá una pila temporal como:

`Página inicial → Página 2 → Página 3`

Volver retrocederá una página cada vez. En la raíz:

- desde Actualidad → vuelve a Actualidad;
- desde Buscar → vuelve a los resultados;
- desde Compartir → termina la sesión y pone TifloAcosta en segundo plano.

Las pantallas auxiliares abiertas desde el lector deberán regresar al punto exacto del lector cuando se cierren.

## 10. Foco y accesibilidad

La interfaz mantendrá semántica real de encabezados, listas, botones y enlaces.

Las operaciones asíncronas usarán regiones de estado accesibles. El foco no saltará durante una carga y, al aparecer una lectura nueva, se moverá al encabezado principal del contenido.

No habrá autoplay, sonidos propios ni locuciones que compitan con el lector de pantalla.

Las pruebas no se limitarán a TalkBack. Se comprobará el comportamiento con el lector de pantalla que utilicen los probadores, incluyendo TalkBack, Jieshuo, AccessiMind u otros cuando estén disponibles.

## 11. Errores y recuperación

Los errores de red, timeout, tamaño, tipo de contenido, redirecciones o lectura no fiable deberán terminar siempre en un estado accesible y recuperable.

Para contenido abierto desde Actualidad o Buscar/noticia, el error podrá ofrecer **Abrir fuente original** como alternativa secundaria.

Para contenido abierto desde Compartir, la salida seguirá el contexto temporal de la sesión: Reintentar, Analizar descargas cuando sea pertinente, o Cancelar y volver.

Las respuestas asíncronas antiguas deberán invalidarse para impedir que una carga anterior sustituya contenido de una navegación o sesión más reciente.

## 12. Seguridad y privacidad

- Solo se aceptarán destinos HTTP/HTTPS para lectura remota.
- No se ejecutará código remoto.
- No se reutilizarán cookies ni sesiones autenticadas.
- No se intentará superar muros de pago ni autenticaciones.
- No habrá descargas automáticas.
- Las URLs y el historial de lectura permanecerán en memoria y no se guardarán automáticamente.
- Las URLs de lectura limpia no se enviarán al backend de TifloAcosta.
- La validación de URLs y redirecciones será conservadora; no se repararán enlaces de forma especulativa.

## 13. Integración con el código existente

La implementación partirá de `main` y reutilizará, tras revisión, las piezas ya existentes en la rama de Compartir, entre ellas:

- `share-classifier`;
- `share-session`;
- `readable-page`;
- `reader-session`;
- `readable-loader`;
- `TifloSharePlugin`;
- `TifloWebFetchPlugin`;
- pantalla de lectura;
- adaptador de vídeo externo;
- pruebas ya válidas de Compartir y lectura limpia.

Se resolverán de forma explícita los conflictos con las correcciones actuales de `main`, especialmente en:

- `mobile/src/app.mjs`;
- `mobile/src/core/search.mjs`;
- `mobile/src/screens/actualidad.mjs`;
- `mobile/src/screens/search.mjs`;
- `mobile/src/screens/videos.mjs`;
- configuración de versión Android;
- pruebas de regresión de la 1.0.4.

## 14. Pruebas obligatorias

### Automatizadas

- titular de Actualidad abre el artículo exacto en lector limpio;
- noticia de Buscar abre el mismo lector común;
- vídeo de Buscar abre el vídeo exacto sin autoplay;
- recurso/documento abre su contenido exacto;
- web compartida usa el lector común;
- enlaces del lector se reclasifican correctamente;
- volver restaura origen y foco cuando sea posible;
- fallo de extracción ofrece recuperación adecuada;
- solicitudes antiguas no pisan navegación reciente;
- sesión Compartir nueva reemplaza completamente la anterior;
- clasificación de YouTube, descarga, web y texto;
- límites nativos de red;
- suite móvil completa;
- compilación Android completa y bundle firmado.

### Manuales con probadores

- aplicación cerrada y abierta al compartir;
- una y varias URLs;
- artículos normales e índices con enlaces;
- YouTube y descargas;
- sin conexión y servidores lentos;
- Volver desde lector, vídeo, Descargas, Buscar y raíz de Compartir;
- foco inicial, orden de lectura, nombres de controles y regiones de estado;
- navegación por encabezados, listas y enlaces;
- comportamiento con distintos lectores de pantalla disponibles.

## 15. Versión y publicación

La candidata integrada será **1.1.0 (`versionCode 6`)**.

El AAB 1.0.4 (`versionCode 5`) que ya se ha subido a la creación de una versión cerrada no se confirmará ni se publicará. Cuando la 1.1.0 esté compilada, firmada y verificada, se sustituirá el borrador de Play Console por la nueva candidata siguiendo los pasos que permita la consola.

No se fusionará la rama de integración a `main` ni se publicará en Google Play hasta completar las pruebas automatizadas y obtener el visto bueno final para esa candidata.

## 16. Criterios de aceptación

La 1.1.0 queda lista para prueba cerrada cuando:

1. Actualidad, Buscar y Compartir utilizan un único lector limpio común para páginas web.
2. Buscar abre cada resultado exacto y conserva el contexto al volver.
3. Compartir recibe texto y enlaces sin almacenar la sesión permanentemente.
4. YouTube y Descargas reutilizan sus flujos dedicados.
5. El lector conserva semántica útil y elimina ruido sin ejecutar contenido remoto.
6. Los errores son recuperables y nunca dejan un estado infinito.
7. El foco y Volver funcionan de acuerdo con el origen del contenido.
8. No existe autoplay ni comportamiento que compita con lectores de pantalla.
9. Las pruebas automatizadas pasan completas y el bundle Android se genera y firma correctamente.
10. Los probadores pueden validar el comportamiento con los lectores de pantalla que utilicen.
11. La 1.0.4 no se publica como versión intermedia.
