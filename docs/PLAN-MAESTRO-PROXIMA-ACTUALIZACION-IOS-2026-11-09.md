# TifloAcosta — Documento maestro de acuerdos para la próxima actualización importante

Estado: documento de recuperación y consolidación de acuerdos.
Fecha de consolidación: 9 de noviembre de 2026.
Propietario de las decisiones funcionales: Tony Acosta — TifloAcosta.
Alcance de desarrollo vigente: exclusivamente iOS. Android no se tocará hasta que la versión definitiva que incorpore TODAS las mejoras de iOS esté publicada en App Store y disponible para todos los usuarios, no solamente enviada a revisión, aprobada o instalada por testers.
No sustituir este documento por resúmenes de fases. Toda reducción, sustitución o retirada de requisitos requiere decisión explícita del usuario.

## A. Veintiuna propuestas aceptadas el 8 de noviembre de 2026

Estas veinte propuestas fueron aceptadas conjuntamente por el usuario, y la número 21 se añadió a continuación. Se recuperan sus títulos y contenido esencial; el detalle técnico no documentado se especificará durante el desarrollo sin inventar decisiones.

1. **Búsqueda dentro de los documentos de TifloLector.** Mostrar resultados con contexto, acceder a cada coincidencia y regresar a la posición anterior.
2. **Diccionario y explicación de palabras.** Definiciones, sinónimos y traducción de palabras o fragmentos seleccionados durante la lectura.
3. **Estadísticas personales de lectura.** Progreso, tiempo de lectura y actividad personal de forma comprensible y accesible.
4. **Colecciones en la biblioteca.** Organizar documentos más allá de carpetas y filtros.
5. **Copias de seguridad.** Exportar e importar biblioteca, posiciones de lectura, marcas y ajustes. Valorar sincronización opcional, sin imponerla.
6. **Continuar viendo.** Recuperar vídeos desde el punto donde se dejaron.
7. **Lista de vídeos para después.** Guardar contenidos para ver en otro momento.
8. **Buscar dentro de un canal de vídeos.** No limitar la búsqueda a todos los canales.
9. **Continuar escuchando y descargas en Pódcast.** Recuperar la reproducción y gestionar episodios descargados.
10. **Reproducción continua de pódcast.** Pasar al siguiente episodio de acuerdo con la organización seleccionada.
11. **Guardar artículos para leer después.** Una lista de lectura pendiente.
12. **Filtrar Actualidad por fuentes e idiomas.** Selección accesible de procedencia e idioma.
13. **Favoritos en Recursos.** Guardar y localizar recursos de interés.
14. **Comprobación de enlaces.** Detectar enlaces rotos o inaccesibles en el contenido publicado.
15. **Identificar contenidos consultados.** Distinguir recursos o noticias ya abiertos.
16. **Retomar la última actividad.** Facilitar la vuelta a la tarea que se estaba realizando.
17. **Ajustes de verbosidad.** Poder reducir o ampliar la información anunciada por los lectores de pantalla.
18. **Envío de sugerencias y errores.** Un mecanismo sencillo y accesible desde la aplicación.
19. **Número de versión y cambios recientes.** Mostrar la versión instalada y explicar sus novedades.
20. **Diagnóstico de accesibilidad.** Herramientas y comprobaciones útiles para detectar y comunicar incidencias de accesibilidad.
21. **Integración con asistentes de voz.** Siri mediante App Intents y Atajos para iOS, y posteriormente las acciones de Android. Abrir secciones y controlar la reproducción mediante órdenes de voz.

## B. Once incidencias y decisiones concretas aportadas por el usuario para iOS

El alcance funcional de estos puntos debe respetarse literalmente al implementarlos; su redacción se ha normalizado únicamente para legibilidad.

B01. **Botón Reproducir:** estudiar eliminar botones separados de avanzar y retroceder. En el control Reproducir, doble toque para reproducir/pausar, gesto de VoiceOver arriba para avanzar y abajo para retroceder. Conservar una alternativa accesible para uso sin VoiceOver y asegurar que el control sea ajustable y anuncie los cambios.
B02. **Salto porcentual:** sustituir el avance del 10 % por el 5 %.
B03. **Pausas por puntuación:** corregir Normal, Mayor y Expresiva, que no están funcionando; añadir la personalización de porcentajes de tiempo existente en Android.
B04. **Toque mágico:** debe pausar o reanudar la lectura actual, sin arrancar una reproducción anterior o externa.
B05. **Nombre original:** al compartir o exportar documentos, también los convertidos, preservar el título original en vez de letras y números.
B06. **Guardar:** reparar el botón Guardar que actualmente no conserva el documento.
B07. **Conversión DAISY:** guardar una copia en la biblioteca al convertir a DAISY, independientemente de ofrecer Compartir o Exportar.
B08. **Eliminar:** en la confirmación de borrado, pronunciar y mostrar el título exacto del documento que se va a eliminar.
B09. **Marcas:** presentar cada marca con la primera frase o contexto del texto, no solamente un número.
B10. **Eloquence:** investigar y corregir la falta de reproducción cuando se selecciona entre las voces del sistema.
B11. **Navegación DAISY:** aumentar las modalidades disponibles, incluidos encabezados y todas las estructuras admitidas por cada libro.

## C. Acuerdos anteriores que se deben mantener

