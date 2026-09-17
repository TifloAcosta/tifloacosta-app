# Corrección de Actualidad en iPhone

Esta corrección reduce el trabajo inicial de `actualidad.html` en Safari/WebKit y VoiceOver:

- La portada de Actualidad no descarga Noticias, Apps ni Multimedia hasta que el usuario abre cada sección.
- Noticias y Apps cargan sus catálogos por demanda.
- Multimedia carga su catálogo solo al abrir Escuchar y ver o una de sus subsecciones.
- Los vídeos no crean un `iframe` ni asignan su URL hasta que el usuario pulsa Reproducir; al cerrar, el reproductor se elimina.
- Las versiones de los scripts y la caché PWA se renuevan para evitar que iOS siga sirviendo los archivos anteriores.

La corrección incluye pruebas de regresión específicas para la carga inicial y la creación diferida de reproductores.