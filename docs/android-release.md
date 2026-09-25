# Preparar y publicar una versión Android de TifloAcosta

Esta guía describe el procedimiento rutinario. Está escrita para poder seguirse de forma lineal con JAWS, NVDA o VoiceOver.

## Qué queda automatizado

El sistema se encarga de:

- validar la solicitud de versión;
- consultar Google Play para obtener un `versionCode` que no se haya usado;
- ejecutar todas las pruebas;
- compilar la app web móvil;
- sincronizar Capacitor;
- generar APK y AAB;
- firmar el AAB;
- verificar la firma;
- comprobar la integración de notificaciones;
- crear nombres de archivo comprensibles;
- generar `INFORMACION-COMPILACION.txt`;
- generar las notas ES/EN para Google Play;
- crear un ZIP con los archivos de la versión;
- subir el AAB a la pista indicada cuando se autoriza publicar;
- asignar la prioridad de actualización;
- enviar el aviso de nueva versión mediante OneSignal después de una publicación correcta;
- permitir que la propia app detecte una actualización y ofrezca instalarla.

## Configuración que se realiza una sola vez

El repositorio ya utiliza estos secretos para firmar Android:

- `TIFLOACOSTA_KEYSTORE_BASE64`
- `TIFLOACOSTA_KEYSTORE_PASSWORD`

Para la automatización completa hay que añadir una sola vez:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: credenciales JSON de una cuenta de servicio autorizada para la aplicación TifloAcosta en Google Play Console.
- `ONESIGNAL_REST_API_KEY`: clave REST de la aplicación de TifloAcosta en OneSignal.

Nunca deben escribirse esas claves en archivos del repositorio, comentarios, incidencias ni notas de versión.

## Archivo que define la próxima versión

La intención de publicación se guarda en:

`mobile/release/request.json`

Ejemplo de una versión preparada pero no publicable:

```json
{
  "versionName": "1.3.2",
  "track": "alpha",
  "status": "draft",
  "priority": 2,
  "notifyUpdate": true,
  "notes": {
    "es": "Mejoras en Novedades, accesibilidad y preparación de actualizaciones de Android.",
    "en": "Improvements to What's New, accessibility, and Android update preparation."
  }
}
```

Mientras `status` sea `draft`, el flujo puede preparar la versión pero no puede publicarla.

Para autorizar una publicación normal en la pista indicada se cambia únicamente:

`"status": "completed"`

Una versión dirigida a `production` requiere además una confirmación explícita dentro del archivo. Una beta no puede convertirse en producción accidentalmente.

## Prioridad de actualización

La prioridad va de 0 a 5.

- 0, 1 o 2: actualización normal. La app ofrece actualizar y permite elegir `Más tarde`.
- 3 o 4: actualización importante. Sigue prefiriendo el procedimiento flexible cuando Google Play lo permite.
- 5: reservada para una actualización realmente crítica. La app puede utilizar el procedimiento inmediato cuando Google Play lo autoriza.

## Preparar sin publicar

En GitHub Actions se utiliza el flujo:

`Create TifloAcosta Android release`

Se ejecuta con `publish` desactivado.

El sistema realiza pruebas, obtiene el siguiente código disponible, compila, firma, verifica y crea el paquete final. No asigna la versión a una pista para los usuarios ni envía una notificación de actualización.

Al terminar se obtiene un artefacto llamado:

`tifloacosta-android-release`

Dentro habrá nombres del tipo:

- `TifloAcosta-Android-1.3.2-code11.aab`
- `TifloAcosta-Android-1.3.2-code11-debug.apk`
- `TifloAcosta-Android-1.3.2-code11.zip`
- `INFORMACION-COMPILACION.txt`
- `notas-google-play.txt`

El TXT de información permite comprobar con lector de pantalla, sin recorrer el log completo, la versión, código, pista, firma y demás verificaciones.

## Publicar

La publicación requiere dos condiciones simultáneas:

1. `request.json` debe tener `status` igual a `completed`.
2. Al ejecutar el flujo se debe activar expresamente `publish`.

Si falta cualquiera de las dos, no se publica.

Cuando ambas condiciones se cumplen, el sistema:

1. vuelve a verificar la compilación;
2. sube el AAB firmado;
3. asigna la versión a la pista indicada;
4. incorpora las notas ES/EN;
5. establece la prioridad;
6. valida la edición de Google Play;
7. confirma la edición;
8. solo después de esa confirmación envía el aviso de actualización si `notifyUpdate` es `true`.

Si Google Play falla antes de confirmar la edición, no se envía el aviso de nueva versión.

## Qué verá el usuario

La actualización se comunica de dos formas complementarias.

Primero, puede recibir una notificación de TifloAcosta indicando que hay una versión nueva.

Segundo, cuando abra la app o vuelva a ella, TifloAcosta consulta a Google Play. Si existe una actualización aplicable a ese usuario, aparece un diálogo accesible con un encabezado y botones claramente etiquetados.

Para una actualización normal:

- `Actualizar ahora`
- `Más tarde`

Para una actualización crítica de prioridad 5, el procedimiento inmediato puede omitir `Más tarde` si Google Play permite ese tipo de actualización.

El diálogo es independiente de la pantalla que estuviera usando la persona. No sustituye Novedades, Biblioteca, vídeos, lector ni otra sección de la app.

## Seguridad operativa

- Un commit normal no ejecuta el flujo de publicación.
- El flujo de publicación solo se inicia manualmente.
- La pista de destino procede de `request.json`.
- Producción exige confirmación adicional.
- Las claves no aparecen en los argumentos de Gradle ni en los artefactos.
- Una publicación fallida no debe enviar la notificación de actualización.
- La rama de trabajo y el PR pueden probarse completamente antes de fusionar nada en `main`.