### C1. TifloLector: fiabilidad y biblioteca
- Posición, marcas persistentes, navegación y temporizador: fiabilidad en **todos** los formatos compatibles, no únicamente EPUB.
- Las marcas pertenecen a cada documento; no introducir una sección global de marcas que las descontextualice.
- Temporizador de apagado funcional: iniciar, cancelar y detener realmente lectura o audio.
- Selector de modo de navegación situado cerca de los controles principales.
- Avances y retrocesos por tiempo durante lectura de texto mediante estimación del TTS: intervalos de un minuto; avance porcentual del 5 %.
- Funciones comunes de accesibilidad y comportamiento consistentes entre formatos.
- Botón único «Carpetas» después de los filtros, con «Crear nueva carpeta» como primera opción del listado y después las carpetas, sin duplicaciones.
- Selección múltiple de documentos; filtros Biblioteca/Recientes/Cola y ordenación accesible; último abierto.
- Etiquetas claras, sin controles ambiguos que digan «acción» o «activación/desactivación» sin indicar la función.
- Respuesta accesible al crear marcas o completar acciones, incluidos errores y confirmaciones.
- Importación y gestión de EPUB, PDF accesible, TXT, RTF, DOCX, Office, ZIP DAISY, MP3/M4A y demás formatos ya compatibles; OCR para imágenes o PDF escaneado cuando esté soportado.
- Exportar «Documento original» por separado; exportación MP3/DAISY con título original; compartir el paquete DAISY completo y no solo uno de sus archivos.
- Ofrecer DAISY de texto y DAISY de audio cuando corresponda. Verificar coherencia de las estructuras y archivos DAISY.

### C2. Voces, audio y motores
- Voz y motor configurables con opciones gratuitas y de pago individual; ninguna clave de API financiada ni compartida por TifloAcosta.
- Voces del sistema para leer y, cuando sea técnicamente viable, exportar audio, sin imponer servicios externos.
- Gemini y Phonon; contemplar voces locales gratuitas como Kokoro según compatibilidad y licencias.
- Guía accesible para crear y pegar clave API, selección por proveedor, voces y pruebas de funcionamiento; avisos de cuota/consumo cuando proceda.
- Revisar pausas por puntuación, tono, velocidad, saturación y calidad de audio exportado.
- No imponer el límite de 60.000 caracteres a la exportación que pueda efectuar el motor de sistema sin ese límite.

### C3. Vídeos y pódcast
- «Canales seguidos», lista accesible, «Novedades» de esos canales, orden cronológico, diez resultados cada vez y «Cargar 10 más».
- Primera modalidad de seguimiento sin cuenta Google; integración con OAuth de YouTube opcional para suscripciones reales.
- Reproductor accesible: pausa, reproducción, saltos temporales, posición y acciones admitidas.
- Acciones en rotor sobre el título cuando proceda, sin tener que entrar al contenido.
- Pódcast: seguir/dejar de seguir programas, nuevos episodios, importación OPML, reproducción y continuidad.

### C4. Idiomas y noticias
- Interfaz en español/inglés primero, ampliable a portugués, francés y otros.
- Los documentos originales de Recursos y los feeds de Actualidad **permanecen en su idioma de origen**.
- Traducción de cada documento o noticia al idioma configurado **solo por petición expresa del usuario**.
- Tratamiento internacional, sin suponer que el idioma español equivale exclusivamente a España.

### C5. Notificaciones
- Notificaciones automáticas **solo desde Novedades propias**: nuevos documentos y vídeos del canal TifloAcosta.
- Nunca generar notificaciones automáticas a partir de Actualidad, feeds o RSS externos.
- Permitir un canal independiente para comunicaciones manuales puntuales.
- Control de categorías, accesibilidad, apertura directa, ausencia de duplicados y opciones no invasivas.

### C6. Catálogo móvil: incidencia del 9 de noviembre
- La web mostraba las Píldoras 25, pero iOS mostraba «Sin conexión» y catálogo antiguo en Recursos y Novedades.
- Se sincronizó `mobile-content.json` en el servidor y se incorporó en iOS un origen alternativo de descarga y errores informativos.
- **No declarar la incidencia solucionada** hasta verificar la respuesta del servidor público y el funcionamiento real en una versión instalada de iOS.
- Añadir actualización manual explícita y accesible del catálogo, con indicación del resultado y fecha de última sincronización.

## D. Propuesta de distribución en fases para iOS (organización, no sustitución del inventario)

Fase 1. Catálogo y conectividad, estado de actualización, mensajes diagnósticos; estabilidad de portada, Recursos y Novedades.
Fase 2. Controles de lectura, persistencia, marcas, navegación y temporizador; incluir B01, B02, B04, B08, B09, B11.
Fase 3. Biblioteca y conservación: carpetas, colecciones, selección, Guardar, DAISY en biblioteca, nombres al compartir/exportar, copias de seguridad; incluir B05, B06, B07.
Fase 4. Voz, pausas, Eloquence y motores, exportaciones y calidad de audio; incluir B03, B10.
Fase 5. Búsqueda y ayudas de lectura: búsqueda contextual, diccionario, estadísticas, volver a la actividad y listas personales.
Fase 6. Vídeos: continuar viendo, ver después, canales seguidos, búsquedas dentro de un canal, novedades, OAuth opcional.
Fase 7. Pódcast, Actualidad y Recursos: continuar escuchando, descargas, reproducción continua, favoritos, lectura posterior, filtros, historial y enlaces.
Fase 8. Idiomas, traducción bajo demanda, Siri/Atajos, notificaciones y preferencias de verbosidad.
Fase 9. Diagnóstico de accesibilidad, envío de incidencias, número de versión y regresiones técnicas automatizadas. Cuando TODAS las fases de iOS estén implementadas, preparar UNA versión candidata integrada para realizar las pruebas funcionales conjuntas en TestFlight, corregir las incidencias detectadas y después publicar la versión definitiva en App Store.

No iniciar trabajos en Android hasta que la versión final de iOS con TODAS las mejoras esté publicada en la App Store y disponible para todos los usuarios. No basta con completar el desarrollo, aprobar las pruebas, subir a TestFlight o conseguir la aprobación de Apple.

## E. Reglas de preservación y seguimiento

