# Compilaciones y actualizaciones Android de TifloAcosta

## Objetivo

El flujo `Create TifloAcosta Android Release` prepara una nueva versión Android con el mínimo trabajo manual posible. Está diseñado para que el resultado pueda revisarse de forma cómoda con lector de pantalla.

El workflow es manual. Una modificación normal del repositorio no publica una versión en Google Play.

## Funcionamiento habitual

La intención de la próxima versión se guarda en:

`mobile/release/request.json`

Ahí se indica:

- versión visible;
- pista de Google Play;
- estado de la publicación;
- prioridad de actualización;
- si se enviará un aviso de nueva versión;
- notas en español e inglés.

La compilación calcula el `versionCode`, ejecuta las pruebas, sincroniza Android, firma el AAB, verifica la firma y las notificaciones, genera el APK de prueba y prepara un ZIP con nombres claros.

El ZIP contiene:

- AAB firmado;
- APK de prueba;
- `INFORMACION-COMPILACION.txt`;
- `notas-google-play.txt`.

GitHub Actions muestra además un resumen breve en vez de obligar a revisar todo el registro técnico.

## Seguridad de publicación

Al ejecutar el workflow aparece el control `publish`.

- `publish = false`: compila y verifica, pero no sube nada a Google Play.
- `publish = true`: permite publicar únicamente después de superar pruebas, compilación y firma.

El valor predeterminado es `false`.

Además, una solicitud destinada a Producción necesita una confirmación explícita en el archivo de versión. Una beta no puede convertirse en una publicación de Producción solo por cambiar accidentalmente el nombre de la pista.

## Configuración única necesaria

La clave de firma Android ya utiliza estos secretos del repositorio:

- `TIFLOACOSTA_KEYSTORE_BASE64`
- `TIFLOACOSTA_KEYSTORE_PASSWORD`

Para automatizar Google Play hay que añadir una sola vez:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Debe contener el JSON completo de una cuenta de servicio autorizada para la aplicación `com.tifloacosta.app` en Google Play Console, con los permisos mínimos necesarios para administrar versiones.

Para que el flujo envíe automáticamente el aviso de nueva versión hay que añadir una sola vez:

- `ONESIGNAL_REST_API_KEY`

El App ID de OneSignal de TifloAcosta ya está configurado en el workflow.

Ninguno de estos valores se escribe en el repositorio, en el TXT de compilación ni en los artefactos descargables.

## Numeración

En una compilación sin publicación el sistema toma como referencia el último código registrado localmente.

Cuando `publish = true`, consulta Google Play y compara:

- códigos de bundles conocidos;
- códigos presentes en las pistas;
- último código registrado localmente.

Utiliza siempre un código superior al mayor encontrado.

## Avisos de actualización

Después de que Google Play acepte una nueva versión, el proceso puede enviar una notificación OneSignal únicamente a las suscripciones identificadas como app Android.

El aviso contiene el número de versión y abre TifloAcosta. Al iniciar o reanudar la app, Android consulta Google Play y, si existe una actualización aplicable, muestra un diálogo nativo accesible con TalkBack.

Para una actualización normal aparecen:

- `Actualizar ahora`;
- `Más tarde`.

La actualización flexible permite continuar utilizando la app mientras se descarga. Cuando la descarga termina, aparece el aviso para completar la instalación.

La prioridad 5 queda reservada para actualizaciones realmente críticas y puede usar el flujo inmediato cuando Google Play lo permita.

## Novedades y contenido

La compilación Android siempre parte del código actual de la rama desde la que se ejecuta. Por tanto, una nueva versión incorpora automáticamente las mejoras ya integradas en la app —incluidas las mejoras actuales de Novedades y vídeos— sin tener que añadirlas nuevamente a mano.
