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