- Marcar cada requisito con: pendiente, en desarrollo, implementado técnicamente, validado por usuario y publicado.
- No considerar «implementado» igual que «probado en iPhone» ni «publicado en App Store».
- No pedir pruebas manuales parciales ni pruebas de usuario fase por fase en TestFlight. Se realizarán las pruebas técnicas de integración y compilación durante el desarrollo; la prueba práctica en TestFlight tendrá lugar al terminar TODAS las fases de iOS.
- No iniciar Android ni modificar su código, canal de pruebas o versión publicada hasta confirmar que la actualización definitiva y completa de iOS está disponible para todos los usuarios de App Store.
- Conservar este documento bajo control de versiones en GitHub y actualizarlo al aceptar nuevas decisiones.
- Antes de cerrar cada fase, contrastar todos los puntos B01–B11, A01–A21 y C correspondientes; no abandonar requisitos al reagrupar fases.
- Mantener intactas las bibliotecas de usuarios y respetar la configuración existente al actualizar la aplicación.

## F. Registro de ejecución — fase 1, 9 de noviembre de 2026

Estado: **en desarrollo, pendiente de compilación definitiva y verificación en iPhone**. Esta anotación no equivale a una fase terminada.

- Corregida la interpolación de los mensajes de error de descarga en el código Swift.
- Descarga principal desde tifloacosta.com y alternativa desde el catálogo público de GitHub. Se fuerza la consulta sin caché HTTP para la actualización.
- Se conserva la copia local existente si fallan ambos orígenes. No se vacían Recursos ni Novedades al producirse un error.
- Se impide solapar llamadas simultáneas a la actualización y se rechaza un catálogo sin recursos.
- Se registra localmente la fecha de la última descarga correcta, además del número de recursos, vídeos y noticias recibidos.
- Añadidos botones «Actualizar recursos» y «Actualizar novedades» visibles siempre, con estados de carga, mensajes y anuncio para VoiceOver.
- Añadidas pruebas de contrato `ios-app-native/tests/catalog-sync-phase-one.test.mjs` para mantener estas garantías y la presencia de Píldoras 25 en los dos idiomas.
- Pendiente: revisar resultado de la compilación nativa en el simulador y verificar la respuesta efectiva del dominio público. La prueba funcional en iPhone con VoiceOver se hará conjuntamente con el resto de las fases en una versión integrada de TestFlight.
- Pendiente: revisar la coherencia lingüística de todos los mensajes y las acciones de actualización, y comprobar que los errores se expliquen de manera fácil de comprender.
- Android no ha sido modificado.

No distribuir una versión pública basándose únicamente en estas comprobaciones de código. Registrar por separado las pruebas técnicas por fase; la validación manual del usuario y de VoiceOver se realizará de forma conjunta en TestFlight cuando terminen todas las fases de iOS.

## G. Decisiones de publicación y pruebas, ratificadas por el usuario el 9 de noviembre de 2026

1. **Único sistema en desarrollo:** iOS, hasta terminar la actualización importante completa.
2. **Sin pruebas manuales fase por fase:** se avanzará por todas las fases realizando internamente comprobaciones de código, integración y compilación; el usuario no probará cada función individualmente en TestFlight durante el desarrollo.
3. **TestFlight solo después de todas las fases:** preparar entonces una versión candidata integrada para probar todas las mejoras juntas; corregir las incidencias detectadas y repetir las pruebas integrales necesarias.
4. **Publicación final:** distribuir a los usuarios de App Store únicamente la versión definitiva de iOS que haya superado la validación conjunta.
5. **Bloqueo de Android:** no realizar cambios ni iniciar su siguiente actualización hasta que la versión definitiva de iOS, con todas las mejoras, esté efectivamente instalada o disponible para la totalidad de usuarios de la App Store. La confirmación se hará con el estado de distribución pública, sin asumir que las actualizaciones automáticas se hayan instalado de inmediato en cada dispositivo.
6. **Automatización de publicación:** las compilaciones técnicas pueden ejecutarse durante el desarrollo, pero ningún envío automático a TestFlight ni a App Store debe tratarse como autorización para una prueba parcial o publicación. Cualquier envío pendiente anterior deberá verificarse por separado, sin usarlo como candidata de esta actualización.

## H. Continuación técnica de la fase 1 — 9 de noviembre de 2026

- Se comprobó que el proceso de compilación iOS del primer bloque de fase 1 terminó correctamente en el simulador (ejecución 42657456217).
- El flujo de TestFlight se cambió a ejecución manual para respetar la decisión del usuario de probar **una sola versión integrada al terminar todas las fases**. Esto no garantiza la cancelación de ejecuciones que ya estaban en marcha antes de cambiar el flujo.
- El catálogo iOS ahora consulta los dos orígenes públicos, compara `generatedAt` y selecciona el contenido más reciente. Una respuesta HTTP 200 que entregue un JSON antiguo no debe ocultar un catálogo más nuevo de la otra fuente.
- Protege la copia local: un servidor más atrasado no sustituye silenciosamente los datos más recientes que ya posea el dispositivo.
- Corregido el análisis de las fechas ISO 8601, tanto con milisegundos como sin ellos, porque `mobile-content.json` utiliza fechas con fracción de segundo.
- Actualizados los contratos de pruebas del catálogo y de la política de TestFlight. El primer ciclo de pruebas detectó expectativas antiguas y se corrigieron, sin reactivar el envío automático a TestFlight.
- Se mantienen los botones accesibles de actualización manual, el resultado anunciado y la fecha de sincronización persistida.
- **Pendiente:** confirmar que la compilación del último commit es satisfactoria; verificar acceso real al catálogo público desde un iPhone; probar con VoiceOver y comprobar Recursos y Novedades en la ronda integrada final. No anunciar esta fase como completada antes de dichas verificaciones.


## I. Cierre técnico de la fase 1 y transición a la fase 2 — 9 de noviembre de 2026

