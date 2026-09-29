# TifloAcosta Android 1.3.4 — diseño visual, zonas seguras e imagen corporativa

Fecha: 2026-09-29
Estado: diseño conversacional aprobado; documento escrito pendiente de revisión final antes del plan de implementación
Rama de trabajo: `feature/tiflolector-1.3.4-reading-upgrade`
Plataforma: Android

## 1. Propósito

La aplicación Android debe dejar de sentirse como una interfaz funcional sin identidad visual y pasar a compartir claramente la imagen corporativa de TifloAcosta con la aplicación web, sin sacrificar accesibilidad, legibilidad ni navegación con TalkBack.

La revisión visual responde a problemas concretos detectados en uso real:

- el encabezado principal aparece demasiado cerca de la barra de estado, hora y cámara/recorte;
- el primer control de muchas pantallas, normalmente `Volver`, queda excesivamente arriba;
- las secciones carecen de separación vertical suficiente;
- grupos de acciones aparecen pegados, por ejemplo `Abrir fuente original` y `Compartir` en Actualidad;
- Contacto presenta enlaces sin una jerarquía visual satisfactoria;
- Privacidad no existe como sección propia en la aplicación Android;
- la aplicación móvil apenas utiliza color o recursos visuales de marca;
- la experiencia Android no transmite la misma identidad TifloAcosta que la web.

Este trabajo se hará dentro de la actualización 1.3.4, después de resolver la lectura TTS con pantalla bloqueada y antes de construir las nuevas interfaces de voces, OCR y traducción.

## 2. Criterios de éxito

La revisión se considerará correcta cuando:

- ningún encabezado, botón `Volver` ni primer control choque visualmente con barra de estado, cámara, recorte o zona superior del dispositivo;
- el contenido respete `safe-area-inset-top` y `safe-area-inset-bottom`, con un margen visual mínimo adicional coherente;
- todas las pantallas compartan una cabecera y espaciado consistentes;
- exista separación clara entre secciones, tarjetas y grupos de acciones;
- botones adyacentes tengan espacio suficiente y no se perciban como un único bloque accidental;
- Contacto esté dividido en grupos claros y legibles;
- Privacidad y accesibilidad aparezca como sección propia en Inicio;
- Android adopte la paleta corporativa de TifloAcosta basada en los colores de la web;
- exista una presencia de marca reconocible pero discreta mediante símbolo/logotipo y nombre;
- modo claro, oscuro y alto contraste mantengan contraste suficiente;
- tamaños grandes de texto no provoquen solapamientos, recortes ni pérdida de controles;
- TalkBack conserve encabezados, orden lógico, nombres accesibles, foco y controles nativos;
- los cambios visuales no introduzcan desplazamiento horizontal obligatorio.

## 3. Principios de diseño

### 3.1 Misma marca, interfaz móvil propia

Android reutilizará la identidad visual de la web, no su maquetación literal.

Se tomarán como base:

- rojo corporativo principal `#A61B1B`;
- rojo profundo `#7F1414`;
- superficies claras y oscuras equivalentes;
- bordes y estados de foco visibles;
- botones de acción coherentes;
- tarjetas con separación suficiente;
- símbolo y nombre TifloAcosta.

La interfaz seguirá patrones adecuados a una pantalla móvil y a escalado de texto.

### 3.2 Accesibilidad primero

El color nunca será el único medio de distinguir estado o función.

Los cambios visuales no modificarán el significado semántico de encabezados, botones, enlaces, formularios y regiones de estado.

Las animaciones o efectos visuales, si existen, serán secundarios y respetarán las preferencias del sistema.

### 3.3 Espaciado como sistema

No se corregirán pantallas una a una con márgenes arbitrarios.

Se definirá una escala reutilizable para:

- espacio superior de pantalla;
- separación entre cabecera y contenido;
- separación entre secciones;
- separación entre tarjetas;
- separación entre controles de un mismo grupo;
- separación entre grupos de controles;
- relleno interno de tarjetas y paneles.

## 4. Zona segura superior e inferior

El contenedor principal deberá respetar explícitamente las zonas seguras del sistema.

La parte superior usará una fórmula equivalente a:

`padding-top: calc(env(safe-area-inset-top) + espacio-base-superior)`

La parte inferior hará lo mismo con `safe-area-inset-bottom`.

El espacio base adicional evitará que, incluso en dispositivos sin recorte, el primer elemento parezca pegado al borde.

No se posicionarán encabezados con coordenadas absolutas que puedan invadir la barra de estado.

## 5. Cabecera de aplicación e identidad

