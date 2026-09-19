# Diseño: Descargas como centro de herramientas y buscador de sonidos

Fecha: 2026-09-19

## Objetivo

Convertir el apartado actual de Descargas en un pequeño centro de herramientas dentro de TifloAcosta. El usuario podrá seguir descargando desde un enlace como hasta ahora y, además, acceder a una nueva herramienta para buscar sonidos descargables.

La nueva herramienta debe permitir dos formas de descubrimiento que convivan entre sí:

1. Buscar por término libre, por ejemplo: «campana», «teléfono antiguo», «sirena», «búho» o «notificación».
2. Explorar por categorías, por ejemplo: tonos de llamada, notificaciones, alarmas, teléfonos, tecnología, naturaleza, animales, ambiente, divertidos o juegos.

Ambos caminos deben poder combinarse. Un usuario podrá entrar en «Notificaciones» y buscar «campana», o entrar en «Animales» y buscar «búho».

## Alcance de esta primera versión

### Centro de Descargas

El acceso principal «Descargas» dejará de abrir directamente el formulario de enlace y pasará a mostrar dos opciones:

- Descargar desde un enlace.
- Buscar sonidos.

«Descargar desde un enlace» conservará todo el comportamiento ya existente: análisis de páginas, formatos, tamaños, descarga, tratamiento de bloqueos 403 y apertura externa cuando sea necesario.

### Buscar sonidos

La vista «Buscar sonidos» incluirá:

- un campo de búsqueda por texto;
- un selector o lista de categorías accesibles;
- un filtro de banco/proveedor, con «Todos los bancos» como opción inicial para proveedores con búsqueda interna compatible;
- una lista de resultados;
- reproducción previa cuando el proveedor ofrezca una URL de preescucha fiable;
- descarga directa cuando el proveedor lo permita sin autenticación especial;
- apertura en el banco original cuando la descarga directa no sea viable;
- una zona «Explorar otros bancos» para fuentes útiles que no dispongan de una búsqueda interna estable desde TifloAcosta;
- regreso explícito al centro de Descargas.

## Proveedores

La integración será progresiva y basada en capacidades reales, no en suposiciones.

### Freesound

Será el primer proveedor de búsqueda interna porque dispone de API oficial para localizar sonidos y recuperar metadatos útiles, como nombre, duración, etiquetas, licencia y enlaces de preescucha.

Para la primera versión no se gestionará OAuth2 de usuarios ni descarga autenticada del archivo original. Cuando la descarga original requiera autenticación o permisos especiales, TifloAcosta abrirá el recurso en Freesound.

### Mixkit

Se utilizará como fuente adicional para categorías y descubrimiento cuando su estructura permita enlaces estables y verificables. No se dependerá de scraping frágil como requisito esencial del funcionamiento.

Si no existe una vía estable para ofrecer resultados internos, TifloAcosta presentará accesos organizados a sus categorías o páginas relevantes dentro de «Explorar otros bancos».

### Pixabay

Podrá aparecer como banco adicional mediante enlaces organizados cuando sea útil. No se asumirá una API de sonidos si no existe una interfaz oficial documentada y estable para ello. En ese caso aparecerá en «Explorar otros bancos» y no se mezclará artificialmente con resultados internos.

### Regla general de proveedores

Cada proveedor debe declarar qué capacidades ofrece a TifloAcosta:

- búsqueda interna;
- categorías;
- preescucha;
- descarga directa;
- apertura externa;
- licencia disponible;
- tamaño disponible;
- formato disponible.

La interfaz solo mostrará acciones que el proveedor pueda soportar de forma fiable.

Los proveedores se dividirán funcionalmente en dos grupos:

1. Proveedores buscables: pueden devolver resultados internos normalizados.
2. Proveedores explorables: ofrecen categorías, páginas o colecciones útiles, pero requieren abrir el banco original para continuar.

Esta distinción evita prometer una búsqueda agregada donde técnicamente no exista.

## Modelo de resultados

Cada sonido de un proveedor buscable se normalizará a una estructura común, independientemente del banco de origen. Como mínimo:

- id estable dentro del proveedor;
- nombre;
- proveedor;
- URL de la página original;
- URL de preescucha, si existe;
- URL de descarga directa, si existe y puede ofrecerse legal y técnicamente;
- duración, si existe;
- formato, si existe;
- tamaño, si existe;
- categoría o etiquetas;
- licencia o condiciones resumidas, si existen;
- autor o creador, cuando el proveedor lo exponga y sea relevante para la licencia.

Los datos ausentes se mostrarán como «No disponible» o se omitirá el campo cuando sea más limpio para lector de pantalla. Nunca se inventarán tamaños, formatos, licencias ni duraciones.

## Presentación de cada resultado

El orden accesible recomendado será:

1. Nombre del sonido.
2. Duración.
3. Formato.
4. Tamaño.
5. Banco de procedencia.
6. Licencia o condiciones resumidas.
7. Autor, cuando proceda.
8. Escuchar.
9. Descargar o Abrir para descargar.

