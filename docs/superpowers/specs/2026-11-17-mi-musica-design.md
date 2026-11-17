# Mi Música — diseño aprobado

## Propósito

Nueva sección independiente de TifloAcosta para administrar y reproducir la música personal en iOS y Android, con prioridad absoluta a VoiceOver y TalkBack. No es un servicio de distribución musical ni utiliza contenidos de Spotify.

## Decisiones de Tony

- Nombre visible: **Mi Música**.
- Arquitectura preparada desde el inicio para fuentes locales y remotas; desarrollo y verificación técnica por fases, pero primera compilación para pruebas en teléfono solo después de completar el conjunto.
- El usuario elige expresamente qué archivos y carpetas incorpora. No se escanean cuentas completas sin selección.
- Conservar jerarquías originales y permitir carpetas y listas propias, incluidas reglas inteligentes.
- Biblioteca combinada: dispositivo, Google Drive, Dropbox, OneDrive y MEGA, sujetos a autorizaciones y capacidades de sus APIs.
- Listas con referencias a canciones de cualquier fuente, sin duplicar ni eliminar archivos originales.
- Reproductor accesible con cola, navegación, aleatorio, repetición, reproducción en segundo plano y temporizador.
- Ecualización accesible con perfiles general, álbum, lista y canción; independiente de TifloLector.
- Respaldo manual y periódico; destino predeterminado modificable; exportación y restauración; no guardar credenciales en copias.
- Ningún envío a TestFlight, Play Store o público sin autorización expresa.

## Modelo de datos y límites

Separar `Track` (identidad estable y metadatos), `Location` (uno o más archivos de origen por canción), `Folder` (organización virtual), `Playlist` (orden de referencias), `SmartRule`, `PlaybackSettings` y `BackupManifest`. La identidad nunca será una ruta mutable; la disponibilidad se determina por fuente. Eliminar de la biblioteca no elimina el original. El borrado de originales requiere flujo diferenciado y confirmación.

Las fuentes remotas usarán adaptadores aislados con permisos mínimos y selección explícita de carpetas. La primera conexión no equivale a autorizar un escaneo completo. El reproductor distinguirá errores de autenticación, conectividad, permisos y archivo inexistente. La caché sin conexión es opcional y estará limitada por espacio definido por el usuario.

## Accesibilidad y seguridad

- Controles nativos etiquetados, estado seleccionado anunciado antes del título, acciones accesibles para reordenar sin arrastrar, mensajes de progreso/error y foco estable.
- Los cambios destructivos serán confirmados; habrá deshacer en operaciones internas cuando sea posible.
- Sin contraseñas ni tokens en exportaciones, registros o archivos compartidos.
- Las copias solo de catálogo no contienen audio; la restauración reconecta fuentes y señala canciones inaccesibles.
- Copias periódicas sujetas a programación de segundo plano del sistema, sin prometer hora exacta.

## Enfoques considerados

1. Biblioteca local y añadir nube después: arranque simple, pero arriesga reconstrucción de identificadores y listas.
2. Arquitectura unificada desde el principio, implementada por fases: **elegida** por Tony; exige un contrato de adaptadores más cuidadoso pero evita migraciones costosas.

## Entregables

Núcleo compartido y pruebas; biblioteca e importación locales nativas; listas y reglas; reproductores accesibles iOS/Android; ecualización; conectores remotos aprobados; respaldo y restauración; auditoría automatizada y documentación de limitaciones. Las pruebas en teléfono se posponen hasta que esté integrado el conjunto. No se compromete aprobación de proveedores ni equivalencia de funciones restringidas en ambos sistemas.
