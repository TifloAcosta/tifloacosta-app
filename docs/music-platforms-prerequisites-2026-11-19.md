# Mi Música: requisitos para integrar plataformas

Estado: preparación de la siguiente beta privada. No habilitar proveedores sin integración funcional, no iniciar suscripciones y no modificar la versión pública.

## Condiciones comunes

- Mostrar primero el contenido propio; las plataformas externas se acceden por un único botón «Plataformas musicales».
- Mantener controles accesibles de reproducir, pausar y navegar, diferenciando pistas bajo demanda de radios continuas.
- No exigir registro personal al oyente si el proveedor permite reproducción pública anónima.
- No almacenar música de terceros salvo permiso expreso del proveedor y del titular de derechos.
- Guardar secretos de servidor fuera del código y del paquete iOS; no inventar ni pedir claves API individuales a los usuarios.
- Solicitar autorizaciones del usuario final con el mecanismo oficial del proveedor cuando sean necesarias.
- Comprobar antes de publicar términos, límites de uso, atribución, disponibilidad y capacidad de reproducción en segundo plano.

## Orden de preintegración

| Servicio | Registro previo | Requisito técnico | Estado y siguiente paso |
| --- | --- | --- | --- |
| Radio Browser | No se indica cuenta de desarrollador | Buscar emisoras y verificar `url_resolved`, formatos compatibles y disponibilidad de la transmisión | Prototipo integrado en la rama privada; pendiente prueba real de emisoras y condiciones particulares |
| Jamendo | Registrar aplicación y obtener `client_id` propio | Consultas `/v3.0/tracks`; distinguir `audio` y `audiodownload_allowed`; atribución/licencia | La API admite consultas de solo lectura con `client_id` de aplicación; el identificador público de demostración de la documentación es **solo para pruebas**, nunca para distribuir la app. Registro y aceptación de condiciones pendientes |
| Audius | La API REST dispone de acceso de solo lectura; verificar requisitos vigentes antes del lanzamiento | API oficial de búsqueda, pistas, listas y streaming | Prototipo de búsqueda y reproducción integrado en rama privada. No se afirma todavía validación en iPhone ni disponibilidad continua del servicio |
| SoundCloud | Registrar aplicación, credenciales y condiciones | OAuth/Client Credentials según recursos; pistas públicas por API o widget; sin descarga persistente | Pendiente de registro y aprobación de uso conforme a términos |
| Apple Music | Activar MusicKit en el App ID `com.tifloacosta.app` | MusicKit para Swift; autorización y comprobación de capacidades/suscripción del oyente | Pendiente de habilitación en Apple Developer; no crear clave manual si basta generación automática |
| Spotify | Registrar aplicación y callback en Developer Dashboard | SDK autorizado, `client_id`, URL de retorno y autorización del oyente. El SDK de reproducción web exige Spotify Premium | **No habilitar aún**: el modo de desarrollo tiene límites y las solicitudes de cuota ampliada se reservan actualmente a organizaciones, según la documentación oficial. Antes de ofrecerlo al público hay que confirmar elegibilidad y aprobación; no incrustar `client_secret` en iOS |

## Decisiones verificadas el 19 de noviembre de 2026

1. Audius y las radios son los primeros servicios gratuitos integrados como prototipos. Que aparezcan en el código no demuestra todavía su funcionamiento en un iPhone ni la aceptación de todos los términos de reproducción.
2. Jamendo **no** se debe mostrar como operativo usando el identificador de demostración de su documentación. Un responsable de TifloAcosta debe registrar una aplicación y aceptar sus condiciones antes de distribuir la integración.
3. SoundCloud requiere comprobar el alta y las condiciones del acceso API de nuestra aplicación. No se debe simular integración mediante enlaces de audio no autorizados.
4. Spotify no es un servicio gratuito de reproducción a demanda integrado sin condiciones: cuenta, autorización y modalidad compatible del oyente, más elegibilidad de la aplicación. Su presencia en el plan no equivale a aprobación del proveedor.
5. Apple Music dispone de código MusicKit en la rama privada, oculto mientras no se habilite el servicio en el App ID de TifloAcosta. El catálogo requiere autorización del oyente y suscripción compatible; las pistas locales importadas son independientes.
6. Próxima acción técnica permitida sin credenciales: verificar accesibilidad, errores de red, compatibilidad de formatos y convivencia del audio de los prototipos existentes. Los registros externos y sus aceptaciones contractuales quedan diferenciados para no bloquear el resto de Mi Música.

## Bloqueos que no se deben sortear automáticamente

1. Aceptaciones contractuales, declaraciones de uso comercial o verificaciones de identidad que correspondan al titular.
2. Solicitudes de datos personales o de pago para crear cuentas externas.
3. Servicios cuyo acceso no autorice reproducción dentro de TifloAcosta.

## Referencias oficiales

- Radio Browser: https://docs.radio-browser.info/
- Jamendo API: https://developer.jamendo.com/v3.0/tracks y https://developer.jamendo.com/v3.0/authentication
- Audius: https://docs.audius.org/developers/introduction/overview/
- SoundCloud: https://developers.soundcloud.com/docs/api/guide y https://developers.soundcloud.com/docs/api/terms-of-use
- Apple: https://developer.apple.com/documentation/musickit/using-automatic-token-generation-for-apple-music-api
- Spotify: https://developer.spotify.com/documentation/ios/getting-started
