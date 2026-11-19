# Correcciones de la auditoría funcional iOS

## Alcance

Trabajar exclusivamente sobre la base iOS consolidada de `feature/mi-musica`, sin nuevas ramas remotas ni envío a TestFlight. Las decisiones vinculantes son las de Tony de los días 16–19 de noviembre, más la especificación de «Mi música». Los acuerdos no recuperables deben quedar pendientes, no inventados.

## Orden de ejecución

1. **OCR multilingüe:** añadir selecciones manuales PT/FR/IT/DE sin reinterpretar índices antiguos; comprobar que el motor recibe el idioma solicitado y puede volver a detección automática cuando la plataforma no lo soporte.
2. **Enlaces accesibles:** dar carácter interactivo a los URL y enlaces externos estructurados en el texto del lector, conservando navegación entre enlaces y posición; probar sin depender de coincidencias accidentales.
3. **Muestra y perfiles por voz:** cambios pendientes aislados por identificador de voz, prueba antes de guardar, cancelar/restablecer y no alterar otras voces; cubrir compatibilidad con preferencias antiguas.
4. **Braille continuo:** impedir que el límite de fragmentos provoque una pausa o exija «Siguiente» al recorrer texto; conservar posición y rendimiento de documentos grandes.
5. **Mi música:** listas mixtas continuas, ecualizador por canción/lista/álbum, reglas inteligentes, destinos de copia, estructura de menú y fuentes remotas verificadas; sin simular integraciones de nube que aún no existen.
6. Revisar las demás decisiones y mantener un inventario de cobertura basado en comportamiento, no en mera presencia de cadenas.

Para cada punto: prueba de regresión RED, implementación mínima, prueba GREEN, suite completa y comprobación de compilación Swift en macOS antes de publicar una candidata.
