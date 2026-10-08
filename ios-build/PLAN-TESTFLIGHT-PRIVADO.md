# TestFlight privado: fase inicial TifloAcosta

Objetivo: probar exclusivamente con la cuenta del titular en su iPhone. No crear grupos externos, invitaciones públicas ni enlaces de acceso abierto.

## Estado comprobado
- Compilación Debug para simulador en GitHub Actions: correcta (ejecución 37832370648).
- Compilación Release para dispositivo sin firmar: verificación automática añadida; pendiente de resultado.
- **No** existe aún IPA firmada ni subida a TestFlight.

## Antes de subir una compilación
1. Verificar funcionalidad en iOS: apertura de archivos locales, importación desde Archivos, permisos, recursos remotos, enlaces externos y audio.
2. Revisar uso de OneSignal (actualmente SDK de web) y terceros para privacidad real de iOS; la presencia de SDK requiere revisión, no una declaración automática de datos.
3. Confirmar etiqueta accesibilidad en dispositivo, especialmente VoiceOver, foco y navegación de TifloLector.
4. Crear credenciales de distribución Apple y perfil App Store, firmar en macOS remoto. Guardar claves solo en secretos cifrados de GitHub Actions; nunca en el repositorio, en el chat ni en un archivo de texto público.
5. Exportar IPA para App Store Connect y subirla tras autorización del titular.
6. En App Store Connect > TestFlight > Pruebas internas, usar únicamente al titular como probador interno. No crear grupo externo ni compartir enlaces públicos.

## Primera batería de pruebas con VoiceOver
- Inicio y selección de idioma: foco y etiquetas claras.
- Abrir TXT, HTML, PDF, DOCX, EPUB, PPTX y XLSX; verificar qué funciona realmente.
- Reproducir, pausar, avanzar y retroceder por frase o párrafo; audio no solapado con VoiceOver.
- Velocidad, tono y voz; marcadores, biblioteca y cola.
- Actualidad, Recursos, vídeos, podcasts, búsqueda y enlaces originales.
- Cambio de orientación, interrupción de llamada, modo sin conexión, permisos y retorno tras suspensión.
- Comprobar que no se exponen documentos del usuario a servicios remotos salvo consentimiento/funcionalidad declarada.

## Regla de privacidad de esta fase
La rama `preparacion-ios` no se fusiona en `main` ni se publica en tiendas automáticamente. Toda distribución requiere una decisión posterior explícita del titular.