### 5.1 Inicio

La pantalla principal mostrará una cabecera de marca compacta con:

- símbolo TifloAcosta;
- nombre `TifloAcosta`;
- color corporativo reconocible.

El símbolo será decorativo para TalkBack cuando el texto `TifloAcosta` ya proporcione el nombre, evitando lectura duplicada.

La cabecera no reemplazará el `h1` accesible de la pantalla ni alterará la jerarquía de encabezados.

### 5.2 Pantallas internas

Las pantallas internas conservarán una presencia de marca más discreta para no competir con el título de la sección.

El primer bloque contendrá:

1. botón `Volver`;
2. título de pantalla;
3. contenido.

Ese bloque tendrá suficiente separación respecto a la zona superior y al contenido siguiente.

## 6. Sistema de color

Se definirán variables CSS de aplicación inspiradas en la web:

- `--brand`;
- `--brand-deep`;
- `--background`;
- `--surface`;
- `--surface-alt`;
- `--text`;
- `--muted`;
- `--border`;
- `--accent`;
- `--button-bg`;
- `--button-text`;
- `--focus`.

### 6.1 Modo claro

Fondo claro, texto oscuro, rojo corporativo para marca y acciones, superficies distinguibles mediante borde y contraste.

### 6.2 Modo oscuro

Fondo oscuro, texto claro y una variante de rojo suficientemente luminosa para conservar contraste.

### 6.3 Alto contraste

Los modos de alto contraste o configuraciones visuales de TifloAcosta tendrán prioridad sobre la decoración de marca cuando sea necesario para legibilidad.

Sombras y degradados no serán necesarios para comprender estructura o estado.

## 7. Tarjetas, secciones y jerarquía

Las pantallas con varios elementos repetidos usarán tarjetas o bloques claramente separados.

Cada tarjeta tendrá:

- borde o superficie distinguible;
- relleno interno suficiente;
- margen con respecto a la siguiente;
- encabezado separado del cuerpo;
- grupo de acciones separado del contenido descriptivo.

Las secciones principales tendrán un espacio vertical mayor que los elementos internos de una misma sección.

No se usará una única línea continua de controles cuando el ancho disponible requiera varias filas.

## 8. Botones y grupos de acciones

Se creará una clase o componente común para grupos de acciones.

Los grupos usarán `display: flex` o `grid` con `gap`, permitiendo salto de línea.

Ningún botón dependerá de espacios de texto o márgenes accidentales para separarse del siguiente.

El tamaño táctil mínimo seguirá siendo cómodo y compatible con texto grande.

Los estados de foco serán claramente visibles.

## 9. Actualidad

Cada noticia seguirá siendo un artículo independiente.

Dentro de cada artículo:

- título;
- fuente y fecha;
- resumen;
- grupo de acciones.

El grupo de acciones reunirá, cuando existan:

- `Abrir fuente original`;
- `Compartir`;
- `Añadir a favoritos` / `Quitar de favoritos`.

Estos controles tendrán separación horizontal y vertical mediante `gap`, y podrán ocupar varias filas.

No aparecerán pegados al párrafo anterior ni entre sí.

## 10. Contacto

Contacto se reorganizará en bloques claramente diferenciados.

Estructura inicial:

- `Contacto directo`;
- `Redes sociales`;
- `Podcast y otros canales`, cuando proceda.

Cada destino será un botón/enlace independiente dentro de un grupo con separación suficiente.

No se presentarán todos los enlaces como una única línea visual.

Los destinos externos conservarán su semántica de enlace y comportamiento actual.

## 11. Privacidad y accesibilidad

Se añadirá `Privacidad y accesibilidad` como sección propia de la pantalla Inicio de Android.

La pantalla contendrá como mínimo:

- resumen de qué datos guarda localmente la aplicación;
- explicación de biblioteca local, posiciones, marcas, OCR y traducciones locales cuando corresponda;
- información sobre notificaciones y servicios externos cuando proceda;
- declaración breve de accesibilidad;
- enlace a la política completa de TifloAcosta.

El texto deberá describir la app Android real, no copiar sin adaptación el texto de privacidad de la web.

La incorporación de OCR y traducción deberá quedar reflejada antes de publicar la beta 1.3.4.

## 12. Inicio

Inicio incorporará `Privacidad y accesibilidad` al conjunto de secciones.

La lista de secciones mantendrá una estructura accesible de navegación y un espaciado visual uniforme.

La nueva cabecera de marca no añadirá ruido para lectores de pantalla.

## 13. Pantallas internas compartidas

