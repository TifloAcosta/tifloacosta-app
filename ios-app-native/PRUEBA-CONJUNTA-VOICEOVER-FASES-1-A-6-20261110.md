# TifloLector iOS — Prueba final de las fases 1 a 6 con VoiceOver

Documento de comprobación para la candidata consolidada, PR #303. No es un informe de pruebas realizadas. La compilación automática no sustituye las verificaciones con el iPhone.

## Preparación

Instalar una versión de prueba creada desde la rama `integration/ios-phases1-6-consolidated-20261110`, identificando su número de compilación antes de comenzar. Activar VoiceOver. Preparar un TXT con comas, punto y coma, dos puntos, interrogaciones, exclamaciones y párrafos; un EPUB con capítulos y enlaces; un DOCX con estilos de títulos; un PDF accesible; un DAISY ZIP con audio y navegación; y un MP3. Utilizar una clave API propia de Gemini sin mostrarla ni compartirla. Para Phonon, comprobar antes que el modelo y la voz elegida estén disponibles en el dispositivo.

## 1. Biblioteca, prioridad de libros y selección

1. Abrir TifloLector y recorrer con deslizamientos hacia la derecha: debe aparecer «Importar», después la sección «Mi biblioteca» con los libros, sin filtros ni ajustes intercalados.
2. Comprobar que cada libro se anuncia en una única unidad con título y porcentaje leído, no en dos controles.
3. Después del último libro verificar: Selección, filtros, ordenar, carpetas y ajustes/copias de seguridad. Comprobar A-Z, Z-A y «Último abierto».
4. Entrar en «Carpeta», revisar la lista y la creación de carpeta. Seleccionar varios documentos y comprobar que las acciones en lote no afectan a los demás.

## 2. Lectura y navegación por documento

1. Entrar en TXT y comprobar el botón «Reproducir»; doble toque inicia la lectura, luego el control se anuncia «Pausar». Volver a hacer doble toque para pausar.
2. Con VoiceOver sobre el botón, deslizar arriba y abajo para avanzar o retroceder según el «Modo de navegación».
3. Probar Bloque, Párrafo, Frase, Página, Encabezado (si existe), Capítulo, Tiempo, Marcas, Enlaces y modos DAISY solo cuando sean aplicables. Al cambiar a otro libro no debe conservarse un modo incompatible.
4. En Tiempo, probar 30 segundos, 1, 2 y 5 minutos. Comprobar que no se salta una pista DAISY como si fuera texto ni al revés.
5. Crear, abrir, recorrer y borrar marcas. Cerrar y reabrir el libro y verificar posición y marcas; repetir tras cerrar la aplicación.
6. Comprobar «Apagado automático», «Marcas guardadas», «Información» y «Añadir marca» antes de los controles «Audio» y «Visual».
7. Activar el toque mágico cuando el lector está parado: no debe arrancar audio. Con reproducción activa debe pausar; con lectura pausada debe reanudar solo el documento actual.

## 3. Pausas por puntuación y voces del sistema

1. Seleccionar «Normal» y escuchar el texto de prueba.
2. Seleccionar «Mayor» y «Expresiva»; las pausas de los signos deben diferenciarse audiblemente de Normal.
3. Seleccionar «Personalizadas». Ajustar por separado coma, punto y coma, dos puntos, final de frase y salto de párrafo; los controles deben permitir de 0 a 1,50 segundos en pasos de 0,05 segundos con VoiceOver.
4. Para comprobar que los ajustes tienen efecto, escuchar primero 0 y después 1 segundo para el mismo signo, manteniendo la voz y velocidad.
5. Pausar, reanudar, saltar, detener y reabrir un texto mientras se usa Personalizadas. La posición no debe retroceder ni reiniciarse.

## 4. Gemini y Phonon para lectura directa

1. En ajustes, entrar en «Motores externos». Para Gemini abrir la guía simplificada, crear una clave en Google AI Studio, pulsar «Listo», «Pegar», «Guardar» y «Comprobar conexión». Confirmar el recorrido del foco de VoiceOver. No grabar ni compartir la clave.
2. En un documento de texto elegir «Motor de lectura»: Sistema, Gemini y Phonon. Comprobar que realmente se escucha la lectura con cada motor disponible, no solo que aparezca en la exportación.
3. Gemini: durante la generación de un fragmento, pulsar «Pausar» y luego «Reproducir» o toque mágico. La lectura debe continuar sin quedar bloqueada. Repetir con Phonon cuando esté instalado.
4. En un texto largo verificar avance y recuperación de posición entre fragmentos, saltos por Tiempo y cambios de motor. Desconectar red para comprobar el aviso de Gemini; verificar Phonon sin conexión si el modelo está instalado.

## 5. Importación, información y exportación

1. Importar EPUB, DOCX, TXT, PDF accesible, DAISY y MP3. Comprobar índice, títulos, navegación y posición según el formato.
2. Verificar información del libro: porcentajes, tiempo medido o estimado, palabras y páginas identificadas cuando existan. No presentar estimaciones como tiempo real.
3. Compartir el archivo original y comprobar que se conserva el archivo, no solo el texto extraído.
4. Exportar audio desde voces del sistema y, si hay configuración propia válida, con Gemini y Phonon. Comprobar MP3/DAISY, nombre original, audio íntegro, índice, y compartir el ZIP DAISY completo.

## Registro de incidencias

Para cada defecto anotar: formato del libro, motor y voz, modo de navegación, versión exacta de la compilación, acción realizada, resultado esperado, resultado observado y si el error se reproduce. Nunca incluir claves API ni información privada.

**Criterio para cerrar pruebas:** no se da por probado ningún punto solo por figurar en el código o por superar la compilación. Corregir los errores y repetir los escenarios afectados antes de decidir una distribución.
