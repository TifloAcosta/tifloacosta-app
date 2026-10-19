# Sistema visual común de TifloAcosta para iOS (19 de octubre de 2026)

## Alcance
Esta especificación define una única identidad para Inicio, Recursos, TifloLector, Actualidad, Novedades, Vídeos, Podcast, Descargas, Recibidos, búsqueda y pantallas interiores nativas. Recursos es la pantalla piloto: los cambios NO pueden convertirse en estilos aislados por sección.

La marca debe reconocerse en tifloacosta.com, Android e iOS, pero las interacciones y componentes continúan siendo **nativos de cada plataforma**. No se importa maquetación HTML a iOS.

## Origen de la identidad, no colores nuevos
La paleta viene de `styles.css`, `mobile/src/styles.css` y de la especificación Android del 29-09-2026.

- Rojo principal: `#A61B1B`. Identifica la marca, el encabezado corporativo, énfasis y los botones con fondo rojo y texto blanco.
- Rojo profundo: `#7F1414`. Cabecera/áreas con marca (texto blanco).
- Modo claro: fondo `#FFFFFF`, superficie `#FFFFFF`, superficie alternativa `#FFF4F4`, texto `#111111`, secundario `#4A3A3A`, borde `#D9B8B8`.
- Modo oscuro: fondo `#0B0B0B`, superficie `#151010`, alternativa `#201414`, texto `#FFFFFF`, secundario `#D7CACA`, borde `#806969`.
- Rojo de **lectura sobre fondo oscuro**: `#FF9D9D`, uso semántico solo para texto/iconos interactivos sin fondo rojo. No sustituye el rojo oficial del logotipo o las cabeceras.
- Botones secundarios: superficie alternativa + texto principal de alto contraste + borde. Nunca letras en rojo oscuro sobre relleno granate.
- Indicadores de foco del sistema: conservados; no dibujar bordes decorativos que se confundan con foco de VoiceOver.

## Componentes que se comparten
`ios-app-native/Sources/TifloVisual.swift` es la única fuente de colores y tamaños visuales nativos. Se aplican desde la entrada de la app y a las distintas pantallas, sin copiar valores hexadecimales ni crear paletas locales.

1. Fondo y superficie: mismo tono de fondo en todas las secciones; tarjetas y grupos conservan separación.
2. Encabezados: títulos de sección legibles, compactos y consistentes; en Inicio la cabecera incluye marca; dentro, botón Volver y título nativos de iOS.
3. Filtros y selectores ajustables: etiqueta secundaria, valor seleccionado en texto principal e icono con acento de alto contraste. Ningún selector depende solo del rojo para expresar el valor.
4. Tarjetas de documentos, noticias, vídeos y episodios: borde/esquinas/espacios coherentes, altura flexible, texto adaptable.
5. Acciones del documento: estilo secundario común `TifloSecondaryActionStyle` con letras claras sobre superficie oscura o letras oscuras sobre superficie clara.
6. Menús de compartir, selector de archivos, alertas y navegación: controles SwiftUI/UIKit del sistema, respetando tema, tamaño de texto y accesibilidad; no introducir pantallas web.
7. Modo claro/oscuro/según sistema: se respeta `native-ios-color-scheme` sin duplicar configuraciones por pantalla.

## Requisitos de contraste y accesibilidad
- Texto normal: al menos 4,5:1; texto grande: al menos 3:1; iconos y límites de control significativos: al menos 3:1.
- Prohibido rojo corporativo `#A61B1B` como texto de botón sin relleno sobre negro/granate oscuro.
- No alterar `.accessibilityAction`, `.accessibilityAdjustableAction`, etiquetas, orden del foco, activación, TTS, descarga, guardado ni compartición.
- Colores de estados no sustituirán sus etiquetas de texto.
- Tipografía dinámica y crecimiento vertical: no truncar controles ni forzar desplazamiento horizontal; utilizar zonas seguras de iOS.

## Pruebas de aceptación
- Comparar Inicio > Recursos > categoría > ficha de documento > Volver: siempre debe percibirse la misma app.
- Repetir navegación hacia TifloLector, Vídeos, Actualidad, Podcasts y Configuración: fondo, botones, valor elegido, tarjetas y encabezados coherentes.
- Comprobar iOS claro/oscuro, alto contraste y texto grande, y comparar visualmente con web/Android.
- Preservar y volver a comprobar acciones de VoiceOver, rotor, gestos de ajuste y comportamiento de importación, guardado, descarga, lectura y compartir.
- No dar por terminada la revisión estética hasta observar capturas reales posteriores a la compilación; los tests de código no bastan.

## Entrega y límites
El primer cambio introduce tokens y estilos de pantalla compartidos en la rama iOS nativa, aplica el tema al contenido existente y reestiliza las acciones visibles de Recursos. La revisión de márgenes superiores, alineación de cabeceras y pantallas aún no migradas queda como validación visual en dispositivo, no como excusa para alterar las acciones que ya funcionan.

No es una publicación en TestFlight. El proyecto en esta rama usa el bundle temporal `com.tifloacosta.nativeprototype`; los cambios requieren compilación, comprobación visual y una integración controlada antes de convertirse en actualización de la app instalada.
