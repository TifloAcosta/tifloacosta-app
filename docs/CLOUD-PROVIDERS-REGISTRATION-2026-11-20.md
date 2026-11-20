# Registro de proveedores de nube para TifloAcosta

Estado: capa REST compartida preparada para Google Drive, Dropbox y OneDrive; **la conexión de cuentas de usuarios NO está habilitada**. No mostrar botones que aparenten iniciar sesión sin completar los registros y las pruebas OAuth.

## Google Drive

1. Crear o reutilizar un proyecto de Google Cloud propiedad de TifloAcosta. Habilitar Drive API.
2. Configurar pantalla de consentimiento OAuth y cliente iOS de `com.tifloacosta.app`; añadir el esquema de URL inverso que Google indique.
3. Preferir acceso limitado a archivos elegidos por la persona (`drive.file` + selector compatible) y confirmar si ese acceso cubre los archivos preexistentes requeridos. El alcance `drive.readonly` es restringido y puede exigir verificación adicional de Google; no solicitarlo sin tramitarla.
4. Integrar Google Sign-In para iOS, comprobación/renovación de tokens y selección explícita de archivos y carpetas.

## Dropbox

1. Registrar una aplicación Dropbox con permisos mínimos `files.metadata.read` y `files.content.read`, y configurar el esquema de redirección autorizado.
2. Utilizar OAuth 2.0 Authorization Code + PKCE, con tokens de acceso de corta duración y renovación cuando la cuenta lo permita.
3. Elegir carpeta/archivos de forma explícita, paginar `files/list_folder` y utilizar `files/download` solo para archivos seleccionados.

## OneDrive

1. Registrar TifloAcosta como aplicación móvil/pública en Microsoft Entra y configurar su redirección.
2. Autorizar con MSAL/PKCE, con consentimiento delegado limitado (`Files.Read` y los permisos de inicio de sesión requeridos); no utilizar permisos de aplicación ni credenciales de cliente incrustadas.
3. Navegar por elementos de `me/drive` de Microsoft Graph, paginar y descargar solamente lo seleccionado. La respuesta `/content` puede redirigir a una dirección HTTPS preautorizada; no reenviar el token del usuario al destino.

## Integración común y pruebas pendientes

- El código `NativeCloudStorage.swift` no almacena tokens, no escanea cuentas por sí solo y no concede acceso a ningún módulo. Es transporte HTTP compartido, no una conexión autenticada terminada.
- Implementar sesiones independientes en Keychain, desconectar/revocar, estado y mensajes de VoiceOver, selector accesible, importación de archivos elegidos y reconexión de referencias.
- Registrar los identificadores públicos de cliente sin contraseñas en el repositorio; secretos y tokens fuera del código, respaldos y registros.
- Probar cada proveedor en un iPhone, con cuentas personales y empresariales cuando proceda, cancelación de consentimiento, token caducado, carpeta vacía, permisos revocados, red desconectada, archivos grandes y redirecciones.
- MEGA se excluye de esta entrega.

Fuentes oficiales: Google Drive API (files.list, files.get y guía de permisos), Dropbox OAuth Guide y API v2, Microsoft Graph OneDrive y plataforma de identidad Microsoft.
