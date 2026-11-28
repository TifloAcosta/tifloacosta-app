# Multicines: búsqueda federada e índices — 28-11-2026

## Cobertura real y solución implementada
Las 27 entradas del directorio tienen rutas desde Buscar obras. Cinco consultan datos de catálogo automáticamente y 22 ofrecen búsqueda externa explícita, conjunta o por proveedor. Los cuatro buscadores especializados están disponibles en la misma pantalla. No se cuenta una búsqueda web como confirmación de audiodescripción, acceso gratuito o reproducción. Los filtros de idioma y tipo limitan las fuentes pertinentes.

| Entrada | Método actual | Próximo paso para resultado nativo |
|---|---|---|
| Universo Audesc España | Índice local completo de árbol autorizado Drive | Confirmar permisos y formato de índice central; validar en dispositivo |
| Universo Audesc Latino | Mismo índice, raíz e idioma independientes | Igual |
| Audiocinemateca | Catálogo/versionado autenticado existente | Comprobar sesión y resultados; conservar caché de cuenta privada |
| Tape Territory | API autorizada existente | Verificar actualización y búsqueda real |
| Movies for the Blind | Catálogo público integrado existente | Verificar actualización y búsqueda real |
| Mercosur Audiovisual | Colección oficial AD y búsqueda web | Solicitar exportación/endpoint de metadatos AD |
| Cinema Accessibile | Sitio autorizado y búsqueda web | Acordar índice de cortos con responsable; permiso de enlace no implica permiso de republicación |
| RaiPlay Sound | Colecciones oficiales AD por categoría y búsqueda web | Buscar feed autorizado de títulos/episodios AD |
| Cineaudioteca Senza Barriere | Catálogo oficial y búsqueda web | Acordar exportación de títulos, respetar inscripción |
| Tela Brasil | Sitio oficial y búsqueda web | Confirmar AD por título y API pública |
| RTP Play | Colección oficial y búsqueda web | Solicitar filtro AD y catálogo autorizado |
| National Film Board of Canada | Colección oficial DV y búsqueda web | Explorar feed o API autorizada con filtro DV |
| PBS | Colección oficial y búsqueda web | Solicitar metadatos AD por programa/episodio |
| ABC iview | Colección oficial AD y búsqueda web | Solicitar catálogo oficial AD; acceso territorial |
| Norddeutsche Hörbücherei | Catálogo oficial y búsqueda web | Acordar consulta con inscripción y condiciones |
| Spcine Play | Sitio oficial y búsqueda web | Confirmar AD por título y feed autorizado |
| Tubi | Colección oficial, búsqueda web y ADP por proveedor | Acordar uso de datos ADP, comprobar región y gratuidad |
| BBC iPlayer | Colección oficial AD y búsqueda web | Solicitar acceso a metadatos de la colección, no usar API privada |
| RTVE Play: Campeones | Ficha editorial existente, buscador oficial y búsqueda web | Confirmar catálogo general AD por título; no inferir AD por coincidencia |
| Pluto TV | Colección oficial, búsqueda web y ADP por proveedor | Acordar uso de datos ADP, comprobar región |
| Plex | Colección oficial, búsqueda web y ADP por proveedor | Acordar uso de datos ADP, excluir alquiler/pago de resultados gratuitos |
| Play Suisse (DE) | Colección oficial AD y búsqueda web | Solicitar catálogo oficial de AD alemán y restricciones |
| AMI-tv y AMI+ | Sitio oficial y búsqueda web | Solicitar catálogo de programas con descripción integrada |
| AMI-télé | Sitio oficial y búsqueda web | Igual para francés |
| ARD Mediathek | Colección AD, buscador oficial con filtros y búsqueda web | Investigar acuerdo de metadatos; MediathekViewWeb como candidato, no confirmado |
| ARTE (francés) | Colección oficial AD y búsqueda web | Acordar catálogo francés AD |
| ARTE (alemán) | Colección oficial AD y búsqueda web | Acordar catálogo alemán AD |

## Índice Drive
Recorrido paginado sin límite global de 40 páginas, 20 segundos ni 100 coincidencias. Solicitudes de hasta 500 registros, reintentos transitorios, detección de ciclos/cursor repetido, progreso parcial y cancelación con checkpoint en memoria. Busca títulos de archivo y nombres de carpetas. Los accesos directos no resueltos se marcan incompletos para no atravesar raíces ajenas. Solo persiste metadatos de un recorrido completo en caché local protegida (sin resourceKey ni pageToken, ni archivos audiovisuales). Reutilización durante 15 min, copia anterior hasta 24 h etiquetada como desactualizada durante actualización. No sustituir copia completa por parcial. Si se deniega raíz, descartar copia. Al abrir resultado, comprobar árbol vivo desde raíz, obtener referencias actuales y verificar archivo; no se garantiza que una obra permanezca disponible. La primera construcción puede tardar; no afirmar cobertura completa si fallan páginas o carpetas.

## Índice central propuesto, todavía no activado
Solicitar confirmación de responsables de Audesc y demás fuentes para indexación central de metadatos; preferir exportación versionada del editor. La clave actual de Drive está restringida a iOS, no reutilizarla en servidor. Si se autoriza, servicio de indexación con credencial independiente y mínima, limitado a raíces aprobadas, paginación y reintentos; publicar únicamente metadatos permitidos, versión, fecha, idiomas, estado de cobertura, nunca claves ni audio. Guardar último índice íntegro, retirar títulos eliminados, validar autorización en reproducción. No subir catálogos autenticados de Audiocinemateca. No despliegue ni coste nuevo sin autorización. Búsqueda directa de los otros 22 requiere identificar API/feed autorizado o convenio; ruta externa es una alternativa funcional, no cumplimiento de búsqueda nativa total.

## Evidencias públicas consultadas
- Google Drive files.list: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
- Consulta por padre y paginación: https://developers.google.com/workspace/drive/api/guides/search-files
- ADP: https://adp.acb.org/adp-search y https://adp.acb.org/ad-faqs (incluye Tubi, Pluto, Plex; la búsqueda utiliza filtros observados title y provider_filter; combinación con título no validada desde esta sesión).
- Portal francés: https://audiodescription.beta.gouv.fr/recherche?is_free=1 (parámetro search observado en páginas paginadas; no se ha verificado respuesta de Titanic desde esta sesión).
- ARD: https://hilfe.ard.de/mediathek/aufbau-und-navigation-mt/suchfunktion-in-der-ard-mediathek/ y https://www.ardmediathek.de/suche
- RTVE: https://www.rtve.es/play/buscador/ y https://www.rtve.es/rtve/20260209/preguntas-frecuentes-sobre-rtve-play/16930366.shtml
- Rai: https://www.raiplaysound.it/generi/audiodescrizioni-film-fiction-programmi-c31adf5d-25c7-459a-9081-66a669298a39.html
- NFB: https://help.nfb.ca/accessibility/
- Cinema Accessibile: https://www.cinemaaccessibile.it/it/
- MediathekViewWeb (candidato, no desplegado): https://github.com/mediathekview/mediathekviewweb

## Validación
Consultar contratos de búsqueda y nueva integración CI. Probar catálogo real en iPhone: primer recorrido, título tardío, repetir búsqueda, cancelar y continuar, filtros de acento, categorías, obra retirada, errores, ausencia de sesión, VoiceOver. Titanic es caso de prueba, no título confirmado. La consulta de Google Drive conectada no devolvió archivos con nombre Titanic dentro de las raíces; no equivale a recorrido íntegro mediante API pública de la app. Sin cambios en main, TestFlight, producción o permisos de terceros.