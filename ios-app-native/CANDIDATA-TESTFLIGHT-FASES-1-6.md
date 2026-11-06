# Candidata iOS: fases 1–6 — sin distribución

Esta rama se crea desde `audit/ios-phase6-integral-20261106`, que incorpora la fase 5, derivada a su vez de `fix/ios-reader-phase1-persistence-timer-20261106`. No se ha hecho merge a `main` ni se ha utilizado el flujo de firma y subida a TestFlight.

## Requisitos para considerar la candidata instalable

- [x] Conservar `com.tifloacosta.app` y `com.tifloacosta.app.ShareExtension`, sin crear otra app de Apple.
- [x] Conservar el App Group `group.com.tifloacosta.app`.
- [x] Configurar compilación automática *sin firma* de toda la candidata.
- [x] Añadir pruebas de contratos de identidad y funcionalidad de las fases anteriores.
- [ ] Confirmar último resultado de Actions para este commit concreto.
- [ ] Comprobar en App Store Connect el **número de compilación más reciente** y la versión de comercialización. El script existente propone MARKETING_VERSION `1.0` y una compilación calculada a partir del número de Actions: no subir sin comprobar que ambos son válidos para la app ya publicada.
- [ ] Verificar certificados, perfiles de app y extensión, capacidades y sesiones de Google/YouTube en compilación firmada.
- [ ] Resolver restricciones de redistribución de motores de voz y bibliotecas de exportación; la compilación de simulador no resuelve licencias.
- [ ] Confirmar recuperación y conservación de biblioteca, marcadores y posiciones con una copia de seguridad antes de sustituir la app instalada por TestFlight.
- [ ] Obtener decisión expresa sobre instalación por TestFlight. No ejecutar `ios-native-testflight-upload.yml` ni publicar en App Store en esta preparación.

## Procedimiento para pruebas posteriores

No desinstalar la app pública: TestFlight usa el mismo identificador y reemplaza la instalación. Antes de usarlo, efectuar copia de documentos y datos que no puedan recuperarse. Solo avanzar cuando haya una compilación firmada verificada y procesada por Apple, y se comunique su número exacto.

## Estado

Candidata de código preparada para validación automática. No se ha generado un IPA firmado ni se ha enviado una beta.
