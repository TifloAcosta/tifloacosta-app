# TifloAcosta — Diseño de adaptación automática de Actualidad

Fecha: 19 de septiembre de 2026

## Objetivo

Completar el flujo editorial de Actualidad TifloAcosta para que las noticias realmente importantes puedan pasar de detección a adaptación bilingüe y publicación sin revisión manual previa, manteniendo controles estrictos de relevancia, fiabilidad, accesibilidad, calidad editorial y coste.

El sistema debe conservar la recogida automática actual, que sigue funcionando cada hora, y añadir una capa editorial autónoma que solo use IA cuando aporte valor. La web y Android consumirán después el mismo `actualidad.json`, por lo que la adaptación se genera una sola vez y se comparte entre clientes.

## Decisión principal

Se adopta un flujo híbrido:

1. Filtrado técnico local sin IA.
2. Evaluación editorial con IA solo para candidatas razonables.
3. Contraste adicional cuando sea posible.
4. Adaptación bilingüe automática únicamente para noticias catalogadas como muy interesantes.
5. Validación automática antes de publicar.

No se enviará todo el contenido a la IA y no se adaptarán noticias para rellenar espacio.

## Criterio de «muy interesante»

La selección no dependerá de una sola palabra clave. El evaluador debe considerar conjuntamente:

- impacto práctico para personas ciegas o sordociegas;
- novedad real;
- alcance de usuarios afectados;
- cambios de accesibilidad;
- compatibilidad o incompatibilidad relevante;
- lanzamiento, retirada o modificación importante de funciones;
- nuevas herramientas útiles para la comunidad;
- incidencias significativas;
- fiabilidad de la fuente;
- relevancia frente al ruido informativo habitual.

Una noticia tecnológica general solo debe adaptarse si tiene una relación clara y útil con accesibilidad o autonomía.

## Fiabilidad y contraste

Siempre que sea razonablemente posible, una noticia candidata debe contrastarse con una segunda fuente fiable antes de adaptarse.

El contraste no es un requisito absoluto. Si la noticia tiene suficiente impacto y procede de una fuente sólida, el sistema puede continuar aunque no encuentre una segunda confirmación. En ese caso debe conservar la fuente original como referencia principal y no añadir afirmaciones que no estén respaldadas por ella.

Para datos especialmente sensibles a cambios —versiones, fechas, precios, compatibilidades, funciones nuevas, retiradas de servicios o incidencias— el sistema debe intentar el contraste con prioridad.

El contraste se hará en dos niveles:

1. Primero, sin coste adicional, buscando coincidencias entre las fuentes y piezas ya recogidas por Actualidad.
2. Solo para una noticia ya seleccionada y cuando el contraste aporte valor real, el sistema podrá usar búsqueda web desde la API de IA. Se permitirá como máximo una búsqueda de contraste de pago por noticia en una ejecución.

Una fuente oficial de primera parte puede bastar por sí sola cuando publique información sobre su propio producto o servicio, aunque el sistema seguirá intentando contraste cuando sea útil.

## Estados editoriales

Se mantiene el modelo ya existente:

- `source-only`: visible como referencia a la fuente, sin adaptación propia.
- `selected`: elegida para adaptación, pero todavía no disponible como adaptación completa.
- `adapted`: adaptación TifloAcosta terminada y validada en español e inglés.
- `withheld`: retenida o descartada por falta de confianza, duplicidad o escaso interés.

El flujo automático nunca debe marcar como `adapted` una pieza incompleta.

## Flujo completo

### 1. Descubrimiento y normalización

La automatización actual sigue recogiendo las fuentes configuradas, normalizando títulos, fechas, URL canónica, categorías y metadatos.

### 2. Filtro local sin IA

Antes de cualquier llamada de pago, el sistema descarta o aplaza:

- duplicados;
- piezas fuera de la ventana temporal relevante;
- contenido claramente ajeno a accesibilidad;
- entradas de fuentes no admitidas;
- noticias ya evaluadas o ya adaptadas;
- elementos que incumplan reglas técnicas básicas.

El filtro local debe ser conservador: su objetivo es retirar ruido evidente, no decidir por sí solo qué noticia es importante.

### 3. Evaluación editorial con IA

Solo las candidatas que superen el filtro local llegan al evaluador de IA.

La evaluación debe devolver una respuesta estructurada con, al menos:

- decisión: adaptar / no adaptar;
- nivel de interés;
- impacto práctico;
- fiabilidad percibida de la fuente;
- necesidad de contraste adicional;
- razones breves y verificables de la decisión.

La evaluación debe ser corta para reducir consumo.

### 4. Contraste

Si la evaluación recomienda adaptación, el sistema intenta localizar una segunda fuente fiable cuando resulte razonable.