**Estado de fase 1:** implementación técnica concluida; validación funcional real aplazada a la prueba integral acordada. No equivale a confirmación de funcionamiento en los dispositivos de todos los usuarios.

- Se corrigió el catálogo móvil para incluir Píldoras 25 y se desplegó correctamente en GitHub Pages; las entradas están presentes en el archivo del repositorio.
- La app iOS incorpora descarga con origen alternativo, comprobación de versión temporal y elección del catálogo más reciente, protección contra retroceso a versiones antiguas y conservación de la copia local si fallan ambos orígenes.
- Se corrigió específicamente la interpretación de fechas ISO 8601 con y sin milisegundos.
- Recursos y Novedades incorporan actualización manual accesible, fecha de última descarga correcta, mensajes de error y anuncios de resultado mediante VoiceOver.
- Se actualizaron las pruebas de contrato frente a los nuevos mensajes de descarga y la distribución manual de TestFlight. La ejecución completa de compilación nativa y pruebas automatizadas 42661246903 terminó con resultado **success**; no quedaron pasos fallidos. Las pruebas funcionales reales con VoiceOver permanecen reservadas a la validación conjunta.
- El dominio público `https://tifloacosta.com/mobile-content.json` no ha podido verificarse desde las herramientas de acceso exterior de esta sesión. La actualización real y lectura con VoiceOver en dispositivo quedan incluidas expresamente en la futura prueba integral. No se afirma que la incidencia de la versión pública anterior esté solucionada en iPhone.

**Siguiente fase:** fase 2, controles y fiabilidad de TifloLector (B01, B02, B04, B08, B09, B11, persistencia, navegación y temporizador). Avanzar en implementación sin esperar pruebas parciales del usuario.

## J. Inicio de fase 2 — controles y navegación de TifloLector

- Requisito **B02**: cambio del salto porcentual del rotor de VoiceOver de diez a **cinco por ciento** en ambos sentidos, respetando el límite 0–100. Implementación en `ios-app-native/Sources/NativeTifloLector.swift`.
- Se añadió una prueba de regresión a `ios-app-native/tests/reader-phase-two-contract.test.mjs` para impedir que vuelvan las acciones de salto del 10 %.
- Estado B02: **implementado en código, pendiente de su validación conjunta**. Los demás requisitos de fase 2 siguen pendientes.

## K. Avances de la fase 2 — controles, marcas y temporizador

Cambios implementados en código (pendientes de validar conjuntamente en TestFlight):

- B01: el botón Reproducir/Pausar incluye acciones ajustables con VoiceOver: deslizar hacia arriba avanza un minuto, deslizar hacia abajo retrocede un minuto. En audio salta 60 segundos; en texto estima el desplazamiento según la longitud del documento y la velocidad de voz. Se mantienen los controles de avance existentes para quien no utilice VoiceOver.
- B04: acción de toque mágico en la pantalla de lectura, restringida a pausar o reanudar la sesión actual cuando corresponda; no se da orden de iniciar otra reproducción.
- B08: el diálogo para eliminar un documento indica su título y advierte que la operación no se puede deshacer.
- B09: las marcas de texto dentro del libro muestran un fragmento contextual además del porcentaje, en lugar de limitarse a un número.
- Selector de modo de navegación (bloque, párrafo, frase, página y encabezado), botones Unidad anterior/siguiente y acceso a marcas junto a los controles principales.
- Temporizador: cuenta con plazo absoluto mientras se reproduce, de modo que el cambio de pista no reinicia automáticamente el tiempo restante; al pausar o detener se cancela la cuenta, y los cambios expresos del intervalo inician una nueva.
- Se han añadido pruebas automatizadas de regresión para estos contratos.

**Aún no cerrado:** comprobar las compilaciones automáticas de los cambios actuales; persistencia de marcas/posición en todos los formatos; ampliar la estructura de navegación de DAISY según sus metadatos reales; ensayo funcional global con VoiceOver al finalizar las fases. No dar por finalizada la fase 2 por esta anotación.

## L. Fase 2: precisión de posición y navegación DAISY — 9 de noviembre de 2026

- Verificada compilación exitosa de controles, marcas y temporizador de fase 2 (ejecución 42665625680).
- Añadido a la biblioteca un campo opcional `lastTextOffset` con desplazamiento del texto en caracteres, conservando `lastPercent` para compatibilidad con libros anteriores. Las posiciones modificadas por navegación se guardan con precisión en este campo.
- La pantalla de lectura y el botón Reproducir desde la biblioteca consultan primero ese desplazamiento, con recuperación por porcentaje en bibliotecas antiguas. Advertencia: la devolución de posición por eventos del sintetizador todavía depende del porcentaje, por lo que no se acredita precisión por palabra en toda la lectura TTS hasta revisarla específicamente.
- DAISY: añadida extracción inicial de encabezados del índice NCC y asociación con archivos SMIL y pistas de audio cuando están presentes, manteniendo nivel y título. Se exponen como «Navegación DAISY por encabezados»; esta versión salta al inicio de la pista asociada.
- **Alcance limitado:** aún no se implementan destinos a un tiempo interno de pista mediante clipBegin/clipEnd, navegación completa SMIL/NCX, páginas o estructuras especiales de DAISY. No afirmar compatibilidad completa.
- Se añadieron pruebas de contrato para recuperación de posición y navegación NCC. La compilación de los últimos cambios requiere verificación antes de dar el bloque por terminado.


## M. Verificación técnica del bloque de persistencia y DAISY

