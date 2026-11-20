# Registro de proveedores de nube para TifloAcosta

Estado: capa REST compartida preparada para Google Drive, Dropbox y OneDrive; **la conexión de cuentas de usuarios NO está habilitada**. No mostrar botones que aparenten iniciar sesión sin completar los registros y las pruebas OAuth.

## Google Drive

- Proyecto creado y verificado: [TifloAcosta Archivos](https://console.cloud.google.com/apis/dashboard?project=tifloacosta-archivos). Google Drive API y Google Picker API figuran habilitadas.
- El [formulario de consentimiento](https://console.cloud.google.com/auth/overview/create?project=tifloacosta-archivos) quedó preparado con la marca TifloAcosta, el correo de la cuenta del propietario como contacto y público externo en modo de prueba. El titular debe marcar «Acepto la Política de Datos del Usuario de los Servicios de las APIs de Google», pulsar «Continuar» y después «Crear».
- Después de guardar el consentimiento, registrar un cliente OAuth de iOS para `com.tifloacosta.app` y configurar el esquema de retorno que indique Google. Implementar el flujo de [Google Picker para móviles](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker) con `drive.file`. El adaptador ya permite consultar por ID los metadatos del archivo elegido y pasa el resultado a la descarga existente. La pantalla de selección y la sesión OAuth siguen pendientes.
- Verificar con un audio preexistente elegido en Picker. La selección de una carpeta requiere comprobar por separado si Google concede acceso a los archivos que contiene.

## Dropbox

- [Dropbox App Console](https://www.dropbox.com/developers/apps) mostró «Inicia sesión o regístrate de forma gratuita». El titular debe iniciar sesión con la cuenta que administrará la integración. El registro de la app queda pendiente de acceso.
- Registrar la aplicación con `files.metadata.read` y `files.content.read` y la redirección del cliente iOS. Implementar OAuth 2.0 Authorization Code + PKCE con el identificador público. El adaptador existente lista carpetas, pagina los resultados y descarga el archivo seleccionado.

## OneDrive

- [Microsoft Entra](https://entra.microsoft.com/) mostró «Iniciar sesión» para Microsoft Azure. El titular debe iniciar sesión con una cuenta que pueda registrar aplicaciones en el directorio de Entra. El registro de la app queda pendiente de acceso.
- Registrar TifloAcosta como cliente móvil/público con el identificador de iOS `com.tifloacosta.app`, la redirección asignada y permiso delegado de Microsoft Graph `Files.Read`. Implementar la sesión MSAL/PKCE. El adaptador existente lista los elementos y descarga el archivo seleccionado. La redirección HTTPS se admite en solicitudes de contenido y descarta la cabecera de autorización.

## Integración común y pruebas pendientes

- El código `NativeCloudStorage.swift` no almacena tokens, no escanea cuentas por sí solo y no concede acceso a ningún módulo. Es transporte HTTP compartido, no una conexión autenticada terminada.
- Implementar sesiones independientes en Keychain, desconectar/revocar, estado y mensajes de VoiceOver, selector accesible, importación de archivos elegidos y reconexión de referencias.
- Registrar los identificadores públicos de cliente sin contraseñas en el repositorio; secretos y tokens fuera del código, respaldos y registros.
- Probar cada proveedor en un iPhone, con cuentas personales y empresariales cuando proceda, cancelación de consentimiento, token caducado, carpeta vacía, permisos revocados, red desconectada, archivos grandes y redirecciones.
- MEGA se excluye de esta entrega.

Fuentes oficiales: Google Drive API (files.list, files.get y guía de permisos), Dropbox OAuth Guide y API v2, Microsoft Graph OneDrive y plataforma de identidad Microsoft.