Si encuentra confirmación, incorpora únicamente los hechos que pueda respaldar.

Si no encuentra una segunda fuente, puede continuar cuando la fuente original sea suficientemente sólida y la noticia tenga potencia editorial clara.

### 5. Adaptación bilingüe

La IA genera una versión propia de TifloAcosta en español y otra en inglés.

Cada variante debe contener:

- título natural;
- resumen breve;
- cuerpo adaptado;
- utilidad o impacto práctico cuando proceda;
- referencia a la fuente original;
- enlace original conservado en los metadatos.

La longitud depende de la noticia. No se exige un tamaño fijo.

Las versiones española e inglesa deben sonar naturales en su idioma. La inglesa no debe ser una traducción mecánica de la española ni viceversa.

## Voz editorial TifloAcosta

Las reglas editoriales se guardarán en un archivo propio del repositorio para que no dependan de una conversación concreta ni de memoria externa.

La adaptación debe:

- usar lenguaje claro, humano y directo;
- priorizar la utilidad práctica;
- evitar grandilocuencia y titulares exagerados;
- evitar muletillas y fórmulas repetitivas asociadas a texto automático;
- explicar términos técnicos cuando ayude a la comprensión;
- no inventar información;
- no copiar párrafos completos de la fuente;
- conservar la atribución y el enlace original;
- mantener un enfoque internacional y no asumir que todas las personas están en el mismo país.

El sistema no debe imitar literalmente una firma personal ni fingir que una persona concreta redactó manualmente la adaptación.

## Aviso de adaptación

La interfaz debe informar una sola vez de que el contenido es una adaptación de TifloAcosta.

Texto base en español:

> Adaptación de TifloAcosta basada en la información de la fuente original.

La versión inglesa deberá expresar lo mismo de forma natural.

No debe repetirse ese aviso dentro del cuerpo ni en varios puntos de la misma lectura.

## Validación automática

Antes de cambiar una pieza a `adapted`, el sistema debe verificar:

- que existan título, resumen y cuerpo en español;
- que existan título, resumen y cuerpo en inglés;
- que la fuente y URL originales sigan presentes;
- que no se hayan introducido datos incompatibles con la información de partida;
- que no aparezcan precios, fechas, versiones, compatibilidades o funciones no respaldadas;
- que el texto no reproduzca bloques extensos del artículo original;
- que el aviso de adaptación aparezca una sola vez;
- que el contenido supere reglas mínimas de longitud, formato y estructura.

Si una comprobación falla, la pieza no se publica como `adapted`.

## Fallos y reintentos

Si la evaluación o la generación falla, la noticia debe conservar un estado seguro:

- `source-only` si no llegó a seleccionarse;
- `selected` si fue elegida pero la adaptación quedó incompleta.

Los fallos transitorios podrán reintentarse hasta dos veces más, con un mínimo de una hora entre intentos. Tras tres intentos fallidos totales, el sistema deja de reintentarlo automáticamente hasta que cambie la fuente o se restablezca manualmente el estado.

El sistema debe evitar bucles y conservar información de intento, resultado y fecha.

## Correcciones manuales

Cualquier corrección editorial manual tendrá prioridad sobre la generación automática.

Una adaptación corregida por una persona no debe ser sobrescrita posteriormente por la automatización.

Las entradas creadas por la automatización llevarán una huella del contenido generado. Si en una ejecución posterior el registro editorial ya no coincide con esa huella, se considerará que ha habido una edición manual y el sistema bloqueará nuevas sobrescrituras automáticas de esa pieza.

## Control de costes

El uso de IA debe mantenerse deliberadamente limitado.

Reglas iniciales:

- no enviar todas las noticias a la IA;
- no analizar dos veces una URL ya evaluada sin motivo;
- no regenerar una adaptación ya válida;
- separar evaluación breve de generación completa;
- evaluar como máximo 6 candidatas nuevas por ejecución horaria;
- generar como máximo 2 adaptaciones nuevas por ejecución horaria;
- permitir como máximo 1 búsqueda web de contraste de pago por noticia seleccionada;
- si hay más candidatas que el límite, priorizar las de mayor impacto y dejar el resto para ejecuciones posteriores;
- registrar consumo técnico suficiente para detectar aumentos anómalos;
- permitir cambiar el modelo y estos límites desde una configuración central sin reescribir el flujo.

No se establece un límite diario rígido que pueda bloquear una jornada excepcional con varias noticias importantes. El límite principal se aplica por ejecución para impedir avalanchas accidentales.

## Integración con OpenAI

La automatización de GitHub Actions utilizará la API de OpenAI mediante una clave almacenada exclusivamente como secreto del repositorio.

La clave:

- no se incluirá en el código;
- no se expondrá en `actualidad.json`;
- no llegará a la web ni a Android;
- no se imprimirá en logs.

La integración debe encapsularse detrás de un módulo propio para poder cambiar de modelo o proveedor en el futuro sin rehacer el flujo editorial.

El modelo inicial será `gpt-5.6-luna`, por estar orientado a cargas sensibles al coste. El identificador quedará centralizado en configuración para poder sustituirlo sin tocar el resto del sistema. La integración usará respuestas estructuradas para evaluación y generación, y podrá habilitar búsqueda web únicamente en el paso de contraste previsto.

## Archivos y persistencia

La implementación mantendrá responsabilidades separadas:

- `actualidad-editorial.json`: seguirá siendo la fuente de adaptaciones editoriales que se fusionan con las noticias detectadas.
- `actualidad-auto-state.json`: almacenará el estado técnico de evaluación, intentos, huellas y resultados necesarios para evitar repeticiones y proteger ediciones manuales. No contendrá claves ni razonamientos internos.
- un archivo de directrices editoriales de TifloAcosta almacenará el tono, criterios de interés y reglas de redacción que se envían al modelo.
- una configuración central almacenará modelo, límites por ejecución y política de reintentos.

El estado automático se depurará junto con la retención de noticias para evitar crecimiento indefinido.

## Separación de responsabilidades

La implementación se dividirá en unidades pequeñas:

- filtro local de candidatas;
- cliente de IA;
- evaluador editorial;
- contrastador de fuentes;
- generador de adaptación bilingüe;
- validador;
- registro de resultados e intentos;
- integración con la sincronización de Actualidad.

Ningún módulo debe mezclar recogida de feeds, decisiones editoriales, generación y publicación en una sola función extensa.

## Datos editoriales y trazabilidad

Cada adaptación automática debe guardar metadatos suficientes para diagnóstico, sin incluir secretos ni razonamientos internos extensos.

Como mínimo:

- identificador de noticia;
- URL original;
- fecha de evaluación;
- resultado de evaluación;
- modelo utilizado;
- fecha de adaptación;
- resultado de validación;
- motivo de rechazo cuando corresponda;
- huella de la última adaptación automática válida;
- indicación de protección por edición manual, si existe.

No se almacenará cadena de pensamiento ni contenido sensible del proveedor.

## Publicación

Cuando una adaptación supera la validación:

1. se actualiza el registro editorial;
2. la pieza pasa a `adapted`;
3. se reconstruye `actualidad.json` mediante el flujo existente;
4. GitHub Actions publica los cambios;
5. web y Android consumen la misma versión adaptada.

El sistema no necesita lógica editorial separada para Android.

## Accesibilidad

El lector de noticias seguirá siendo texto limpio y semántico.

La adaptación no debe introducir elementos que generen ruido con VoiceOver, TalkBack, JAWS o NVDA. Los avisos técnicos de evaluación, modelo, reintentos o validación no se mostrarán al lector final.

## Pruebas necesarias

La implementación deberá incluir pruebas para:

- filtro local de ruido y duplicados;
- noticia importante seleccionada;
- noticia menor no seleccionada;
- fuente fiable sin segunda confirmación;
- noticia contrastada con segunda fuente;
- generación bilingüe completa;
- rechazo de una adaptación incompleta;
- rechazo de datos no respaldados cuando sean detectables por las reglas;
- preservación de una corrección manual;
- prevención de reevaluación duplicada;
- límites de evaluación, adaptación y contraste por ejecución;
- política de tres intentos totales;
- fallo de API y reintento seguro;
- ausencia de secretos en archivos y logs;
- integración final con `actualidad.json`.

Las pruebas del cliente de IA usarán respuestas simuladas. Los tests normales no deben consumir la API ni generar coste.

## Criterios de éxito inicial

La primera fase se considerará válida cuando:

- la recogida horaria continúe funcionando sin regresiones;
- una noticia de prueba claramente importante pueda completar automáticamente el flujo hasta `adapted`;
- las dos versiones resultantes sean legibles, fieles y naturales;
- una noticia irrelevante no genere una adaptación;
- un fallo de IA no rompa la publicación general de Actualidad;
- una edición manual quede protegida;
- el coste permanezca acotado por los filtros y límites previstos.

## Estrategia de puesta en marcha

El sistema se pondrá en producción con autonomía desde el principio, tal como se ha decidido, pero con trazabilidad suficiente para observar su comportamiento durante las primeras semanas.

Si aparecen problemas de selección, tono, longitud, fiabilidad o coste, se corregirán las reglas del sistema para mejorar las adaptaciones futuras. El objetivo no es introducir una aprobación manual permanente, sino aprender de los errores y endurecer el proceso cuando sea necesario.