- Los cambios incluyen guardado opcional del desplazamiento exacto en caracteres, recuperado desde la biblioteca y desde la pantalla del documento; los libros preexistentes siguen usando su porcentaje anterior hasta disponer de una posición más precisa.
- Se almacena, para nuevas importaciones DAISY que aporten `ncc.html` y referencias `SMIL` compatibles, la lista inicial de encabezados con nivel, título y pista correspondiente.
- El índice de DAISY en la pantalla del lector muestra estas entradas y permite situar la reproducción en la pista indicada. Esta navegación todavía no alcanza los destinos de tiempo internos ni todas las estructuras DAISY.
- La vista SwiftUI del lector se dividió en componentes menores (cabecera, hojas de marcas y de índice) después de que el compilador superase el tiempo de análisis de la expresión original. La compilación del commit `ad182ce913e3ddc3329811417e4219ca5f91ddb0` superó los pasos de tests de código y compilación del simulador en la ejecución 42668354449; la finalización completa de esa ejecución se verifica por separado.
- El estado de la fase 2 sigue **en desarrollo**: pendiente evaluar posición por palabra durante TTS, navegación DAISY de precisión y formatos especiales, y conservar todos los requisitos en la prueba conjunta.

## N. Progreso TTS por palabra — continuación fase 2

- El mecanismo de voz nativa usa las posiciones de cada palabra comunicadas por `AVSpeechSynthesizerDelegate` para mantener `textCharacterOffset` y desplazar la posición de texto sin convertirla nuevamente a porcentajes enteros.
- La pantalla de lectura conserva por separado el porcentaje para anuncios y el desplazamiento de caracteres para reanudación exacta; se evita que la actualización porcentual reemplace el desplazamiento más preciso.
- La lectura iniciada desde la biblioteca también suministra al sintetizador el desplazamiento inicial y la longitud total del texto para que los porcentajes no vuelvan a empezar en cero.
- Se incorporó una prueba de contrato específica; queda pendiente confirmar la compilación de este cambio y la validación práctica final con VoiceOver.

## O. Fase 2: navegación DAISY dentro de pistas (continuación)

- Los enlaces de encabezados NCC hacia `archivo.smil#identificador` se resuelven buscando el fragmento correspondiente del SMIL, en vez de tomar siempre su primer audio.
- Cuando el segmento de audio indica `clipBegin` o `clip-begin`, el lector interpreta tiempos con segundos decimales, formato horas:minutos:segundos o prefijo `npt=`.
- El destino DAISY conserva `seconds` de manera opcional para seguir leyendo bibliotecas importadas anteriormente. Al abrir el encabezado se accede a la pista y, si se dispone de un inicio temporal válido, se salta a ese punto.
- Se incorporaron pruebas de contrato; el resultado definitivo de compilación del último código queda sujeto al flujo `42669987256`.
- No significa que esté completa toda la navegación DAISY: todavía deben tratarse con precisión estructuras NCX, referencias de páginas, notas, saltos internos especiales y libros que distribuyen contenido en varios archivos SMIL.

## P. Fase 2: ampliación de navegación estructurada DAISY — 9 de noviembre de 2026

- Se amplió el modelo de destinos DAISY para incluir un tiempo de inicio opcional dentro de la pista. La función `seek(toSeconds:)` coloca la reproducción en ese segundo cuando se dispone de un `clipBegin` válido.
- Se interpreta el fragmento `archivo.smil#identificador` y se busca su audio correspondiente en SMIL, en lugar de asociar indiscriminadamente el primer audio del archivo.
- Se interpretan tiempos de inicio expresados en segundos, segundos con decimales y formato de horas, minutos y segundos, incluidos prefijos `npt=`.
- Se añadió un lector estructurado NCX que preserva niveles de encabezados y reconoce asimismo elementos de página y referencias especiales; se utiliza cuando no se extrajeron entradas del índice NCC.
- Las entradas NCX conservan su tipo y su título para una presentación accesible. El campo `kind` y la posición temporal son opcionales para mantener la decodificación de bibliotecas anteriores.
- Se ampliaron las pruebas automáticas para proteger interpretación de índices, enlaces a fragmentos, tipos de entrada y saltos temporales.
- Estado: **implementado en código, compilación y pruebas completas de la última revisión todavía pendientes de verificación**. No se afirma navegación DAISY universal: quedan formatos concretos y estructuras SMIL/NCX que necesitarán pruebas con libros representativos durante la validación integral.

## Q. Fase 2: correcciones de pruebas y persistencia DAISY — 9 de noviembre de 2026

- Se corrigieron dos pruebas de contrato de NCX que seguían buscando el modelo antiguo, anterior a la incorporación de tipos «Página» y «Referencia».
- Se añadió `lastAudioSeconds`, campo opcional que permite conservar el tiempo real de escucha de un libro DAISY o audiolibro sin depender exclusivamente del porcentaje entero de la pista. Los registros anteriores conservan sus datos compatibles.
- La lectura de audio abierta desde la biblioteca intenta recuperar esa posición exacta si existe. La pantalla del documento también recupera los segundos al iniciar la pista guardada; se evita aplicar esa restauración después de un salto manual a otro capítulo.
- Los guardados de posición incluyen ahora los segundos reales siempre que el reproductor de audio esté activo.
- Se añadió prueba automatizada de contrato para persistencia y reanudación en segundos.
- **Limitación de verificación:** las ejecuciones de GitHub Actions 42672038883, 42672161133 y 42672194430 aparecen como «failure», pero la API devuelve **cero trabajos** en sus registros, por lo que no ofrecen mensajes de compilador ni pruebas ejecutadas. No se consideran pruebas de código fallidas ni tampoco compilaciones aprobadas. Se requiere una ejecución de CI que efectivamente inicie sus trabajos.
- **Estado:** fase 2 continúa técnicamente abierta. No se debe afirmar que el último conjunto de cambios compila hasta disponer de un resultado positivo de CI. La validación manual de audio, marcas, navegación y VoiceOver permanece reservada a la prueba final conjunta.

## R. Continuación fase 2: posiciones y marcas de audio — 9 de noviembre de 2026

