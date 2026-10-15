# Piloto nativo de acciones VoiceOver — 15 de octubre de 2026

## Objetivo
Determinar en un iPhone físico si acciones de VoiceOver asociadas directamente a filas UIKit aparecen en el rotor y se ejecutan con flic arriba/abajo y doble toque. El piloto NO sustituye las pantallas actuales.

## Referencia para volver atrás
- Rama inmutable de referencia: `backup/ios-before-voiceover-native-2026-10-15`.
- Código inicial: `27db00874745b0edf349b2c54c15ab4338971c4d`.
- Rama experimental: `feature/ios-voiceover-native-pilot-2026-10-15`.
- La versión habitual se conserva. No se han cambiado esquemas de datos ni contenido de la biblioteca; la web y Android no activan el piloto.
- No fusionar la rama experimental hasta superar las pruebas automatizadas y de simulador. No presentar el piloto como validado por VoiceOver sin prueba en dispositivo real.

## Funcionamiento experimental
1. Abrir TifloLector > Biblioteca en la compilación experimental de iOS.
2. Pulsar `Probar acciones nativas de VoiceOver`. Se abre una pantalla UIKit independiente con hasta 10 títulos reales de la página visible.
3. Colocar el foco VoiceOver en un título. Seleccionar `Acciones` en el rotor; usar flic arriba/abajo para recorrer Abrir, Más acciones, Cambiar título y Eliminar. Ejecutar con doble toque.
4. La selección cierra la pantalla de prueba y ejecuta la acción existente de la biblioteca. Eliminar sigue exigiendo su confirmación habitual.
5. Pulsar `Cerrar` para regresar sin cambios. El botón original y toda la biblioteca HTML permanecen accesibles.
6. Cambiar de pantalla, volver a Biblioteca y comprobar que no hay acciones residuales ni se altera el foco.

## Criterios de aceptación
- Las acciones se anuncian por título y el rotor actúa solo sobre el título enfocado.
- No hay confusiones entre títulos contiguos ni acciones de documentos anteriores.
- Abrir/Detalles/Renombrar/Eliminar ejecutan la operación correspondiente; Eliminar nunca borra sin confirmación.
- La interfaz original sigue funcionando si falla el complemento nativo; Android y web no muestran el botón.
- Tests de Node y compilación real de Xcode para simulador correctos. Los tests de CI no sustituyen la verificación del rotor en iPhone.

## Plan de reversión
- Si falla antes de publicar: no fusionar la rama; cerrar el PR. La rama `main` y la versión TestFlight actual quedan intactas.
- Si se fusionara más adelante: revertir mediante un nuevo commit/PR los cambios del piloto; recuperar el punto de partida en la rama de seguridad. No hacer `force push` a `main`.
- Si se distribuye una beta que falla: detener nuevas invitaciones/pruebas, volver a compilar el código de referencia con número de compilación mayor y publicar ese build en TestFlight. Una compilación previa disponible puede reinstalarse desde TestFlight si Apple sigue ofreciéndola. Confirmar que la biblioteca de usuario continúa intacta antes de cualquier cambio más amplio.
- No modificar almacenamiento ni migrar documentos en este piloto.

## Límites
La demostración afecta solo a acciones del rotor en una lista. Los controles `ajustables` con flic directo son otro mecanismo nativo y requerirán una segunda comprobación. Tampoco demuestra todavía la accesibilidad en todas las secciones: aporta una base reutilizable para decidir su extensión.

## Distribución
El repositorio contiene una comprobación de Xcode para simulador, pero no un flujo visible de envío automático a TestFlight en `main`. No afirmar que se ha publicado en TestFlight basándose únicamente en un CI verde.
