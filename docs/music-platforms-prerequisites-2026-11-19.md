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
| Radio Browser | No se indica cuenta de desarrollador | Buscar emisoras y verificar `url_resolved`, formatos compatibles y disponibilidad de la transmisión | Listo para prototipo de lectura pública; comprobar condiciones de cada emisora y tratamiento de errores |
| Jamendo | Registrar aplicación y obtener `client_id` | Consultas `/v3.0/tracks`; distinguir `audio` y `audiodownload_allowed`; atribución/licencia | Pendiente de registro y verificación del encaje en plan no comercial |
| Audius | Comprobar método de acceso vigente | API oficial de búsqueda, pistas, listas y streaming | Pendiente de validación de accesos y restricciones de reproducción |
| SoundCloud | Registrar aplicación, credenciales y condiciones | OAuth/Client Credentials según recursos; pistas públicas por API o widget; sin descarga persistente | Pendiente de registro y aprobación de uso conforme a términos |
| Apple Music | Activar MusicKit en el App ID `com.tifloacosta.app` | MusicKit para Swift; autorización y comprobación de capacidades/suscripción del oyente | Pendiente de habilitación en Apple Developer; no crear clave manual si basta generación automática |
| Spotify | Registrar aplicación y callback en Developer Dashboard | SDK App Remote, `client_id`, URL de retorno y autorización del oyente; Spotify Premium para música a demanda | Pendiente de registro y comprobación de permisos; no incrustar `client_secret` en iOS |

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