- Se corrigieron las pruebas NCX que todavía comprobaban el modelo anterior, después de añadir entradas de página y referencias especiales.
- Se incorporó la persistencia opcional de `lastAudioSeconds` para conservar el segundo real de escucha, además de la pista y el porcentaje. Se mantiene la lectura de bibliotecas con datos anteriores.
- Se añadió recuperación de segundos al reproducir desde la biblioteca y al reabrir un documento, evitando que esa restauración se repita después de un salto manual de capítulo.
- Las marcas de audio ahora conservan `seconds` como dato opcional; una marca nueva puede llevar al segundo exacto de la pista, mientras las marcas antiguas continúan utilizando su porcentaje.
- Añadidas pruebas de contrato para estos comportamientos.
- Las ejecuciones recientes de GitHub Actions 42672038883, 42672161133 y 42672194430 finalizaron con fallo pero **cero trabajos registrados** por la API. Las ejecuciones 42672541865 y 42672568956 todavía aparecían en cola sin trabajos al consultar. No hay evidencia suficiente para atribuirlo al código ni para confirmar compilación de los cambios más recientes.
- **Estado:** funcionalidad implementada a nivel de fuente y pruebas añadidas; compilación actual pendiente, validación real diferida. No declarar la fase 2 cerrada mientras no se superen estas comprobaciones.

## S. Recuperación de compilación iOS — 9 de noviembre de 2026

- Se inspeccionaron las ejecuciones anteriores de GitHub Actions marcadas como fallidas sin trabajos registrados: la API devolvía lista de trabajos vacía. No eran registros de fallos de compilación Swift. Posteriormente GitHub volvió a asignar ejecutores y a iniciar los trabajos normales.
- La ejecución `42672568956` y después la ejecución más reciente `42673082854` consiguieron avanzar hasta la compilación nativa y la captura visual del simulador.
- En `42673082854`, las pruebas automáticas de contrato y **Compile for iPhone simulator (no signing)** finalizaron ambas correctamente. La captura posterior del simulador seguía en curso al consultar el estado; el resultado final del workflow debe comprobarse por separado.
- Se corrigió un defecto real en el lector: al pulsar Detener, ahora se persiste la posición exacta antes de destruir el reproductor de audio. Asimismo se guarda la posición de la pista anterior antes de cambiar de pista.
- Añadida prueba de regresión de orden de guardado para evitar que Detener pierda los segundos de reproducción.
- El resultado técnico de estas pruebas no sustituye las pruebas integrales de los formatos DAISY y VoiceOver que corresponden a la validación final conjunta.

## T. Cierre de implementación de fase 2 — 9 de noviembre de 2026

**Implementación funcional de la fase 2 completada en fuente.** El cierre técnico definitivo queda subordinado a que el último workflow de compilación y sus pruebas terminen correctamente. La prueba práctica de VoiceOver se mantiene en la validación integrada de todas las fases.

Resumen de requisitos integrados:
- B01: reproducir/pausar con doble toque y navegación ajustable desde el mismo control, avance y retroceso estimados de un minuto; alternativa accesible en pantalla.
- B02: saltos porcentuales del cinco por ciento.
- B04: toque mágico reservado a la sesión de lectura activa, sin iniciar audio externo desde la acción del lector.
- B08: confirmación de eliminación que menciona expresamente el título.
- B09: marcas con fragmento contextual. Las nuevas marcas de texto se guardan mediante su desplazamiento exacto en caracteres, no únicamente mediante porcentajes; las marcas anteriores siguen siendo compatibles y visibles.
- B11: índice DAISY 2 NCC, navegación DAISY 3 NCX con niveles, páginas y referencias; vínculos SMIL con posición interna en segundos cuando está disponible. Se conserva el orden de capítulos padre-hijo. Cuando hay NCC y NCX, se combinan las entradas no duplicadas para no perder páginas y referencias. Los casos no representados por metadatos reconocibles se considerarán límites de formato, no se inventarán destinos.
- Posiciones de lectura de texto persistidas en caracteres; posiciones de audio persistidas en segundos, por pista. Marcas de audio en segundos y compatibilidad con marcas antiguas.
- Temporizador: se conserva el plazo al cambiar de pista, se cancela al pausar o detener, y se guarda posición antes de apagar automáticamente la reproducción.
- Selector de navegación y marcas junto a controles principales; eliminación de la antigua sección global de marcas para tratarlas dentro de cada libro.
- Pruebas de regresión ampliadas: controles accesibles, persistencia, temporizador, DAISY y orden NCX.

**Verificación:** las pruebas de contrato realizadas durante la fase detectaron expectativas antiguas y se actualizaron. La ejecución 42673082854 superó las pruebas automáticas y finalizó correctamente con compilación para simulador. Tras los últimos cambios de marcas, NCX y apagado, la ejecución de CI 42677632211 debe confirmarse satisfactoria para dar por cerrado el bloque técnico. Las validaciones con archivos DAISY diversos y el manejo con VoiceOver se harán en la prueba integral convenida.

**Siguiente etapa, tras confirmar CI:** fase 3 — biblioteca, Guardar, exportaciones, DAISY generado, nombres originales y copias de seguridad.


## Registro de avance — 10 de noviembre de 2026: alcance completo y fase 6 general

Se ratifica que las fases específicas de TifloLector desarrolladas en la PR #303 no representan el cierre de las nueve fases de la actualización completa de TifloAcosta iOS. TestFlight se reserva para una única candidata cuando estén implementadas todas las novedades de este inventario, seguida de la validación integral con VoiceOver. Android permanece fuera del alcance actual.

