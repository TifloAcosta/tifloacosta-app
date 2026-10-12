# Auditoría y actualización iOS — fase de estabilización previa a TifloLector

Fecha: 9 de octubre de 2026. Rama: `preparacion-ios`. Objetivo: una compilación **interna** de TestFlight más coherente con Android y la web; **no** publicar en App Store ni modificar `main`.

## Alcance acordado
PRIMERA FASE: Inicio, navegación VoiceOver, accesibilidad visual, idioma, Novedades, Recursos, Descargas por enlace, Vídeos/YouTube accesible, Podcast, Contacto, privacidad y Configuración.
SEGUNDA FASE (aplazada expresamente): auditoría profunda de TifloLector (importación PDF/OCR, síntesis de voz, biblioteca, marcadores, nubes, navegación por frases y párrafos). No confundir los fallos PDF Android con una corrección verificada en iOS.

## Matriz de incidencias y aceptación
| Prioridad | Área | Hallazgo/expectativa | Estado a 09-10-2026 | Criterio para cerrar |
|---|---|---|---|---|
| P0 | VoiceOver/foco | Tras entrar a secciones, el foco salta al final, VoiceOver reproduce sonido y anuncia “business context menu”; volver al principio | Se modificó foco en `index.html`, **sin prueba real**; falta estudiar navegación de páginas HTML independientes | Entrar y salir de Inicio, Recursos, Novedades, Vídeos, Podcast, Contacto, Configuración con foco inicial y botón Volver coherentes |
| P0 | Vídeos | Solo aparece orden más reciente/antiguo, sin catálogo | `videos.json` empaquetado y código de carga existen; **causa no comprobada** | Primeros 10 vídeos con títulos/controles; siguiente/anterior; estado de error y reintento |
| P0 | YouTube accesible | No aparece el buscador ni el reproductor esperado | Existe HTML y JS en `videos.html`; **falta depuración iPhone** | Buscador accesible, resultados en orden, reproducción/pause/avance/retroceso |
| P0 | Descargas enlace | Link Google Drive sin archivos reconocidos, sin pegado automático o botón equivalente | Web e implementación móvil distintas; servicio `download.tifloacosta.com/analyze` | Pegar previa autorización iOS, analizar enlace compartido de Google Drive público y guardar en Archivos; mensajes de error |
| P1 | Novedades | Primeros tres recursos antiguos | iOS usa `data.js` empaquetado; Android usa `mobile-content.json` remoto | Contenido renovable sin nueva IPA, orden verificable y copia local, idioma correcto |
| P1 | Idioma | Español/English repetidos en cabeceras y visibles tras primer inicio | Ocultación empaquetada y selector inyectado en Configuración en `prepare-web.mjs`; **sin prueba** | Elegir idioma una vez, recordar, cambiar solo en Configuración; navegación y textos se traducen |
| P1 | Configuración | Instalación PWA, actualización web, versión 2.1 y notificaciones deshabilitadas | Elementos web ocultados en empaquetado de iOS; **notificaciones nativas pendientes** | Solo controles útiles, versión y build reales, sin botones inertes |
| P1 | Navegación | Enlaces “Volver” duplicados al principio/final y control “Business” | Algunos enlaces duplicados en HTML; no confundir el control nativo con enlaces web | Acceso a volver sin búsqueda larga; idioma y etiqueta adecuados |
| P1 | Podcast | Centenares de episodios antes de plataformas externas | Paginación de 10 y plataformas antes de episodios implementados en la rama | Episodios 1–10, siguiente/anterior, foco y servicios disponibles |
| P2 | Presentación | Color/contraste, tamaño de controles y separación desigual Android/web | Revisión del CSS existente; **sin validación visual/dispositivo** | Verificar contraste claro/oscuro, objetivos táctiles, orden de rotor, textos largos |
| P2 | Pie | “TifloAcosta App · Versión 2.1” y política al final | Pie web ocultado para iOS, conservando Privacidad y accesibilidad | No repetir pie; política accesible en apartado correspondiente |

## Arquitectura y riesgos
- `ios-build/prepare-web.mjs` empaqueta **páginas web**, mientras Android usa `mobile/src`. Esta divergencia explica por qué prestaciones Android no llegan automáticamente a iOS.
- Las correcciones a `mobile/src` **no** son suficientes para actualizar la app iOS actual. Toda solución debe pasar por `ios-build/www` durante su empaquetado o compartir explícitamente la lógica.
- Las páginas `videos.html`, `podcast.html` y `actualidad.html` también tienen cabeceras, navegación y estilos propios. Validarlas individualmente, no solo `index.html`.
- `podcast.js` y `podcast.html` contienen una primera implementación de paginación (10 por página), aún sin validación instrumentada.
- Las capas de idioma y ocultación están inyectadas desde `prepare-web.mjs`. Comprobar que no provoquen parpadeos, fallos de primer inicio o controles inaccesibles.
- Evitar sobreescribir los cambios actuales de `preparacion-ios` con el contenido de `main` sin revisar diferencias.
- La firma iOS y perfil de distribución existente se reutilizan por GitHub Actions; **no** volver a generar certificados por defecto.
- El workflow `ios-testflight.yml` ahora declara un número de build por ejecución. Verificar que el número calculado supere el del último envío aceptado por Apple.

## Puertas antes de distribuir nueva beta
1. Ejecutar/validar sintaxis de JS y scripts de empaquetado y pruebas de navegación, idiomas, Podcast, actualización de contenidos, vídeos y descargas; corregir errores.
2. Crear una compilación de validación (sin distribuir públicamente); revisar registro de errores web/CSP y presencia de archivos empaquetados.
3. Verificar versión/build único y firma existente. No enviar si fallan pruebas principales.
4. Enviar solo a TestFlight interno y comprobar allí en iPhone real con VoiceOver; verificar cada criterio.
5. Si alguna función P0 falla, conservar incidencia abierta y no calificar la beta como estabilizada.
6. **Después** de aprobar la estabilización general, iniciar la auditoría profunda de TifloLector.

## Historial de preparación en la rama
- `3538a59`: intento de llevar foco al encabezado al entrar a secciones de Inicio (parcial).
- `0ceb1af`: plataformas de Podcast antes de los episodios.
- `adbe2bc`: paginación Podcast 10 por página.
- `cf4ec25`: ocultación de elementos PWA en iOS y selector de idioma en Configuración.
- `decf730`: número de compilación de TestFlight generado por ejecución.

## Regla de privacidad y publicación
Las pruebas se hacen en la rama aislada `preparacion-ios` y TestFlight interno. No fusionar a `main` ni publicar App Store sin decisión posterior del titular. Mantener política de privacidad accesible y no declarar como operativas notificaciones o descargas sin pruebas.
