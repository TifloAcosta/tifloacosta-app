# Fuentes de nube compartidas — diseño de ampliación aprobado

## Propósito

Conectar archivos elegidos expresamente por cada usuario en Google Drive, Dropbox y OneDrive. La capa de acceso se comparte entre Mi música, TifloLector y futuras funciones de TifloAcosta; una sección nunca obtiene automáticamente autorización concedida para otra finalidad.

## Decisiones

- Se mantiene la arquitectura de adaptadores independientes aprobada en el diseño de Mi música del 17/11.
- MEGA queda excluida de esta entrega; se reconsiderará si la solicita la comunidad.
- Ninguna nube se escanea íntegramente sin una selección expresa. Importar no borra ni altera el origen.
- La pantalla de Archivos de iOS sigue disponible mientras se configuran y validan las autorizaciones directas.
- Credenciales de desarrollador públicas (identificadores de cliente) se separan de tokens de usuarios, que solo podrán guardarse en Keychain. Ningún secreto de cliente se incluye en el ejecutable.

## Arquitectura

- `NativeCloudStorage.swift`: contrato compartido de proveedor, listado por carpeta, paginación, descarga segura y errores tipificados; se le inyecta un token de acceso válido sin persistirlo.
- Autorización OAuth con PKCE: componente separado por proveedor, dependiente de identificadores registrados y callbacks válidos. Ningún botón se anunciará como conectado antes de completar este requisito.
- `NativeMyMusic.swift`: el usuario decide qué canción importar; descarga a staging y usa el flujo local existente para registrar el audio. Más adelante la biblioteca puede conservar una ubicación remota explícita, con permiso revocable.
- Otros consumidores reutilizan el contrato, pero deciden sus tipos de documento, límites y ubicación final.

## Seguridad y restricciones

- Solo HTTPS y hosts oficiales por proveedor; nunca aceptar una URL arbitraria del servidor para descargar con cabecera Authorization.
- Lista de archivos limitada y paginada; los nombres externos son datos, no rutas locales.
- Solo formatos autorizados por cada módulo; los errores de sesión, falta de permiso, conexión y archivo ausente se distinguen.
- No prometer reproducción en streaming, sincronización automática, funcionamiento fuera de línea ni acceso a toda la cuenta.
- La conexión final requiere configurar aplicaciones de desarrollador y validar OAuth en un iPhone real. La ausencia de esta configuración impide declarar terminada la integración directa.

## Enfoques considerados

1. Utilizar únicamente Files de iOS: menor configuración, pero no crea conexiones propias reutilizables.
2. API independiente dentro de cada sección: duplicaría autorizaciones y lógica.
3. **Capa de adaptadores compartida**, escogida por Tony para beneficiar funciones futuras de TifloAcosta; exige registro y comprobación por proveedor.