- **Fases generales 1–4:** existen avances técnicos importantes de catálogo, lectura, biblioteca, motores y exportación. No se considerarán validadas hasta contrastar íntegramente los requisitos A/B/C y la prueba final.
- **Fase general 5:** búsqueda contextual, ayudas de lectura, estadísticas y continuidad de actividad tienen requisitos aún pendientes de auditoría/implementación.
- **Fase general 6, Vídeos:** implementados técnicamente el guardado «Ver después» sin Google, su acción en el rotor de títulos y «Continuar viendo» con posición local en el reproductor oficial. Progreso guardado sin contraseñas ni acceso a la cuenta. También incorporados técnicamente el seguimiento local de canales, las novedades cronológicas de esos canales y la paginación de diez en diez. Pendientes la verificación integral, la búsqueda avanzada dentro de canales y los demás requisitos de la fase.
- **Fases generales 7–9:** pendientes de auditoría y de completar todo lo que falte en Pódcast, Actualidad, Recursos, idiomas, traducción bajo demanda, Siri/Atajos, notificaciones, preferencias de verbosidad, diagnósticos y envío accesible de sugerencias.
- **Validación:** las pruebas automatizadas comprueban contratos; la validación de VoiceOver con la candidata final no se adelanta por subsistema.

Este registro no elimina ni simplifica ninguno de los acuerdos anteriores.


## Diseño de navegación de Vídeos — 10 de noviembre de 2026

El usuario acuerda simplificar la pantalla principal de Vídeos para que funcione como menú de acceso a funciones, sin desplegar allí los listados largos. Implementado técnicamente en la rama de integración:

- Pantalla «Vídeos»: accesos independientes a «Buscar en YouTube», «Vídeos del canal TifloAcosta», «Mis suscripciones de YouTube», «Canales seguidos sin cuenta Google», «Novedades de mis canales», «Continuar viendo» y «Ver después».
- «Vídeos del canal TifloAcosta» conserva la ordenación y la paginación de diez títulos al abrirlo. No recarga el inicio con los vídeos.
- «Buscar en YouTube» contiene el campo, filtros, resultados, navegación por canales, acciones de VoiceOver y reproductor existentes.
- «Mis suscripciones de YouTube» conserva los canales de la cuenta cuando hay sesión iniciada y añade el acceso a las novedades de esas suscripciones.
- Se preserva la diferencia entre canales seguidos localmente (sin cuenta) y suscripciones reales de la cuenta Google. Ambas listas pueden mostrar novedades sin mezclarse.
- «Continuar viendo» y «Ver después» poseen pantallas separadas y no presentan sus vídeos en el inicio.

Estado: implementado en código y con contratos de regresión actualizados. Falta confirmar la última compilación y, posteriormente, validar accesibilidad en la prueba integral de TestFlight. No afecta al calendario ni a la restricción de no probar hasta terminar las nueve fases de iOS.


## Continuación de la fase general de Vídeos — 10 de noviembre de 2026

- Incorporada en la pantalla individual de cada canal de YouTube la búsqueda por texto mediante campo de edición, botón de búsqueda y opción «Mostrar todos los vídeos de este canal». Los resultados del canal mantienen la paginación de diez en diez y el reproductor accesible.
- Detectada una incompatibilidad real del servicio: `youtube-worker/src/youtube-api.js` ignoraba las palabras de búsqueda al utilizar `channelId`. Se ha corregido para enviar `q` a la API cuando se escribe una expresión de al menos dos caracteres, conservando las novedades de canal sin filtro cuando `q` queda vacío.
- Añadidos tests de contrato en iOS y pruebas unitarias del Worker para búsquedas por canal y validación de consultas.
- **Dependencia de despliegue:** el workflow de YouTube ejecutado por una PR verifica los tests, pero no despliega el Worker público; ese paso está configurado para eventos distintos de `pull_request`. Antes de probar la búsqueda por canal desde TestFlight, deberá estar desplegada y verificada la versión del servicio que respeta `q`. No interpretar un test verde de una PR como despliegue del backend.
- Sin cambios en Android y sin publicación de la candidata de iOS. La fase de Vídeos sigue sujeta a los demás requisitos del plan y a la validación final integral.


## Continuación de fase general 7 — Pódcast, 10 de noviembre de 2026

- Revisados seguimiento y cancelación de programas, detección de nuevos episodios, importación OPML y favoritos existentes; se conservan las claves locales y los datos persistidos anteriormente.
- Añadido modelo `NativePodcastPlaybackProgress` para recordar de manera persistente el episodio, su URL de audio, los segundos escuchados y su duración; solo se ofrecen episodios pendientes, no los terminados.
- Añadida la sección accesible «Continuar escuchando» y la acción «Olvidar posición». Se guarda la posición durante la escucha y al salir o cambiar de episodio.
- Añadido ajuste opcional «Reproducir el siguiente episodio automáticamente»; la cola se establece desde la misma lista de episodios, y la reproducción utiliza la notificación `AVPlayerItemDidPlayToEndTime`.
- Añadidas pruebas de regresión. La compilación de la última revisión se verifica por separado; ninguna prueba funcional con VoiceOver se adelanta a la candidata integral.
- **Pendiente de fase 7:** descargas y reproducción sin conexión; completar Actualidad, Recursos, filtros, favoritos e historial según acuerdos. No confundir las funciones implementadas de Pódcast con cierre del bloque completo.


## Fase general 7 — Descargas de Pódcast, 10 de noviembre de 2026

- Se ha añadido un almacén local `NativePodcastDownloads` para descargar episodios directamente desde su URL RSS HTTPS, usando ficheros privados en Application Support y un índice persistente en UserDefaults.
- Se limita el fichero descargado a 500 MB, se comprueban formatos de audio compatibles y se utilizan nombres internos derivados de un hash para evitar rutas o nombres de archivo inseguros.
- La pantalla de Pódcast incorpora «Episodios descargados», con escucha local y eliminación; los listados recientes y seguidos ofrecen la acción «Descargar».
- La cola de reproducción continua y las acciones «Continuar escuchando» utilizan el archivo local si existe, pero conservan el identificador y URL original para mantener el progreso entre sesiones y entre reproducción en línea y sin conexión.
- Añadidos contratos automatizados de descargas y continuidad. **Pendiente** la confirmación de compilación y la prueba integral real en iPhone, así como demás requisitos de Actualidad y Recursos.


