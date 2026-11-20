# Mi música — diseño aprobado (20-11-2026)

## Objetivo
Reducir el recorrido de VoiceOver y facilitar el descubrimiento de música y emisoras sin perder funciones existentes.

## Acuerdos
- Jamendo muestra una selección inicial de temas y permite explorar por estilos, además de buscar.
- Canciones y emisoras anuncian título y artista/nombre, sin repetir «Reproducir» o «Escuchar» en cada elemento. Doble toque reproduce; las acciones de VoiceOver (deslizar arriba/abajo y activar) dan opciones contextuales para listas, favoritos, información y eliminación donde corresponda. Los controles deben seguir siendo utilizables sin VoiceOver.
- Ajustes de Mi música: la pantalla principal muestra solo categorías (Conexión, Información de VoiceOver, Copias de seguridad, Ecualizador). Cada una abre otra pantalla; volver conserva foco cuando sea viable.
- «Nubes» reemplaza los botones independientes Google Drive y Dropbox; ambos proveedores conservan sus funciones. OneDrive no se presentará hasta que exista integración funcional.
- «Plataformas musicales» aparece cerca del inicio de Mi música, después del reproductor.
- Radio: emisoras populares, por países, por idiomas, por estilos, búsqueda por nombre, búsqueda avanzada combinable y favoritas; cada opción evita listas largas de filtros en la pantalla principal.

## Restricciones
Una sola rama de trabajo feature/mi-musica; sin MEGA; conservar importaciones, listas, reproducción, accesibilidad y controles existentes. No enviar a App Store. Compilación/TestFlight únicamente después de verificación.

## Enfoques considerados
A) Listas extensas y filtros desplegados en una sola pantalla: menos navegación, pero sobrecarga el recorrido con VoiceOver.
B) Pantallas por categoría con acciones contextuales y búsqueda avanzada separada: elegido por claridad, extensibilidad y rapidez de recorrido.
