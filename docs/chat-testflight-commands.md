# Órdenes de TestFlight desde ChatGPT

Incidencia exclusiva: https://github.com/TifloAcosta/tifloacosta-app/issues/345

El complemento de GitHub puede crear un comentario en esa incidencia, en nombre de la cuenta TifloAcosta. Solo se reconocen dos órdenes exactas:

- `/tiflo testflight dry-run feature/mi-musica` — valida la rama sin enviar nada a Apple.
- `/tiflo testflight run feature/mi-musica` — inicia el flujo `ios-native-testflight-upload.yml` en esa rama. **Solo tras autorización expresa de Tony.**

En esta primera fase únicamente está autorizada la rama `feature/mi-musica`. Otras ramas requieren revisión y una modificación explícita de la lista permitida. No se selecciona `main` por defecto.

Las órdenes emitidas por otra cuenta, en otra incidencia o con sintaxis inesperada se rechazan. El receptor usa el token efímero propio de GitHub Actions; no requiere claves nuevas de Apple. Una reacción 👀 del bot reclama la orden antes de enviarla y una reacción 🚀 confirma que se despachó. Si el despacho falla después de reclamar la orden, se necesita una nueva orden tras verificar que no se envió ninguna compilación. Una ejecución con fallo debe investigarse antes de reintentar; no se reenvía automáticamente.

El workflow receptor solo funciona cuando está incorporado a la rama predeterminada `main`. Hasta entonces no se procesa ninguna orden. Este mecanismo no publica versiones en App Store.
