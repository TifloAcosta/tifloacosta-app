# Beta TifloLector: plan de recuperación

**Alcance:** trabajo únicamente en la rama privada de recuperación, sin envío a TestFlight ni publicación. La siguiente beta reunirá también las propuestas pendientes de Mi Música.

## Decisiones aprobadas

- Modo de lectura Voz/Visual/Braille muestra únicamente controles del modo activo. Foco inicial en Reproducir mediante un único conmutador.
- Configuración de Gemini y Phonon exclusivamente en Motores externos; el selector de Voz y el conversor presentan solo motores preparados.
- Ajustes visuales del documento dentro de Visual; ajustes de apariencia de toda la aplicación sin cambios.
- Distinguir Compartir documento de Convertir a audio o DAISY, y ofrecer acciones contextuales por formato.
- Mantener la posición al pausar/reanudar y conservar foco de VoiceOver sobre Reproducir/Pausar.
- Mantener la preferencia de detalle de VoiceOver en la biblioteca, no en configuración general.
- Añadir acceso a Mi Música en Atajos y enlace X en Contacto y redes.

## Secuencia de implementación y comprobación

1. Añadir contratos de regresión para las pantallas de modos y selección de motores; ejecutar en rojo.
2. Reorganizar ajustes y controles de voz; ejecutar contratos en verde y suite existente.
3. Añadir regresiones de acciones contextuales, conversión y compartición de paquetes DAISY; corregir y comprobar.
4. Añadir regresiones de posición, pausa, toque mágico y foco; corregir y comprobar.
5. Añadir atajo Mi Música, enlace X y eliminar el ajuste de detalle duplicado; comprobar.
6. Realizar auditoría de todos los requisitos; reservar las pruebas físicas de VoiceOver, motores externos y DAISY real para la próxima beta conjunta, después de las mejoras de Mi Música.

**Precauciones:** los ajustes internos de VoiceOver/Braille no son modificables por la app; un servicio Gemini temporalmente sin conexión no equivale a clave deshabilitada; una voz que no informa alineación temporal puede limitar la precisión de la pausa.