No todos los campos aparecerán siempre. La interfaz debe evitar anunciar información vacía o repetitiva.

## Reproducción previa

La reproducción se hará con controles HTML nativos o una capa mínima y accesible sobre ellos.

Requisitos:

- botón claramente etiquetado para reproducir/pausar;
- sin reproducción automática;
- el foco no se moverá inesperadamente al comenzar o terminar el audio;
- un sonido nuevo podrá detener el anterior para evitar varias reproducciones simultáneas;
- VoiceOver, JAWS, NVDA y TalkBack deben poder identificar el nombre del sonido asociado al control.

## Categorías iniciales

La primera versión puede incluir:

- Tonos de llamada.
- Notificaciones.
- Alarmas.
- Teléfonos.
- Tecnología.
- Naturaleza.
- Animales.
- Ambiente.
- Divertidos.
- Juegos.

Las categorías de TifloAcosta son una capa propia. Cada proveedor podrá traducirlas a sus etiquetas, términos o categorías equivalentes.

## Búsqueda y filtros

La búsqueda tendrá estas reglas:

- el término libre es opcional si se ha elegido una categoría;
- la categoría es opcional si existe un término de búsqueda;
- debe existir al menos un término o una categoría antes de buscar;
- «Todos los bancos» consultará únicamente proveedores buscables, habilitados y compatibles;
- el usuario podrá limitar los resultados a un banco buscable concreto;
- los resultados se combinarán sin mezclar ni ocultar la procedencia;
- los errores de un proveedor no deben anular resultados válidos de otros;
- los proveedores explorables se mostrarán aparte como alternativas de navegación, no como falsos resultados de búsqueda.

Ejemplo: una búsqueda «campana» dentro de «Notificaciones» podrá devolver resultados internos de Freesound y, además, mostrar accesos relacionados de Mixkit o Pixabay en «Explorar otros bancos» cuando existan páginas útiles para esa categoría.

## Orden de resultados

La primera versión no intentará crear un algoritmo complejo de relevancia global entre bancos.

Se priorizará:

1. coincidencia con término y categoría;
2. resultados con preescucha disponible;
3. resultados con información de licencia clara;
4. resultados con descarga directa fiable;
5. orden propio del proveedor como desempate.

No se presentarán valoraciones editoriales como «mejor sonido» o «recomendado» sin una base objetiva explícita.

## Licencias y atribución

TifloAcosta no almacenará ni redistribuirá colecciones de sonidos de terceros como si fueran propias.

Cada resultado conservará su procedencia y, cuando el proveedor facilite licencia o atribución, esa información se mostrará de forma accesible antes de la descarga o apertura externa.

Si una licencia exige atribución, se ofrecerá al usuario el texto necesario o un enlace claro a las condiciones del proveedor cuando sea posible.

Si no se puede conocer la licencia con seguridad, TifloAcosta no la describirá como libre de uso.

## Seguridad y enlaces externos

Cuando sea necesario abrir el banco original:

- se informará de que el usuario sale de TifloAcosta;
- se abrirá la URL original en nueva pestaña o navegador externo según la plataforma;
- se utilizará `noopener noreferrer` en web;
- TifloAcosta no solicitará ni almacenará credenciales del banco externo;
- se mantendrá un camino claro de regreso a Descargas.

## Accesibilidad

La función se diseñará primero para navegación con lector de pantalla.

Requisitos mínimos:

- encabezados semánticos reales;
- etiquetas explícitas para búsqueda, categoría y proveedor;
- resultados como unidades navegables con nombre significativo;
- mensajes de estado con `aria-live` sin duplicaciones innecesarias;
- ningún cambio de filtro moverá el foco de forma inesperada;
- al ejecutar una búsqueda, el foco podrá dirigirse al encabezado de resultados una vez cargados;
- si no hay resultados, el mensaje se anunciará y el foco quedará en un punto lógico;
- todos los botones de reproducción y descarga incluirán el nombre del sonido;
- siempre habrá un botón «Volver» al comienzo de las vistas interiores;
- la versión inglesa tendrá textos equivalentes y no traducciones parciales.

## Arquitectura propuesta

### Navegación

El hash o enrutado existente se ampliará para distinguir al menos:

- `#downloads`: centro de Descargas;
- `#downloads-link`: Descargar desde un enlace;
- `#downloads-sounds`: Buscar sonidos.

Si el sistema actual hace más conveniente otra convención, se mantendrá el mismo principio: vistas separadas, regreso predecible y enlaces profundos estables.

### Módulos

Se evitará sobrecargar `downloads.js` con toda la funcionalidad nueva.

Separación propuesta:

- módulo de centro/navegación de Descargas;
- módulo existente de descarga desde enlace;
- `sound-search-core.js`: normalización, categorías, filtros y lógica independiente del DOM;
- `sound-search.js`: interfaz, foco, reproducción y renderizado;
- adaptadores de proveedor, empezando por Freesound;
- configuración de endpoints y proveedores separada del código de interfaz.

