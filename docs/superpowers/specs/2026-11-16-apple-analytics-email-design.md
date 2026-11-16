# Informes de App Store por correo — diseño aprobado

Fecha: 2026-11-16. Solicitante: Tony Acosta.

## Objetivo
Entregar a tonytenerife@gmail.com un resumen en español al detectar nuevos informes Apple Analytics de TifloAcosta; sin horario semanal fijo ni interacción manual habitual. Conservar consultas bajo demanda desde el chat.

## Alcance
- Reutilizar credenciales protegidas APPSTORE_ANALYTICS_* (solo lectura) y solicitud ONGOING b26b6c8c-d699-48b1-8b62-cd66071c81ee.
- Consultar nuevas instancias y segmentos de Analytics Reports cada seis horas, con horario expresado en UTC y sin prometer hora exacta.
- Descargar archivos .txt.gz, verificar integridad de segmentos cuando Apple proporcione checksum, filtrar TifloAcosta, agregar métricas de forma segura por granularidad y período.
- Generar texto en español con cifras, períodos completos y advertencias sobre disponibilidad, privacidad y opt-in.
- Enviar a tonytenerife@gmail.com **solo cuando existan nuevos datos procesados**; evitar reenvíos mediante marcador persistente por identidad de instancia/segmento.
- Permitir comprobación manual desde el chat reutilizando la misma cadena.
- No cambiar credenciales, versiones, TestFlight, respuestas de reseñas ni publicar en tiendas.

## Decisiones y límites
- Apple no emite webhook de nuevos informes: GitHub Actions realizará polling cada seis horas.
- El sistema ChatGPT Automations comprueba cada seis horas los datos procesados y usa la conexión Gmail existente para enviar desde y hacia tonytenerife@gmail.com. La búsqueda de enviados con identificadores de segmento evita duplicados; no se necesitan secretos SMTP nuevos. Ninguna clave privada ni informe bruto sensible se registrará en el repositorio.
- Datos faltantes no equivalen a cero; separar fecha de procesamiento y fecha de métrica; evitar sumas entre métricas diferentes.
- La cuenta remitente/destinataria tonytenerife@gmail.com fue confirmada por Tony y verificada en el conector Gmail. Enviar solo cifras realmente procesadas y contrastadas; no enviar si no se puede verificar la ausencia de duplicados.
- Los archivos analíticos pueden contener campos sujetos a privacidad; el correo debe ser un resumen agregado sin registros identificables.

## Opciones consideradas
1. Extender flujo GitHub existente y enviar correo: escogida por Tony; maximiza reutilización de la conexión y automatiza comprobaciones.
2. Crear infraestructura externa independiente: descartada por complejidad.
3. Informe fijo semanal en ChatGPT: sustituido por entrega al detectar informes nuevos.

## Criterios de aceptación
- Consultas a Apple vía APPSTORE_ANALYTICS_* sin la clave temporal.
- Primera ejecución sin datos nuevos: no envía correo.
- Datos nuevos: produce resumen español y realiza un solo envío; ejecución siguiente no duplica.
- Error de correo: conserva el informe pendiente para reintento.
- Error de Apple o privacidad: no inventa cifras ni envía informe engañoso.
- Comprobación desde este chat mediante logs y salida resumen de GitHub, sin abrir Chrome.
