# TifloAcosta Android Closed-Test Follow-up Plan

Fecha: 17 de septiembre de 2026

Este documento complementa, no sustituye, el plan técnico principal:

- `docs/superpowers/specs/2026-09-13-tifloacosta-mobile-apps-design.md`
- `docs/superpowers/plans/2026-09-13-mobile-foundation.md`

La arquitectura queda fijada por esos documentos: una aplicación móvil propia dentro de `mobile/`, basada en Capacitor, con interfaz accesible local y contenido cambiante obtenido desde `https://tifloacosta.com/mobile-content.json`. No se empaqueta toda la web ni se copian los cientos de documentos de Biblioteca dentro de la aplicación.

## Objetivo de esta fase

Completar primero Android hasta disponer de una versión apta para prueba cerrada con los 40 voluntarios, sin bloquear el desarrollo posterior de iOS.

Identidad oficial:

- Nombre: TifloAcosta.
- Identificador Android/iOS: `com.tifloacosta.app`.
- Capacitor: rama estable 8; versiones fijadas en `mobile/package.json`.

## Situación inicial de esta fase

- [x] Crear rama aislada `feature/mobile-capacitor-foundation`.
- [x] Añadir generador de `mobile-content.json` para Biblioteca y Vídeos.
- [x] Añadir generación del feed al despliegue de GitHub Pages.
- [x] Crear `mobile/package.json` y `mobile/capacitor.config.json`.
- [x] Crear la carcasa HTML accesible mínima.
- [x] Proteger por `.gitignore` dependencias, compilaciones y material de firma.
- [x] Añadir pruebas automáticas de identidad, accesibilidad básica y seguridad del bootstrap.
- [ ] Generar y compilar el proyecto Android nativo en GitHub Actions.

## Orden de trabajo restante

1. Continuar el plan de fundación del 13 de septiembre: navegación y foco, caché de última versión válida, Inicio bilingüe compacto, Biblioteca, Vídeos, Actualidad, Buscar, Favoritos, Libro, Podcast, Contacto y Configuración.
2. Incorporar funciones nativas necesarias para la beta: Atrás, compartir, guardar/descargar, enlaces externos y preparación para notificaciones/enlaces profundos.
3. Ejecutar la auditoría de accesibilidad y las pruebas de regresión completas.
4. Generar iconos/splash nativos a partir de la identidad actual de TifloAcosta.
5. Configurar versión Android y revisar permisos; no pedir ubicación, cámara, micrófono, contactos ni almacenamiento amplio en la primera versión.
6. Crear una clave de subida Android fuera del repositorio y configurar firma segura. Este es el primer punto en el que puede ser necesaria la intervención de Tony.
7. Generar el AAB firmado para Google Play.
8. Crear/configurar la prueba cerrada en Play Console y añadir a los 40 voluntarios.
9. Entregar a los testers una lista breve de pruebas, con especial atención a TalkBack, otros lectores Android, navegación de regreso, búsqueda, documentos, vídeos, favoritos, compartir, descargar y notificaciones.
10. Mantener al menos el mínimo exigido por Google inscrito de forma continua durante el periodo obligatorio, utilizando los 40 voluntarios para disponer de margen y obtener pruebas reales en distintos dispositivos.

## Reglas de seguridad

- Nunca se suben al repositorio keystores, contraseñas, certificados ni claves privadas.
- La compilación sin firma puede automatizarse; la firma para Play se añade después mediante un mecanismo seguro.
- La web pública actual continúa funcionando de forma independiente mientras se desarrolla la app oficial.
- Ningún cambio móvil se fusiona a `main` si rompe las pruebas de la web actual.
