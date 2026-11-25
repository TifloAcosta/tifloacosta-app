# Fallos de sincronización de Actualidad y YouTube

En las ejecuciones programadas 45647417526 (Actualidad) y 45545764738
(YouTube) la carga del artefacto devolvió un identificador válido. Menos de
un segundo después, el paso de despliegue informó de que no encontraba
`github-pages` en la ejecución. El fallo registrado está en la transición
entre la carga y el despliegue, no en la consulta del catálogo. La visibilidad
tardía del artefacto es una hipótesis verificable, no una causa interna de
GitHub confirmada. YouTube completó una ejecución posterior (45640113776).

La rama de desarrollo prepara una espera acotada que consulta el artefacto
por el identificador exacto de la carga, dentro de la misma ejecución. Ambos
trabajos de publicación quedan condicionados a la rama pública. Las pruebas
simulan visibilidad tardía, caducidad, identificadores distintos y agotamiento
de reintentos. Validar el efecto en un despliegue real requiere aplicar el
cambio al flujo público con autorización.

Registros:
- https://github.com/TifloAcosta/tifloacosta-app/actions/runs/45647417526
- https://github.com/TifloAcosta/tifloacosta-app/actions/runs/45545764738
- https://github.com/TifloAcosta/tifloacosta-app/actions/runs/45640113776