`addScreenHeader()` evolucionará para producir una estructura visual reutilizable en todas las pantallas internas.

La solución deberá evitar tener que ajustar manualmente la posición superior en cada pantalla.

Las pantallas que no usan `addScreenHeader()` deberán adoptar el mismo patrón visual o una variante justificada.

## 14. Texto grande y reflow

Se probarán al menos los tamaños de texto ya ofrecidos por la aplicación y escalas grandes del sistema.

Requisitos:

- botones pueden crecer en altura;
- etiquetas pueden ocupar varias líneas;
- grupos de acciones pueden saltar de fila;
- tarjetas crecen verticalmente;
- no se fija altura de texto o botones cuando pueda truncar contenido;
- no hay desplazamiento horizontal como requisito normal de uso.

## 15. TalkBack y foco

La revisión visual no debe introducir contenedores interactivos innecesarios.

El foco seguirá este orden conceptual:

1. volver, cuando exista;
2. título de pantalla;
3. contenido principal;
4. acciones relacionadas con ese contenido.

Los cambios de color, bordes o tarjetas no crearán nodos accesibles adicionales.

Los iconos decorativos se ocultarán a servicios de accesibilidad cuando exista una etiqueta textual equivalente.

## 16. Integración con TifloLector 1.3.4

Esta revisión visual se ejecutará después de completar la corrección prioritaria de TTS en segundo plano y control multimedia.

Antes de implementar nuevas interfaces de:

- conseguir más voces;
- OCR;
- traducción;

la base visual y los componentes compartidos deberán estar listos, de modo que las nuevas funciones nazcan ya con el diseño definitivo.

## 17. Pruebas obligatorias

### 17.1 Zonas seguras

- dispositivo/emulador con barra de estado estándar;
- configuración con recorte/notch cuando sea posible;
- orientación y tamaños de ventana soportados;
- ningún primer control invade la zona superior.

### 17.2 Espaciado

- Inicio;
- Actualidad;
- Contacto;
- TifloLector;
- Configuración;
- Vídeos;
- pantallas con varios botones consecutivos.

Se verificará que tarjetas, botones y secciones tengan separación visible y consistente.

### 17.3 Tema y color

- modo claro;
- modo oscuro;
- ajustes de alto contraste de la app;
- estados de foco;
- controles deshabilitados;
- contraste de texto sobre superficies corporativas.

### 17.4 Texto grande

- tamaños internos normal, grande, extragrande y máximo;
- escalado de fuente del sistema elevado;
- botones multilínea;
- tarjetas con contenido largo;
- Contacto sin desbordamiento.

### 17.5 TalkBack

- Inicio mantiene una sola lectura útil de la marca;
- `Volver` aparece primero en pantallas internas;
- el encabezado recibe foco de forma predecible cuando corresponda;
- tarjetas no añaden ruido semántico;
- grupos de acciones mantienen nombres y orden correctos;
- Privacidad es localizable desde Inicio.

### 17.6 Regresión

La revisión visual no deberá romper:

- navegación;
- compartir;
- favoritos;
- apertura de enlaces externos;
- vídeo;
- biblioteca;
- TifloLector;
- ajustes visuales existentes;
- selección de idioma;
- restauración de foco.

## 18. Orden de implementación visual

1. Crear pruebas de estructura visual y contratos CSS compartidos.
2. Definir variables de marca, temas y escala de espaciado.
3. Corregir zona segura y contenedor principal.
4. Crear cabecera de marca de Inicio y cabecera interna reutilizable.
5. Crear componente/clases comunes para grupos de acciones y tarjetas.
6. Migrar Inicio y añadir Privacidad y accesibilidad.
7. Corregir Actualidad.
8. Rehacer Contacto por grupos.
9. Aplicar la base visual al resto de pantallas.
10. Verificar texto grande, temas, TalkBack y regresión.

## 19. Fuera de alcance

No se incluye en esta revisión:

- rediseñar el logotipo de TifloAcosta;
- convertir la app Android en una copia pixel a pixel de la web;
- añadir animaciones decorativas complejas;
- usar color como único indicador de estado;
- sustituir controles nativos por widgets visuales menos accesibles;
- ocultar contenido o funciones para simplificar únicamente la apariencia.

## 20. Resultado esperado

La 1.3.4 debe reconocer visualmente a TifloAcosta desde la primera pantalla, mantener esa identidad en el resto de la aplicación y, al mismo tiempo, resultar más clara y cómoda para usuarios con visión parcial, texto grande y TalkBack.

La mejora visual se considera parte de la calidad y accesibilidad de la aplicación, no un acabado cosmético posterior.