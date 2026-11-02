# Integración de Phonon español en TifloLector web

Estado: investigación técnica, NO disponible como motor del lector.

## Hechos verificados (documentación Gradium, 2 noviembre 2026)

- Motor Rust/WebAssembly/WebGPU: https://github.com/gradium-ai/xn-ptts
- Paquete de navegador: `phonon-tts`.
- El paquete web sin credenciales solo obtiene automáticamente `phonon-31m-en` (inglés).
- El modelo `gradium/phonon-40m-es` es **gated**. El usuario debe aceptar las condiciones en Hugging Face: https://huggingface.co/gradium/phonon-40m-es
- El modelo español está bajo CC BY-NC 4.0. El consentimiento individual para descargar no exime a TifloAcosta de respetar los términos de **redistribución** si TifloAcosta aloja los archivos.
- Gradium indica que para usar el modelo 40m en una app web deben descargarse sus archivos y servirse desde la aplicación bajo la licencia.
- No almacenar tokens de Hugging Face en JS público, HTML, git ni localStorage.
- El tamaño anunciado del modelo q8 es aproximadamente 74,6 MB, aparte de posibles recursos necesarios para inferencia.

## Pasos para un prototipo REAL, separados de producción

1. Confirmar por escrito el alcance de distribución no comercial de TifloAcosta y la atribución de la licencia.
2. Obtener el modelo español desde una cuenta autorizada; **no** incluir tokens ni pesos en GitHub sin verificar los permisos y la licencia.
3. Probar la librería `phonon-tts` con modelo español servido por una ruta estática HTTPS de prueba y sin credenciales.
4. Añadir un botón «Cargar voz local» que solo inicie la descarga tras activación del usuario, anuncie progreso con `role=status` y errores comprensibles.
5. Añadir «Escuchar muestra» con el texto de prueba, más detener y selector de voz, sin enviar el texto a servidores externos.
6. Conectar la síntesis al lector conservando la voz web actual como alternativa, con cancelación, pausa, reanudación y continuidad por fragmentos.
7. Verificar Chrome con JAWS y NVDA, Safari con VoiceOver, memoria, latencia, controles de teclado y fallos de red.
8. Solo después del test de usuario fusionar a `main`.

## Prueba disponible hoy

Demostración oficial externa: https://gradium-phonon.static.hf.space/index.html
Seleccionar Phonon 40M y Español. Es una prueba del fabricante, **no** de TifloLector.

## Criterios de aceptación

- La voz española funciona DENTRO de TifloLector y lee un documento.
- No se exige instalar Python.
- No se expone ninguna credencial ni contenido de documentos a terceros.
- JAWS anuncia descarga, reproducción y errores.
- La licencia y la atribución están documentadas y aprobadas para el uso elegido.