### Backend / proxy

Las claves privadas de proveedores no deben exponerse en JavaScript del navegador.

Si Freesound u otro banco requiere token para búsquedas, se utilizará un Worker/endpoint de TifloAcosta que:

- reciba término, categoría y filtros permitidos;
- consulte el proveedor con la credencial en secreto;
- normalice o limite la respuesta;
- aplique CORS a los orígenes autorizados de TifloAcosta en web y, cuando se incorpore la función móvil, contemple explícitamente los orígenes o el mecanismo de red utilizado por Android;
- no almacene consultas personales ni credenciales de usuarios;
- imponga límites razonables para evitar abuso.

Se valorará reutilizar la infraestructura del Worker de Descargas o crear un Worker específico solo si la separación mejora seguridad y mantenimiento.

## Rendimiento

- resultados iniciales limitados a una cantidad razonable, por ejemplo 20 por búsqueda combinada;
- paginación o «Mostrar más» en lugar de cargar cientos de sonidos;
- consultas paralelas a proveedores con límites y timeout independientes;
- un proveedor lento no bloqueará toda la búsqueda;
- las preescuchas no se descargarán hasta que el usuario las reproduzca;
- no se calcularán tamaños mediante descargas completas.

## Estados y errores

La interfaz distinguirá al menos:

- buscando;
- resultados encontrados;
- sin resultados;
- proveedor temporalmente no disponible;
- búsqueda parcial: algunos bancos respondieron y otros no;
- apertura externa necesaria;
- error general recuperable.

Siempre que existan resultados de al menos un proveedor, se mostrarán aunque otro haya fallado.

## Privacidad

TifloAcosta no almacenará un historial personal de búsquedas en la primera versión.

Las consultas se enviarán únicamente a los proveedores necesarios o al proxy de TifloAcosta que los consulte. No se asociarán a cuentas de usuario dentro de la app.

## Internacionalización

La interfaz será bilingüe español/inglés desde la primera versión.

Las categorías de TifloAcosta tendrán nombres propios en ambos idiomas. Las búsquedas escritas por el usuario se enviarán tal cual inicialmente, salvo que un proveedor requiera una traducción o mapeo de categoría conocido.

No se traducirán automáticamente nombres de sonidos, autores o licencias si hacerlo puede alterar la información original.

## Fuera de alcance de la primera versión

- cuentas propias de usuario para bancos de sonidos;
- OAuth2 de Freesound para descargar archivos protegidos;
- favoritos sincronizados;
- colecciones personales de sonidos;
- edición, recorte o conversión de audio dentro de TifloAcosta;
- establecimiento automático del archivo como tono del sistema;
- almacenamiento permanente de sonidos de terceros en servidores de TifloAcosta;
- scraping como dependencia principal de proveedores sin API estable.

## Evolución posterior

Una vez estable la búsqueda de sonidos, Descargas podrá crecer con nuevas herramientas sin cambiar de nuevo su estructura principal. Posibles ampliaciones futuras:

- guía para poner un sonido como tono en iPhone y Android;
- conversión accesible de formatos propios del usuario;
- favoritos locales;
- historial opcional y local;
- nuevos bancos con API oficial;
- colecciones temáticas creadas a partir de enlaces de proveedores externos.

## Criterios de aceptación funcionales

La primera versión se considerará válida cuando:

1. «Descargas» muestre claramente las opciones «Descargar desde un enlace» y «Buscar sonidos».
2. La herramienta actual de enlaces siga funcionando sin regresiones.
3. «Buscar sonidos» permita buscar por texto, por categoría o combinando ambos.
4. Exista al menos un proveedor con búsqueda interna real y estable.
5. Cada resultado identifique claramente su proveedor.
6. Los resultados con preescucha puedan escucharse de forma accesible.
7. Cada resultado ofrezca descarga directa o apertura externa según capacidades reales.
8. Se muestre licencia/condiciones cuando el proveedor las facilite.
9. Los fallos parciales no eliminen resultados válidos de otros proveedores.
10. Los bancos sin búsqueda interna estable aparezcan como opciones explorables sin confundirse con resultados internos.
11. La navegación con VoiceOver, JAWS, NVDA y TalkBack tenga foco predecible y botones correctamente etiquetados.
12. La interfaz funcione en español e inglés.
13. Las credenciales privadas de APIs no aparezcan en el frontend.

## Estrategia de pruebas

- pruebas unitarias de normalización y filtros;
- pruebas por proveedor con respuestas simuladas;
- pruebas de errores parciales y timeouts;
- pruebas de accesibilidad estructural y foco;
- pruebas de que ninguna clave privada aparece en archivos públicos;
- pruebas de regresión de «Descargar desde un enlace»;
- prueba manual con lector de pantalla en web antes de llevar cambios equivalentes a Android;
- comprobación real de búsqueda, preescucha y apertura/descarga con cada proveedor habilitado.
