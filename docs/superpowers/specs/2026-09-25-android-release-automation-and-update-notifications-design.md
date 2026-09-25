# Android: automatización de compilaciones, publicación y avisos de actualización

Fecha: 2026-09-25

## Objetivo

Reducir al mínimo el trabajo manual para preparar, compilar, verificar y publicar nuevas versiones Android de TifloAcosta, con especial atención a que el proceso resulte cómodo con lector de pantalla.

La meta operativa es que una nueva versión pueda prepararse a partir de una única solicitud de versión y que el sistema se encargue del resto: numeración, pruebas, compilación, firma, comprobaciones, subida a Google Play, notas de versión, paquete descargable y aviso a los usuarios cuando haya una actualización disponible.

## Estado actual que se conserva

El flujo Android existente ya realiza pruebas de repositorio y de la app móvil, genera el bundle web, sincroniza Capacitor, prepara la firma desde los secretos de GitHub, genera APK/AAB, verifica la firma y comprueba la integración de OneSignal y el permiso de notificaciones.

Estas comprobaciones se conservan y se reutilizan. La automatización nueva no debe debilitar ninguna de ellas.

## Separación de responsabilidades

Habrá dos circuitos distintos:

1. **Validación Android**: continúa ejecutándose ante cambios normales para comprobar que el proyecto sigue compilando y que las pruebas pasan.
2. **Crear versión Android**: circuito específico para una versión destinada a Google Play. Solo este flujo numera la versión, firma el AAB definitivo, prepara notas y publica en una pista de Google Play.

De este modo una modificación normal no se confunde con una versión publicable.

## Solicitud de versión

La versión se describe mediante un archivo pequeño y legible, por ejemplo `mobile/release/request.json`, que actuará como única fuente de intención de publicación.

Contendrá como mínimo:

- `versionName`, por ejemplo `1.3.2`.
- pista de Google Play de destino.
- estado de la publicación (`draft`, `completed` o despliegue gradual cuando corresponda).
- prioridad de actualización de Google Play, de 0 a 5.
- si debe enviarse aviso push de nueva versión.
- notas de versión en español e inglés, o referencias a archivos de texto separados.

El objetivo práctico es que Tony pueda indicar simplemente que se prepare una versión concreta y no tenga que editar Gradle ni recorrer formularios extensos de Play Console.

## Numeración automática

`versionName` será la versión visible indicada en la solicitud.

`versionCode` dejará de ser un número que haya que editar manualmente. El flujo de publicación:

1. se autenticará contra Google Play;
2. abrirá una edición temporal de la aplicación;
3. consultará los bundles y pistas actuales;
4. calculará un código superior al máximo conocido;
5. contrastará ese valor con un pequeño estado local del último código publicado con éxito;
6. utilizará el mayor valor más uno.

Gradle aceptará `versionName` y `versionCode` mediante variables de entorno o propiedades de compilación. Los valores actuales del archivo Gradle quedarán únicamente como valores de desarrollo/fallback y no serán la fuente de verdad para una publicación.

Tras una publicación correcta se actualizará el estado local del último `versionCode` utilizado. Si Google Play rechazase excepcionalmente el código por conflicto, el flujo debe detenerse con un mensaje explícito en vez de continuar con un artefacto ambiguo.

## Rendimiento de la compilación

El proceso de publicación usará instalación reproducible de Node con `npm ci` y caché para npm y Gradle.

Se mantendrán los reintentos controlados de Gradle ante fallos transitorios.

## Verificaciones obligatorias antes de publicar

No se subirá ningún AAB a Google Play hasta que se hayan superado todas estas comprobaciones:

- pruebas generales del repositorio;
- pruebas de la aplicación móvil;
- construcción del bundle web;
- sincronización de Capacitor Android;
- existencia de credenciales de firma completas;
- generación de APK de prueba;
- generación de AAB de release;
- firma válida del AAB;
- `versionName` y `versionCode` esperados en el artefacto;
- presencia de `POST_NOTIFICATIONS`;
- presencia de OneSignal en el manifiesto fusionado;
- comprobaciones adicionales de integridad del paquete que sean viables con las herramientas de Android disponibles en el runner.

