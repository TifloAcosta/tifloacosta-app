# Integraciones de almacenamiento: alcance acordado

## Objetivo de la actualización actual

Conectar Google Drive, Dropbox y OneDrive como **servicios globales de TifloAcosta**, disponibles mediante interfaces compartidas para cualquier sección actual o futura. Las cuentas, permisos y navegación en la nube no pertenecerán a Mi música. En esta actualización se conectará Mi música como primer consumidor sin retirar la importación existente desde Archivos ni modificar indebidamente otros módulos.

## Queda fuera de esta actualización

- Cine, series, audiodescripción y catálogos externos.
- Funcionalidades nuevas de lectura en TifloLector u otras pantallas: su incorporación funcional podrá hacerse después, pero la arquitectura global y sus interfaces para esas secciones son requisito de esta actualización.
- MEGA.
- Envíos a TestFlight y publicación en tiendas.

## Situación comprobada en código

- `ios-app-native/Sources/NativeMyMusic.swift` ya importa canciones y carpetas mediante el selector de Archivos de iOS, incluidas ubicaciones de proveedores disponibles en ese selector.
- `ios-app-native/Sources/NativeCloudStorage.swift` implementa lectura de metadatos y descarga de audio en los tres servicios, con límite de 250 MB. Recibe un token, pero no obtiene ni renueva autorizaciones.
- `ios-app-native/Sources/NativeYouTubeAccount.swift` tiene un flujo de autenticación de YouTube distinto y **no** debe reutilizar sus credenciales para Drive.
- `docs/CLOUD-PROVIDERS-REGISTRATION-2026-11-20.md` recoge el registro de proveedores. Desde el 20 de noviembre Google Cloud ya dispone de un cliente OAuth iOS y una cuenta de prueba, según la comprobación comunicada por el usuario; falta verificar el identificador completo y el esquema de retorno antes de activarlos en la app.

## Diseño elegido

- Un coordinador global de cuentas de almacenamiento, independiente de cualquier sección, que expone conexión, desconexión, estado, renovación de credenciales y sesión vigente por proveedor a toda TifloAcosta.
- Flujos OAuth del sistema con PKCE y permisos mínimos; credenciales de sesión guardadas en Keychain y nunca en preferencias, URL de registros o repositorio. Configuración pública de clientes separada por proveedor.
- Un explorador accesible de carpetas y archivos con paginación, cancelación, estado de carga y anuncios VoiceOver. Solo se importan archivos seleccionados; no sincronización masiva ni lectura indiscriminada.
- La pantalla Mi música ofrece «Conectar» y «Explorar» por proveedor y entrega los ficheros temporales descargados a su biblioteca actual, sin alterar la organización, listas, carpetas inteligentes ni reproductor.
- Un punto de acceso general a las cuentas y al explorador de nube estará disponible para los módulos presentes y futuros, sin duplicar autorizaciones. TifloLector, multimedia y cualquier función posterior podrán usar los mismos contratos sin reescribir la conexión; activar sus funciones específicas será trabajo separado.

## Restricciones de seguridad y producto

- Google Drive: empezar por permisos seleccionados mediante el mecanismo autorizado por Google; no solicitar acceso a todo Drive sin necesidad y sin revisión de requisitos de verificación.
- Dropbox: acceso limitado a ficheros permitidos con `files.metadata.read` y `files.content.read`; OAuth con PKCE.
- OneDrive: Microsoft Graph con permiso delegado `Files.Read`, registro de cliente público y flujo autorizado para iOS.
- Mantener una sola rama de trabajo: `feature/mi-musica`; no crear ramas adicionales ni publicar compilaciones.
- No activar botones de inicio de sesión que no tengan identificador y retorno OAuth efectivamente registrados.

## Criterios de aceptación

1. El usuario conecta y desconecta cada proveedor desde una gestión global, sin introducir contraseñas en TifloAcosta ni repetir la autorización para cada sección.
2. La navegación y selección de archivos están expuestas como servicios generales, con filtros de formatos definidos por cada sección; Mi música puede elegir audio compatible e importarlo con nombre correcto.
3. Puede seguir usando importaciones existentes sin iniciar sesión en estos servicios.
4. Cancelación, expiración de tokens, falta de red, permisos revocados, carpetas vacías y archivos demasiado grandes producen mensajes accesibles.
5. No se exponen tokens ni secretos en GitHub, logs o respaldos.
6. Pruebas automatizadas y compilación iOS verificadas antes de considerar el código listo; prueba de cuentas reales después, sin envío a TestFlight hasta autorización explícita.

## Dependencias externas pendientes

- Google: confirmar ID completo del cliente iOS y esquema de retorno configurado; completar los permisos necesarios para la selección de archivos.
- Dropbox: registrar aplicación y obtener ID público de cliente y redirección.
- Microsoft: registrar aplicación y obtener ID público de cliente y redirección.

Estas dependencias no impiden mantener y verificar la capa compartida de lectura de archivos, pero sí impiden declarar terminada la autenticación real.
