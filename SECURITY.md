# Seguridad en GitHub Pages

TifloAcosta App se publica como sitio estático en GitHub Pages. GitHub sirve el sitio mediante HTTPS, pero este repositorio no controla la configuración del servidor ni puede añadir cabeceras HTTP de respuesta.

Por ese motivo no se simulan con etiquetas `<meta>` cabeceras como `Content-Security-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Referrer-Policy` o `Strict-Transport-Security`: una etiqueta no ofrece una protección equivalente y varias de esas políticas solo funcionan como cabeceras HTTP.

Las medidas que sí aplica el código son:

- enlaces que abren pestañas nuevas con `rel="noopener noreferrer"`;
- recursos propios y servicios externos cargados mediante HTTPS;
- permisos de GitHub Actions limitados por workflow a lo necesario;
- permiso explícito del navegador antes de activar notificaciones.

## Pendiente de una decisión del propietario

Para gestionar cabeceras adicionales sería necesario situar delante de GitHub Pages un servicio que permita configurarlas o migrar el alojamiento. Eso cambia la infraestructura y debe decidirlo el propietario. No se ha configurado ni supuesto un dominio personalizado.