Si falla una sola comprobación, la publicación se cancela.

## Nombres y paquete de salida

Los artefactos de cada versión se renombrarán de forma explícita:

- `TifloAcosta-Android-<version>-code<code>.aab`
- `TifloAcosta-Android-<version>-code<code>-debug.apk`
- `TifloAcosta-Android-<version>-code<code>.zip`

El ZIP contendrá como mínimo:

- AAB firmado;
- APK de prueba;
- `INFORMACION-COMPILACION.txt`;
- notas para Google Play en español e inglés.

`INFORMACION-COMPILACION.txt` incluirá versión, código, fecha, commit, pista, estado de publicación y resultado de todas las comprobaciones. Estará pensado para poder revisarse cómodamente con JAWS, NVDA o VoiceOver sin necesidad de interpretar el log completo de GitHub Actions.

## Resumen accesible de GitHub Actions

Al finalizar, el workflow escribirá en el resumen de GitHub Actions un bloque corto y lineal con:

- resultado general;
- versión y código;
- pruebas;
- firma;
- AAB;
- APK;
- pista de Google Play;
- estado de subida/publicación;
- aviso push de actualización;
- nombre del artefacto descargable.

Los errores también deben expresarse con mensajes directos y accionables, evitando obligar a recorrer cientos de líneas del log para saber qué falló.

## Publicación automática en Google Play

Se utilizará la Google Play Developer API oficial.

El flujo realizará:

1. autenticación con una cuenta de servicio almacenada como secreto de GitHub;
2. creación de una edición de Google Play;
3. consulta del estado actual para numerar la versión;
4. subida del AAB;
5. asignación del AAB a la pista indicada;
6. incorporación de las notas de versión ES/EN;
7. asignación de `inAppUpdatePriority`;
8. validación de la edición;
9. commit de la edición cuando la solicitud indique publicación, o creación como borrador cuando así se pida.

Durante la etapa beta actual, el proceso podrá publicar directamente en la pista de pruebas configurada. Para producción, la solicitud de versión seguirá teniendo que declarar explícitamente que el destino es producción; no se promoverá accidentalmente una beta a producción.

## Configuración inicial de Google Play

