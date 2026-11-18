# Copiar texto accesiblemente desde TifloLector

## Intención
Permitir a una persona ciega copiar una parte del documento que está leyendo y reutilizarla en otra aplicación, sin perder su posición de lectura, sus marcas ni el contexto del libro.

## Diseño aprobado por Tony
- Acción directa «Copiar párrafo actual», sobre el párrafo que contiene la posición de lectura. Confirmar el resultado mediante anuncio accesible, nunca reemplazar el documento ni mover el punto de lectura.
- Acción «Seleccionar y copiar texto»: abrir una vista de texto continuo, nativamente seleccionable y accesible con VoiceOver, que permita seleccionar desde palabras hasta varios párrafos y utilizar Copiar del sistema.
- Ambas acciones disponibles desde «Acciones» del documento y como acciones de accesibilidad junto a las existentes.
- La vista de selección se cierra con «Volver al libro», conservando exactamente la posición anterior. No se debe iniciar ni interrumpir la síntesis de voz accidentalmente.
- Trabajar con el texto ya extraído por TifloLector para PDF/OCR, EPUB, DOCX y TXT; no prometer copia textual de un libro compuesto solo de audio.

## Alternativas consideradas
- Solo selección nativa de fragmentos: existe parcialmente, pero está segmentada y puede impedir seleccionar varios párrafos.
- Copia por porcentaje o intervalos de caracteres: accesible en teoría, pero obliga a calcular posiciones y resulta complicada para usuarios poco expertos.
- Solución adoptada: copia rápida del párrafo y una vista continua seleccionable con controles nativos; favorece familiaridad con VoiceOver.

## Verificación
- Inicio, mitad y final de documento, incluidos párrafos con saltos de línea o en blanco.
- Un libro con varios párrafos, otro vacío y otro solo audio.
- VoiceOver en la vista continua, Copiar del sistema, cerrar y posición sin cambios.
- Pruebas automatizadas de controles y cálculo; validación física pendiente.
