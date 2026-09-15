# Buscador global de TifloAcosta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el buscador existente en un buscador global de TifloAcosta y retirar la búsqueda duplicada de la pantalla de Vídeos.

**Architecture:** Reutilizar el formulario existente y `search-accessibility.js` como capa de integración, sin crear catálogos paralelos. El script cargará las fuentes JSON públicas, normalizará resultados y los agrupará por tipo; en Vídeos, simplificará la interfaz dejando solo ordenación, catálogo y paginación.

**Tech Stack:** HTML, CSS, JavaScript sin dependencias, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-15-global-search-design.md`

## Global Constraints
- Un solo buscador visible, en Inicio.
- Buscar Recursos, Vídeos, Noticias, Apps accesibles y Escuchar y ver.
- Mantener español e inglés.
- Mantener navegación y anuncios accesibles para VoiceOver.
- No duplicar catálogos existentes.

---

### Task 1: Probar la búsqueda global y la limpieza de Vídeos

**Files:**
- Create: `test/global-search.test.mjs`
- Modify: `test/clean-home.test.mjs`

**Interfaces:**
- Consumes: `search-accessibility.js`.
- Produces: expectativas de búsqueda global, ubicación del formulario y ausencia de búsqueda interna visible en Vídeos.

- [ ] **Step 1: Write the failing test**
Crear pruebas que verifiquen coincidencias sin tildes, agrupación por tipo, filtrado por idioma y que la UI de Vídeos se simplifique.
- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL porque aún no existe la búsqueda global ni la limpieza de Vídeos.
- [ ] **Step 3: Commit**
Commit de las pruebas rojas.

### Task 2: Implementar el buscador global en Inicio

**Files:**
- Modify: `search-accessibility.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `window.TIFLO_RESOURCES`, `videos.json`, `actualidad.json`, `actualidad-apps.json`, `actualidad-media.json`, `window.TIFLO_ACTUALIDAD_CORE`.
- Produces: `searchAcrossSources(sources, query, lang)` y render accesible agrupado.

- [ ] **Step 1: Write minimal implementation**
Mover el bloque de búsqueda existente tras `#home-hero`, relabelarlo como búsqueda global, cargar fuentes una vez y renderizar resultados agrupados.
- [ ] **Step 2: Run tests and make sure they pass**
Run: `npm test`
Expected: PASS para lógica global y regresiones existentes.
- [ ] **Step 3: Commit**
Commit de búsqueda global funcional.

### Task 3: Simplificar Vídeos y espaciar controles

**Files:**
- Modify: `search-accessibility.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `#video-search-form`, `#video-clear`, `.video-sort-control`, `#video-pagination`.
- Produces: pantalla de Vídeos sin buscador duplicado, con ordenación y paginación separadas visualmente.

- [ ] **Step 1: Implement minimal UI cleanup**
Retirar del DOM el formulario de búsqueda y su botón de limpieza, renombrar el bloque de controles a “Ordenar vídeos” / “Sort videos” y añadir espaciado vertical.
- [ ] **Step 2: Run full test suite**
Run: `npm test`
Expected: PASS con 0 fallos.
- [ ] **Step 3: Commit**
Commit de limpieza de Vídeos.

### Task 4: Verificación y publicación

**Files:**
- Modify temporalmente: `.github/workflows/test-home-cleanup.yml` solo para ejecutar la rama de trabajo; restaurar antes de integrar.

**Interfaces:**
- Consumes: suite completa y workflow de GitHub Pages.
- Produces: `main` verificado y desplegado.

- [ ] **Step 1: Ejecutar pruebas en CI**
Expected: 0 fallos.
- [ ] **Step 2: Restaurar el trigger temporal del workflow**
Dejar el workflow como estaba en `main`.
- [ ] **Step 3: Comparar rama con `main`**
Confirmar que no está detrás y revisar archivos modificados.
- [ ] **Step 4: Fast-forward de `main`**
Actualizar `main` sin force.
- [ ] **Step 5: Verificar GitHub Pages**
Expected: jobs build y deploy en `success`.
