# Diseño: Descargar desde un enlace

Fecha: 18 de septiembre de 2026
Proyecto: TifloAcosta App

## Objetivo

Añadir a TifloAcosta una nueva sección de primer nivel llamada **Descargar desde un enlace**. La función debe permitir que una persona pegue una URL y obtenga, cuando sea técnicamente posible, los archivos descargables asociados a ese enlace sin que TifloAcosta almacene ni retransmita dichos archivos.

La prioridad es que el flujo sea claro, accesible y útil con VoiceOver, TalkBack, JAWS y NVDA.

## Alcance de la primera versión

La primera versión debe reconocer expresamente:

- Google Drive
- Dropbox
- OneDrive
- iCloud Drive
- Box
- MEGA
- WeTransfer
- MediaFire
- pCloud
- Enlaces directos a archivos
- Páginas web normales que contengan enlaces descargables

Si aparece un servicio no reconocido, se tratará como una página web normal.

Quedan fuera del sistema de descarga las redes sociales y servicios de vídeo cuyo enlace no corresponda a un archivo descargable de forma oficial o directa. No se intentará extraer contenido de YouTube, TikTok, Instagram, X o Facebook mediante técnicas de elusión.

## Experiencia de usuario

La pantalla principal de TifloAcosta incorporará una sección propia llamada **Descargar desde un enlace**.

Al entrar, la persona encontrará:

1. Un campo **Pega aquí el enlace**.
2. Un botón **Analizar enlace**.
3. Un área de estado accesible para mensajes como:
   - Analizando enlace.
   - 3 archivos encontrados.
   - Este enlace requiere identificación.
   - No se encontraron archivos descargables.
   - El analizador no está disponible temporalmente.
4. Una lista de resultados cuando se encuentren uno o varios archivos.
5. Un buscador **Buscar entre los archivos encontrados**.
6. Filtros sencillos por tipo de archivo cuando resulte útil.

Ningún archivo encontrado se ocultará por defecto. Los filtros solo reducirán temporalmente la vista y siempre existirá una forma clara de volver a mostrar todos los resultados.

Cada resultado mostrará, cuando sea posible:

- Nombre del archivo
- Tipo o extensión
- Tamaño
- Servicio o procedencia
- Botón **Descargar**

Si el tipo o el tamaño no pueden determinarse de forma fiable, se mostrará **Tipo no identificado** o **Tamaño desconocido**.

## Comportamiento por tipo de enlace

### Archivo directo

Si la URL apunta directamente a un archivo, TifloAcosta lo ofrecerá como resultado descargable.

### Servicio de nube conocido

Se aplicará primero una regla específica para el proveedor. Cuando sea posible obtener una URL oficial o directa de descarga desde un enlace compartido público, se mostrará como resultado.

Si el proveedor obliga a continuar en su propia página, TifloAcosta lo indicará claramente antes de salir.

### Página web normal

Si el enlace corresponde a una página HTML, el analizador buscará enlaces potencialmente descargables y devolverá todos los archivos que pueda identificar.

### Recurso con autenticación

TifloAcosta no pedirá ni almacenará credenciales.

Cuando el recurso requiera iniciar sesión:

1. La app avisará de que es necesario identificarse en el servicio externo.
2. La app conservará localmente la URL original y el contexto de la operación.
3. La persona podrá abrir la página oficial del proveedor.
4. Antes de salir se mostrará este aviso o uno equivalente:

   **Vas a salir de TifloAcosta para continuar en un servicio externo. La accesibilidad y el funcionamiento de la página que se abra dependen de ese servicio. TifloAcosta no recibe ni guarda tus credenciales.**

5. Al regresar, la app conservará el enlace y ofrecerá **Reintentar análisis**.
6. La app no prometerá que una autenticación externa permita al analizador acceder a recursos privados. Si el archivo sigue siendo privado, la descarga deberá completarse dentro del servicio externo salvo que en el futuro se implemente OAuth específico para ese proveedor.

## Arquitectura

La solución será híbrida.

### Capa 1: resolución dentro de la propia app

La app intentará resolver sin ayuda externa:

- Enlaces directos a archivos
- Patrones conocidos de servicios de nube que puedan transformarse de forma segura en enlaces de descarga
- Comprobaciones básicas del tipo de URL

Esta capa seguirá funcionando aunque el analizador externo esté fuera de servicio.

### Capa 2: analizador externo

Cuando sea necesario, TifloAcosta enviará la URL a un pequeño servicio serverless separado de GitHub Pages.

El servicio preferido para la primera versión es **Cloudflare Workers**, aprovechando la infraestructura ya usada para el dominio, pero solo se desplegará si puede hacerse sin contratar un plan de pago. Si el nivel gratuito disponible no resulta suficiente o exige coste, se buscará una alternativa gratuita antes de publicar esta capa.

El analizador:

1. Recibe una URL mediante una petición HTTPS.
2. Valida que la URL sea pública y segura.
3. Sigue redirecciones normales dentro de límites definidos.
4. Comprueba si la respuesta es directamente un archivo.
5. Si recibe HTML, analiza los enlaces presentes en la página.
6. Devuelve una lista estructurada con los posibles archivos encontrados.
7. No descarga el archivo completo.
8. No actúa como proxy de descarga.
9. No almacena archivos.
10. No solicita ni recibe credenciales.

La descarga final siempre se realizará desde el servidor original.

## Seguridad

El analizador debe impedir su uso para acceder a recursos internos o privados de red.

Como mínimo deberá bloquear:

- localhost
- 127.0.0.0/8
- ::1
- Rangos privados IPv4
- Direcciones link-local
- Metadatos de proveedores cloud y otros destinos internos conocidos

También deberá:

- Limitar el número de redirecciones
- Limitar el tiempo máximo por petición
- Limitar el tamaño de HTML que procesa
- Rechazar esquemas distintos de HTTP y HTTPS
- No ejecutar JavaScript remoto
- No eludir mecanismos de autenticación, paywalls o protecciones anticopia

## Privacidad

La URL solo se enviará al analizador cuando la persona pulse **Analizar enlace**.

Para reducir exposición accidental:

- La URL se enviará en el cuerpo de la petición y no como parte de la URL del endpoint.
- El analizador no tendrá una base de datos de historial.
- No se conservarán archivos.
- No se conservarán credenciales.
- La app guardará localmente únicamente el enlace necesario para recuperar el estado cuando la persona salga a un servicio externo y vuelva.

La política de privacidad de TifloAcosta deberá actualizarse para explicar este tratamiento temporal de URLs.

Antes de publicar la función se revisará también la declaración de Seguridad de los datos de Google Play para comprobar que siga reflejando correctamente el comportamiento real de la aplicación.

## Accesibilidad

La nueva sección seguirá las mismas prioridades de accesibilidad que el resto de TifloAcosta.

Requisitos mínimos:

- Encabezados semánticos correctos
- Etiquetas asociadas a todos los campos
- Botones nativos
- Regiones de estado con `aria-live`
- Mensajes breves y comprensibles
- Movimiento de foco solo cuando ayude a orientarse
- Foco al encabezado de resultados después de un análisis completado
- Foco al mensaje de error cuando sea necesario
- Botón claro **Volver al inicio** al comienzo y al final de la sección
- Navegación completa con teclado
- Funcionamiento probado con VoiceOver, TalkBack, JAWS y NVDA
- Español e inglés desde la primera versión

Cuando la persona salga a un servicio externo, TifloAcosta garantizará la accesibilidad de su propio tramo del recorrido: aviso previo, botón de salida, conservación de contexto y recuperación al volver. La accesibilidad de la página externa quedará expresamente identificada como responsabilidad de ese servicio.

## Errores y mensajes

Los errores no se agruparán bajo un mensaje genérico. Se distinguirán al menos estos casos:

- Enlace no válido
- Servicio no compatible
- Página no accesible
- Autenticación requerida
- Tiempo de espera agotado
- Archivo no disponible
- Página sin archivos descargables
- Analizador externo temporalmente fuera de servicio
- Respuesta del servicio no válida

Cuando el analizador externo falle, la aplicación seguirá intentando resolver enlaces directos y proveedores compatibles desde la capa local.

## Resultados y filtros

Si una página contiene muchos archivos, se mostrarán todos en una lista accesible.

La lista incluirá:

- Búsqueda por nombre
- Filtro por tipo cuando se pueda identificar
- Acción para mostrar todos
- Contador de resultados visibles y totales

La aplicación no seleccionará automáticamente un archivo como “principal”. La decisión final será siempre del usuario.

## Integración con la app actual

La nueva sección se añadirá a la navegación principal, al mismo nivel que Actualidad, Recursos, Vídeos, Mi libro, Contacto y redes, Privacidad y accesibilidad y Configuración.

La implementación deberá respetar el patrón ya existente de vistas internas con retorno claro al inicio y foco controlado.

La versión Android 2 (1.0.1) actualmente en prueba cerrada no se modificará por este trabajo si la nueva funcionalidad puede servirse mediante el contenido web remoto ya utilizado por la app.

## Pruebas mínimas antes de considerar terminada la primera versión

Se probarán al menos estos escenarios:

1. Archivo directo público
2. Google Drive público
3. Dropbox público
4. OneDrive público
5. iCloud Drive público
6. Box público
7. MEGA público
8. WeTransfer público
9. MediaFire público
10. pCloud público
11. Página web con un solo archivo
12. Página web con varios archivos
13. Página con muchos archivos y uso de búsqueda/filtros
14. Recurso que requiere autenticación
15. Enlace roto
16. Página sin archivos descargables
17. Tiempo de espera agotado
18. Analizador externo fuera de servicio
19. Navegación completa solo con teclado
20. Flujo con VoiceOver
21. Flujo con TalkBack
22. Flujo con JAWS
23. Flujo con NVDA
24. Cambio de idioma español/inglés
25. Salida a servicio externo y regreso con contexto conservado

## Criterios de éxito

La primera versión se considerará válida cuando:

- La nueva sección sea accesible desde la pantalla principal.
- Un usuario pueda pegar una URL y comprender qué ocurre sin asistencia visual.
- Funcionen, cuando el recurso sea público y el proveedor lo permita, los enlaces directos y las reglas específicas de Google Drive, Dropbox, OneDrive, iCloud Drive, Box, MEGA, WeTransfer, MediaFire y pCloud.
- Una página web con varios archivos muestre todos los archivos detectados.
- La persona pueda buscar y filtrar resultados sin perder acceso al conjunto completo.
- Las credenciales nunca pasen por TifloAcosta.
- Los archivos nunca sean almacenados ni retransmitidos por TifloAcosta.
- Los errores se expliquen de forma específica.
- La aplicación siga siendo funcional si el analizador externo no responde.
- La política de privacidad y, si procede, la declaración de Seguridad de los datos de Google Play se revisen antes de publicar la función.
