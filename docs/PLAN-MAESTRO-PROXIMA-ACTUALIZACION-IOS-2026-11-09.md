# TifloAcosta — Documento maestro de acuerdos para la próxima actualización importante

Estado: documento de recuperación y consolidación de acuerdos.
Fecha de consolidación: 9 de noviembre de 2026.
Propietario de las decisiones funcionales: Tony Acosta — TifloAcosta.
Alcance de desarrollo vigente: primero iOS; Android queda expresamente para después de cerrar iOS.
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
Fase 9. Diagnóstico de accesibilidad, envío de incidencias, número de versión, regresiones y prueba integral con VoiceOver; preparar candidata iOS para TestFlight y posteriormente App Store.

No iniciar Android hasta el cierre de iOS. Los cambios específicos de Android se planificarán entonces, respetando el funcionamiento que ya sea correcto en esa plataforma.

## E. Reglas de preservación y seguimiento

- Marcar cada requisito con: pendiente, en desarrollo, implementado técnicamente, validado por usuario y publicado.
- No considerar «implementado» igual que «probado en iPhone» ni «publicado en App Store».
- Conservar este documento bajo control de versiones en GitHub y actualizarlo al aceptar nuevas decisiones.
- Antes de cerrar cada fase, contrastar todos los puntos B01–B11, A01–A21 y C correspondientes; no abandonar requisitos al reagrupar fases.
- Mantener intactas las bibliotecas de usuarios y respetar la configuración existente al actualizar la aplicación.
