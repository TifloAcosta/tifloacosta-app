# ChatGPT → TestFlight: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Iniciar el workflow existente de TestFlight mediante una orden GitHub emitida desde ChatGPT, sin Chrome.

**Architecture:** Una incidencia de control recibe un comentario de la cuenta TifloAcosta. Un nuevo workflow `issue_comment` valida identidad, número de incidencia, sintaxis, rama explícita y duplicados; prueba primero en modo simulación. Solo una orden autorizada inicia por API el workflow actual. La publicación pública queda fuera.

**Tech Stack:** GitHub Issues, GitHub Actions, Node.js, GitHub REST API.
**Spec:** Diseño aprobado en conversación el 17-11-2026.

## Global Constraints
- No modificar secretos ni workflows actuales de publicación.
- Solo actor `TifloAcosta`, incidencia específica, comando exacto y rama permitida.
- No seleccionar `main` por defecto ni ejecutar comentarios arbitrarios como código.
- Fallar cerrado ante error, duplicados o falta de permisos.
- La primera prueba no compila ni envía nada a Apple.

## Review Focus
- Autor no autorizado: rechazar.
- Incidencia equivocada: ignorar.
- Rama inexistente: rechazar.
- Evento duplicado: impedir envío repetido.
- Token sin acceso a Actions: informar fallo sin declarar éxito.

### Task 1: Validación de órdenes
**Files:** Create `.github/scripts/chat-testflight-command.mjs`; Test `.github/scripts/chat-testflight-command.test.mjs`.
- [ ] Escribir pruebas para los cinco casos de riesgo y comando válido en simulación.
- [ ] Ejecutarlas y comprobar fallos por implementación ausente.
- [ ] Implementar parser puro y validación de entrada, sin ejecutar nada.
- [ ] Ejecutar pruebas y comprobar aprobación.

### Task 2: Receptor GitHub Actions
**Files:** Create `.github/workflows/chat-testflight-command.yml`.
- [ ] Crear disparador `issue_comment.created` con permisos mínimos `issues: read`, `contents: read`, `actions: write`.
- [ ] Usar validador de Task 1 y API oficial para iniciar `ios-native-testflight-upload.yml` en la rama explícita.
- [ ] Introducir modo simulación que nunca invoque la API de despacho.
- [ ] Ejecutar pruebas y verificar que no cambia el flujo de publicación.

### Task 3: Validación de extremo a extremo
**Files:** Create `docs/chat-testflight-commands.md`.
- [ ] Crear incidencia única de control y fijar su número.
- [ ] Enviar orden de simulación desde el complemento GitHub.
- [ ] Comprobar ejecución, rechazo de entradas inválidas y ausencia de envíos a Apple.
- [ ] Preparar PR revisable; no fusionar ni hacer envío real sin revisión y autorización.
