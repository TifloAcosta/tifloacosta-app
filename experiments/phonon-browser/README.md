# Prototipo real de inferencia de Phonon en navegador

Este directorio incluye una página con botones de cargar, escuchar y detener, y un estado accesible. Importa el paquete oficial `phonon-tts`, construible con Vite.

Para desarrollo: `npm install`, `npm run dev` y abrir la dirección local indicada. Para publicar el experimento separado: `npm run build`. No se publica automáticamente ni está conectado a TifloLector.

**Restricción importante:** el modelo público descargado automáticamente por el paquete es Phonon 31m inglés, no el español. Esta prueba sirve para verificar el motor WASM, la compatibilidad del navegador y la interfaz JAWS. **No constituye una voz española integrada.**

El modelo español gated `gradium/phonon-40m-es` no se puede descargar de forma anónima desde el navegador. Para integrarlo hay que obtener los archivos con autorización, estudiar distribución y aportar URLs estáticas locales a `PhononTTS.load({model: ...})` siguiendo el README oficial; no exponer tokens personales en el cliente.

No solicitar claves API a los usuarios en la web pública. No publicar como voz española hasta validación real.

Fuente: https://github.com/gradium-ai/xn-ptts/blob/main/ptts-wasm/js/README.md
