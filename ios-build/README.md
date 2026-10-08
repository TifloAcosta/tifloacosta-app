# Preparación iOS de TifloAcosta

Este directorio prepara una **prueba técnica**, no una versión lista para App Store.

- Rama independiente: `preparacion-ios`. No modifica `main`.
- ID de paquete: `com.tifloacosta.app`.
- Desde este directorio: `npm install`, `npm run ios:add`.
- En GitHub Actions, el flujo `Verificar base iOS (sin publicar)` intenta compilar para el simulador, sin credenciales de firma.
- **No sube nada a App Store Connect.**

Pendiente antes de distribución:
1. Integración correcta de apertura/compartir documentos en iOS.
2. Pruebas reales de VoiceOver, foco, TTS, libros y marcadores.
3. Privacidad: la web incorpora OneSignal y servicios de terceros; revisar los datos realmente tratados en el binario iOS.
4. Configuración de iconos, permisos y firma Apple; generar archivo IPA con certificado de distribución.
5. Cumplimiento de la regla 4.2 de Apple: una envoltura web por sí sola no garantiza aceptación.

El empaquetado actual copia recursos web del repositorio. El código que presupone una URL web absoluta o funciones del navegador (service worker, notificaciones web, OAuth) puede necesitar adaptación a Capacitor.
