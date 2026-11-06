# Exportación MP3 — obligaciones de distribución

El prototipo Android utiliza `co.ntbl:lame:1.0.0`, adaptación Java de LAME con licencia **GNU LGPL versión 3**. Fuente y texto de licencia: https://github.com/daberkow/java-lame .

Esta biblioteca permite generar MP3 real a 24 kHz/mono/64 kbps sin cambiar la extensión de un WAV. Hasta comprobar en el teléfono y atender la LGPL-3, se considera **una dependencia experimental de la rama de pruebas**.

Antes de distribuir TifloAcosta con ella:
- Mantener atribución, copia íntegra de la LGPL-3, avisos de copyright y enlace al código fuente correspondiente de `java-lame`.
- Revisar y facilitar al usuario los medios de sustituir o modificar la biblioteca y depurar esas modificaciones, conforme a la LGPL-3 y sus requisitos para aplicaciones combinadas; el empaquetado DEX Android no equivale necesariamente a una biblioteca enlazada dinámicamente reemplazable.
- Verificar la cadena de dependencias y que los procedimientos de recompilación/reemplazo se ajusten a las obligaciones aplicables; contar con revisión legal si se pretende distribuir.
- Confirmar en dispositivos Android reales la creación de un MP3 reproducible, duración y navegación correctas, tanto en documentos cortos como largos.
- No habilitar la publicación por el mero hecho de que Gradle y las pruebas unitarias pasen.

El codificador iOS `SwiftMP3` utiliza licencia MIT y se valida de forma independiente.