## Continuación fase general 7 — Actualidad y Recursos, 10 de noviembre de 2026

- Se ha añadido un almacén local compartido `NativeReadingActivity` para la cola «Leer después» y el historial de noticias y recursos abiertos. Identificación estable por tipo, ID e idioma, sin mezclar las colecciones permanentes de Favoritos ni la biblioteca de TifloLector.
- Las pantallas de Actualidad y Recursos incorporan el acceso «Leer después e historial», con reanudación por título, eliminación individual de pendientes y borrado explícito del historial. Se conservan entradas aunque el catálogo se actualice; solo se presentan aquellas que siguen disponibles.
- Actualidad permite filtrar por medio de origen y por idioma (idioma de aplicación, todos, español o inglés); no se traduce automáticamente el contenido. Se mantienen categoría, búsqueda textual y paginación.
- Recursos permite buscar por palabras del título o la descripción sin tener que escoger previamente una categoría, además de filtrar por idioma; conserva selección ajustable de categorías, lectura, TifloLector, descargas y Favoritos.
- Los lectores nativos registran la apertura en el historial y ofrecen un control visible para guardar o quitar el contenido de «Leer después». La actividad comparte el mismo objeto de entorno SwiftUI.
- Añadidas pruebas de contrato y actualizado el test preexistente del listado de Recursos para su nueva capacidad de búsqueda.
- **Pendiente:** verificar compilación y regresiones, completar las restantes funciones comprometidas en Actualidad y Recursos y ejecutar posteriormente una única validación integral de VoiceOver en TestFlight.


## Avance fase general 8 — traducción bajo petición y Siri, 10 de noviembre de 2026

- Se añade `NativeOnDemandTranslationScreen`: traducción con el framework nativo de Apple, iniciada únicamente tras pulsar «Traducir ahora». El contenido de Actualidad/Recursos permanece en su idioma original, sin modificación del catálogo ni traducción automática en segundo plano.
- Los textos extensos se dividen en fragmentos para realizar solicitudes sucesivas sin recortar el documento; se anuncia el progreso y se permite alternar entre traducción completada y original. Las descargas de modelos y disponibilidad de idiomas dependen de la plataforma; los errores se presentan con texto accesible.
- Compatibilidad: `TranslationSession.Configuration` requiere iOS 18. Se mantiene el despliegue mínimo de la app en iOS 17; las acciones de traducción integrada aparecen mediante comprobación de disponibilidad del sistema. Queda pendiente valorar alternativa del sistema para iOS 17.4.
- Se añaden `AppIntent` y `AppShortcutsProvider` para abrir Actualidad, la biblioteca TifloLector y Vídeos con Siri/Atajos. `NativeHomeScreen` consume una ruta persistente una sola vez y navega mediante SwiftUI NavigationStack. Todavía **no** se anuncia «continúa el libro» porque requiere reanudación y control de reproducción de TifloLector, no solo navegación.
- Se han incorporado pruebas de contrato para traducción explícita, preservación del original y apertura de secciones por Siri. Pendiente confirmación de compilación y validación de VoiceOver de forma integral junto con las restantes fases.
- Pendientes de fase 8: traducciones de otros idiomas y localización PT/FR, atajos de control de audio, notificaciones limitadas a incorporaciones propias, avisos manuales y preferencias de verbosidad.


## Fase general 8 — Primeros avisos de Novedades, 10 de noviembre de 2026

- Implementados avisos **locales** con permiso explícito, activación y desactivación accesibles en Configuración. La autorización no se solicita al entrar en la aplicación.
- Únicas fuentes permitidas: recursos propios con `isNew == true` y vídeos del catálogo del canal TifloAcosta. No se incluyen `catalog.news`, canales externos, pódcast ni RSS.
- El primer refresco válido genera una referencia sin avisar de noticias antiguas. Los ID ya vistos se guardan para evitar duplicados, y si hay varias novedades se entrega un único resumen.
- Los avisos solo se comprueban al refrescar el catálogo mientras la app se ejecuta; **no son push remotas ni garantizan recibir novedades con la app cerrada**. Esta limitación se explica explícitamente en Configuración. No confundir con el canal de avisos manuales que sigue pendiente de diseño y backend.
- Añadidas pruebas de contrato de ámbito, consentimiento, ausencia de alertas antiguas e integración tras refresco del catálogo.

- Se añadió además un delegado nativo `UNUserNotificationCenterDelegate` para que, estando la aplicación en primer plano, los avisos locales queden en el Centro de notificaciones sin generar un banner invasivo mientras VoiceOver lee. No se presenta como canal de notificaciones push.

 
## Continuación de fase 8 — Siri «Continuar libro» y verbosidad configurable (10 de noviembre de 2026)

- El App Intent de Siri «Continuar el último libro en TifloLector» pide abrir la aplicación y remite a la biblioteca nativa. La pantalla recupera la obra con fecha `lastOpenedAt` más reciente y ejecuta el método de reproducción existente, que utiliza la posición guardada (texto o pistas DAISY/audio) y las preferencias del documento. La petición se elimina antes de ejecutarse para evitar reanudaciones dobles al cambiar de escena. Si la biblioteca está vacía, se muestra y anuncia un mensaje accesible.
- En Configuración se añade «Información al recorrer la biblioteca», con las opciones «Breve: título y porcentaje leído» (predeterminada) y «Completa: título, porcentaje, formato y carpeta». El título y el porcentaje permanecen en una sola unidad de VoiceOver, independientemente del modo.
- Se amplían pruebas de contrato de Siri y lectura para comprobar la reanudación desde el último libro y la preferencia de verbosidad. Las nuevas rutas aún precisan validación de voz con VoiceOver en la prueba conjunta final.