Será necesario realizar una sola vez la configuración de acceso a la API y guardar las credenciales de la cuenta de servicio en GitHub, con un nombre del tipo `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

Los secretos de firma actuales siguen separados y no se reutilizan como credenciales de Google Play.

## Aviso de actualización: dos capas

La aplicación usará dos mecanismos complementarios.

### 1. Aviso push al publicarse una nueva versión

Después de que Google Play acepte y confirme el commit de una versión, el workflow podrá enviar mediante OneSignal una notificación específica de actualización.

Ejemplo conceptual:

- título: `Nueva versión de TifloAcosta`;
- mensaje: `Ya hay una actualización disponible. Abre TifloAcosta para actualizar.`

El aviso nunca se enviará antes de que Google Play haya aceptado la publicación.

El envío se dirigirá únicamente a Android y, cuando sea posible, a dispositivos con una versión anterior a la recién publicada.

Para evitar depender de etiquetas redundantes, la app registrará en OneSignal metadatos útiles de versión. Se revisará el uso actual de `tiflo_client=android_app`, ya que la propia plataforma de OneSignal puede identificar Android. La implementación debe respetar los límites de etiquetas del plan de OneSignal y no introducir más tags de los necesarios.

La API REST de OneSignal requerirá una clave guardada como secreto de GitHub, por ejemplo `ONESIGNAL_REST_API_KEY`.

### 2. Comprobación integrada al abrir o reanudar la app

Android incorporará el mecanismo oficial de Google Play In-App Updates mediante un puente nativo de Capacitor controlado por el proyecto.

Cuando la app detecte una versión disponible:

- presentará un aviso accesible y breve;
- ofrecerá `Actualizar ahora` y, cuando la prioridad lo permita, `Más tarde`;
- una actualización normal utilizará el flujo flexible de Google Play;
- una actualización crítica podrá utilizar el flujo inmediato si la prioridad y Google Play lo permiten.

En el flujo flexible el usuario podrá seguir usando la app durante la descarga. Cuando la actualización esté descargada, la app mostrará un aviso accesible para completar la instalación/reinicio.

La comprobación se realizará al iniciar la app y al volver al primer plano, evitando avisos repetitivos durante una misma sesión.

## Accesibilidad del aviso de actualización

Antes de invocar la interfaz de Google Play, TifloAcosta mostrará su propio mensaje accesible con estructura clara y foco controlado.

Requisitos:

- encabezado identificable por TalkBack;
- texto breve que indique versión disponible;
- botón `Actualizar ahora` claramente etiquetado;
- botón `Más tarde` cuando proceda;
- sin temporizadores que obliguen a responder deprisa;
- sin depender exclusivamente de color, iconos o gestos;
- retorno de foco coherente si el usuario aplaza la actualización;
- anuncio accesible cuando la descarga termine y sea necesario reiniciar.

## Prioridad de actualización

La solicitud de versión podrá declarar prioridad 0-5.

Regla inicial:

- 0-2: actualización normal, aviso flexible y aplazable;
- 3-4: actualización importante, se destaca con más claridad pero sigue intentando no interrumpir innecesariamente;
- 5: reservada para una actualización realmente crítica; podrá solicitar flujo inmediato si Google Play lo permite.

La prioridad no se utilizará como recurso editorial, sino únicamente para la urgencia real de instalar una versión.

## Notificaciones de novedades frente a notificaciones de versión

Se mantienen separadas:

- una **notificación de novedad** lleva al contenido o sección correspondiente;
- una **notificación de actualización** informa de una nueva versión Android y conduce al flujo de actualización.

Una publicación de contenido no obliga a generar una nueva versión Android cuando el contenido pueda actualizarse remotamente.

## Tratamiento de los usuarios beta

La versión Android 1.3.1 conserva el sistema nativo de OneSignal introducido en 1.3.0. Los usuarios beta que hayan aceptado notificaciones están suscritos y pueden recibir envíos dirigidos a las suscripciones Android correspondientes.

No se interpretará el hecho de que el envío se haya efectuado como garantía de entrega a cada dispositivo. La verificación de una campaña concreta corresponde al informe de entrega de OneSignal.

## Seguridad

- Ninguna credencial se escribirá en el repositorio ni en artefactos.
- Los logs no imprimirán contraseñas, keystore, cuenta de servicio ni clave REST de OneSignal.
- La publicación se abortará si falta una credencial requerida.
- La cuenta de servicio de Google Play tendrá únicamente los permisos necesarios para la aplicación TifloAcosta.
- El workflow de publicación no se ejecutará como efecto colateral de cualquier commit normal.

## Pruebas

Se añadirán pruebas para:

- validación del archivo de solicitud de versión;
- cálculo de versión visible y código;
- rechazo de parámetros inválidos;
- generación de nombres de artefacto;
- generación del resumen de compilación;
- generación de notas de Google Play;
- decisiones de prioridad flexible/inmediata;
- estado del aviso de actualización;
- comportamiento accesible de aplazar/aceptar;
- routing de una notificación de actualización;
- segmentación de OneSignal sin tags redundantes;
- comportamiento cuando faltan credenciales de publicación.

Las llamadas reales a Google Play y OneSignal se aislarán detrás de funciones/servicios para poder probar la lógica sin publicar versiones ni enviar notificaciones durante los tests.

## Criterio de éxito

Para una versión habitual, el proceso deseado será:

1. indicar la versión y los cambios;
2. actualizar la solicitud de versión;
3. dejar que GitHub Actions ejecute pruebas y compilación;
4. obtener automáticamente el siguiente `versionCode`;
5. firmar y verificar;
6. subir a la pista indicada de Google Play;
7. publicar o dejar en borrador según la solicitud;
8. generar el paquete descargable y un resumen accesible;
9. enviar el aviso de actualización cuando corresponda;
10. permitir que la propia app detecte la nueva versión y ofrezca actualizarla de forma accesible.

El usuario no debería necesitar editar Gradle, localizar manualmente el siguiente código de versión, renombrar archivos, volver a escribir notas en Play Console ni recorrer el panel de Google Play para una publicación rutinaria.