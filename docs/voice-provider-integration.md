# Contrato para proveedores de voz en TifloLector

Estado: propuesta técnica. No hay conectores externos activos.

## Principios
- Una ficha por proveedor, sin registros ni facturación obligatorios para el lector básico.
- Credenciales individuales. Nunca poner una clave compartida de TifloAcosta en el frontend.
- No solicitar una clave en la web hasta contar con un flujo probado de autorización y almacenamiento protegido.
- Cualquier intermediario deberá aislar credenciales por usuario, limitar su uso y permitir desconectar/revocar. Un proxy compartido sin autenticación y límites no es válido.
- Nunca transmitir documentos al proveedor sin consentimiento explícito; mostrar tratamiento de datos y estimación previa.
- La página pública no debe registrar claves ni texto de libros en herramientas analíticas, errores o consola.
- Presupuesto: TifloAcosta no paga síntesis. Los costes, límites y uso dependen de la cuenta del usuario.
- El asistente solo enlaza a pasos externos necesarios; no intenta inyectar formularios ni automatizar sesiones privadas de otra web.
- Ofrecer «Ya tengo cuenta/clave» y un retorno accesible al contexto anterior.

## Contrato conceptual de adaptador (no implementado)
- metadata(): id, nombre, idiomas, modalidades de coste y enlaces de ayuda.
- authStatus(): desconectado, listo, caducado, error; sin revelar secretos.
- connect(): flujo de autorización específico del proveedor.
- listVoices(): voces permitidas por cuenta e idioma.
- preview(voice, sample): audio con consentimiento y presupuesto.
- estimate(textLength, model): estimación según tarifas oficiales verificadas; no confundir caracteres y tokens.
- synthesize(document, voice, options): trabajo por segmentos/capítulos con controles de consumo.
- disconnect(): quitar credenciales de nuestra aplicación e indicar cómo revocarlas en el origen.

## Fases de validación
1. Catálogo y ayudas informativas sin manejo de credenciales.
2. Auditoría del flujo personal de Google AI Studio, incluidas cuotas y condiciones.
3. Seleccionar arquitectura viable: autorización delegada, credencial temporal o backend seguro autenticado. Rechazar claves persistentes en web pública o localStorage.
4. Prueba con cuenta propia y texto no sensible de muestra; verificar formatos, límites y errores.
5. Reproducción y conservación opcional de audio en TifloLector; iOS con pantalla bloqueada.
6. Auditoría con VoiceOver, TalkBack, NVDA y JAWS. Solo publicar conectores que funcionen realmente.

## Pendiente
No hay integración con Gemini TTS ni campo para introducir claves API. El contador local del asistente es solo un ensayo de caracteres; no genera voz, no estima precio y no envía texto.
