# Phonon — integración nativa de TifloLector (requisitos comprobados)

Estado de la rama de desarrollo: el motor de Phonon ya cuenta con bibliotecas reales `libptts_ffi.so` para arm64-v8a y x86_64 compiladas de la fuente v0.4.1 fija mediante GitHub Actions. El código incorpora importación local de modelos CPU, selección/escucha de voces, reproducción continua en el servicio multimedia y exportación MP3/M4A/WAV/DAISY sin enviar texto a Internet. **No está en la aplicación publicada**. Aún falta comprobar la reproducción y la calidad reales con modelos y TalkBack, y las obligaciones de licencias antes de una distribución.

## Proveedor y licencias

- Código y bibliotecas oficiales: https://github.com/gradium-ai/xn-ptts
- Phonon 31m (solo inglés): Apache 2.0. Modelo de aproximadamente 64 MB; compatible con desarrollo de aplicaciones y casos comerciales conforme a la licencia.
- Phonon 40m (español y otros idiomas), incluido el multilingüe: CC BY-NC 4.0, y acceso sujeto a aceptación de condiciones en Hugging Face. Exigir aceptación de las condiciones aplicables y respetar atribución y restricción no comercial; ante uso comercial, obtener autorización del titular. Que la aplicación sea gratuita no constituye por sí solo una autorización para todos los usos.
- Las voces y los modelos pueden tener atribuciones y términos propios; revisar antes de redistribuir.
- Phonon local no requiere claves API; no solicitar ni guardar una clave Phonon.

## iOS

La guía oficial https://github.com/gradium-ai/xn-ptts/tree/main/ios/PhononTTS describe el paquete Swift `ptts` (módulo `PhononTTS`) y su biblioteca nativa Core ML. Requiere iOS 18+, dispositivos compatibles y un paquete de modelo instalado o descargado. La distribución incluye un XCFramework ARM64 compilado; gestionar explícitamente simuladores x86_64, compatibilidad de arquitecturas y la huella de los modelos. La instancia `Phonon` y su reproductor deben conservarse durante toda la reproducción, con cancelación y gestión de sesión de audio.

Requisitos de integración: cargar modelo tras consentimiento y con progreso VoiceOver; descargarlo a almacenamiento de la app sin respaldar pesos innecesarios; verificar integridad; exponer solo voces realmente instaladas; permitir pruebas auditivas; reanudar documento a posición guardada; detener al pausar/cambiar motor/cerrar; exportar solo si lo permite el modelo y su licencia.

## Android

Guía oficial https://github.com/gradium-ai/xn-ptts/blob/main/android/README.md :
- Sin dependencia pública Maven todavía para el motor `ptts`.
- Ruta CPU: compilar `libptts_ffi.so` con Rust, cargo-ndk y Android NDK, e integrar la capa Kotlin `PhononTTS.kt` más JNA; copiar ABI arm64-v8a y x86_64 según soporte, sin romper la compatibilidad con el resto de la aplicación.
- Ruta NPU Qualcomm: AAR QNN requiere SoC/modelo compatibles; no tiene fallback automático. Evitarla como única ruta.
- Descarga de modelo y voces tras la primera solicitud, con progreso accesible y verificación de integridad; modo local sin red durante la lectura y exportación.
- En Android se puede también aprovechar un motor de voz de sistema compatible con `TextToSpeech`; no confundirlo con el motor Phonon embebido.

## Validación para activar la opción

1. Compilar runtime y verificar las bibliotecas y sus licencias en ambas plataformas.
2. Comprobar una voz española si existe un uso permitido de los modelos 40m; permitir siempre el modelo Apache 2.0 para inglés.
3. Descarga, almacenamiento, actualización, borrado y selección de modelos accesibles.
4. Leer EPUB/DOCX/DAISY con pausa, salto, marcas, bloqueo de pantalla y reanudación.
5. Exportar MP3/M4A/DAISY desde los mismos fragmentos, con archivo real y verificación externa.
6. Probar VoiceOver y TalkBack en dispositivos físicos. No publicar antes de superar estas pruebas.

En esta rama de desarrollo ya hay un motor Phonon local implementado mediante bibliotecas nativas y conexión Kotlin, además de las opciones del sistema y Gemini. Las compilaciones automáticas de Android han resultado satisfactorias, pero esto no acredita la generación de voz con modelos reales, el uso accesible con TalkBack ni una distribución autorizada. Las muestras de voz se adaptan al idioma seleccionado: español, inglés, francés, alemán o portugués. El modelo instalado debe soportar realmente ese idioma. No se ha fusionado ni publicado.
