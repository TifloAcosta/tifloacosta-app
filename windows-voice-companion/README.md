# Componente de voces TifloAcosta para Windows — prototipo técnico

Estado: **experimental, no instalable por usuarios finales**.

## Objetivo
Crear una base para detectar desde TifloLector web un servicio local independiente del navegador. Se ha elegido un servidor HTTP que solo escucha en 127.0.0.1, para no exigir inicialmente una extensión distinta para Chrome, Edge y Firefox. Compatibilidad con navegadores: **por comprobar**.

## Lo que hace esta versión
- Ruta GET /health con acceso desde los orígenes HTTPS concretos de TifloAcosta.
- Respuesta JSON que indica expresamente que no hay gestión de claves, proveedores ni síntesis.
- Niega solicitudes de orígenes ajenos y cualquier POST.
- Solo escucha en la interfaz local; no acepta conexiones de la red doméstica.

## Lo que NO hace
- No es instalador para Windows ni extensión de Chrome.
- No genera claves ni las almacena.
- No comprueba sesiones de Google ni genera voz.
- No tiene todavía un proceso de emparejamiento, permisos o autenticación para operaciones sensibles; no debe ampliarse con endpoints de credenciales sin diseñar esas defensas.
- No está conectado todavía a TifloLector web.

## Ejecución de desarrollo
En Windows, con Python 3.11+ instalado, abrir terminal en esta carpeta:
`python companion.py`

Tests:
`python -m unittest test_companion.py`

No ejecutar este prototipo con privilegios de administrador.

## Requisitos antes de conectar claves personales
1. Probar las restricciones actuales de acceso a loopback y CORS de Chrome, Edge, Firefox y Safari macOS.
2. Definir autenticación de la aplicación, consentimiento para cada operación y protección contra ataques de sitios externos (Origin no basta).
3. Cifrado de credenciales mediante Windows DPAPI ligado al usuario, sin devolución de secretos al navegador.
4. Permisos mínimos, límites de consumo, cancelación de trabajos, control de costos y registro sin datos sensibles.
5. Empaquetado, firma de instalador y accesibilidad con JAWS y NVDA.
6. Probar una muestra de audio con Google Gemini TTS en una cuenta personal de prueba, sin comprometer datos.

## Almacenamiento DPAPI preparado en esta fase
La biblioteca `credential_vault.py` cifra y descifra una clave por proveedor utilizando Windows DPAPI, asociada al usuario del sistema. Incluye guardar, leer internamente, comprobar si existe y borrar. **No hay endpoint HTTP para estas operaciones**: ninguna página web puede pedir, guardar ni recuperar claves mediante el prototipo.

Prueba para desarrolladores en Windows:
`python -m unittest discover -s windows-voice-companion -p "test_*.py"`

La prueba real del cifrado DPAPI requiere Windows; no se ha ejecutado con una cuenta personal de usuario. Todavía se requieren emparejamiento autenticado, autorización explícita, defensa contra CSRF y DNS rebinding, permisos de archivos, empaquetado y pruebas con JAWS antes de habilitar claves reales.
