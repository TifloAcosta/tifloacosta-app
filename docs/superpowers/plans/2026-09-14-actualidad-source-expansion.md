# Actualidad Source Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar el catálogo estable de fuentes de Actualidad con nuevas fuentes españolas y preparar BuscaApps como radar de descubrimiento sin romper la regla editorial de fechas.

**Architecture:** Las fuentes con fecha fiable siguen entrando por `actualidad-sources.json` y el sincronizador existente. BuscaApps se valida en un carril de descubrimiento separado porque su listado de novedades no ofrece una fecha original fiable; su parser produce identificadores estables y permite detectar elementos nuevos frente a un conjunto de IDs ya vistos, pero no publica todavía esas entradas en `actualidad.json`.

**Tech Stack:** Node.js 22, JavaScript ESM, GitHub Actions, feeds RSS/Atom y parsers HTML pequeños sin dependencias externas.

**Spec:** `docs/superpowers/specs/2026-09-14-actualidad-bilingual-multimedia-hub-design.md`

## Global Constraints

- Mantener aislada la rama móvil nativa.
- No inventar fechas para ninguna fuente.
- Destacadas sigue usando únicamente la fecha original y la ventana estricta de cinco días.
- El fallo de una fuente no debe vaciar el resto del feed.
- AppleVis Apps y AppleVis Blog deben mostrarse como procedencias distintas.
- BuscaApps debe detectar novedades sin duplicar IDs ya vistos, pero no se publicará en el feed general hasta la fase Apps.
- No añadir dependencias npm para parsear HTML o XML.

---

### Task 1: Diferenciar AppleVis y ampliar las fuentes españolas fechadas

**Files:**
- Modify: `actualidad-sources.json`
- Test: `test/actualidad-sync.test.mjs`

**Interfaces:**
- Consumes: esquema actual de fuentes `{id,name,homepage,feedUrl,lang,categories,maxItems?,enabled}`.
- Produces: fuentes `tecnoconocimiento-accesible`, `accytec`, `nvda-es`; nombres visibles `AppleVis Apps` y `AppleVis Blog`.

- [ ] **Step 1: Write the failing test**

Añadir una prueba que lea `actualidad-sources.json` y verifique:

```js
const byId = new Map(sources.map(source => [source.id, source]));
assert.equal(byId.get('applevis-apps').name, 'AppleVis Apps');
assert.equal(byId.get('applevis-blog').name, 'AppleVis Blog');
for (const id of ['tecnoconocimiento-accesible', 'accytec', 'nvda-es']) {
  assert.equal(byId.get(id)?.enabled, true);
  assert.equal(byId.get(id)?.lang, 'es');
  assert.ok(byId.get(id)?.feedUrl);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL porque las tres nuevas fuentes no existen y AppleVis aún comparte el nombre genérico.

- [ ] **Step 3: Update source configuration**

Configurar:

```json
{
  "id": "tecnoconocimiento-accesible",
  "name": "TecnoConocimientoAccesible",
  "homepage": "https://tecnoconocimientoaccesible.blogspot.com/",
  "feedUrl": "https://tecnoconocimientoaccesible.blogspot.com/feeds/posts/default",
  "lang": "es",
  "categories": ["tecnologia-accesibilidad", "programas-accesibles"],
  "maxItems": 8,
  "enabled": true
}
```

```json
{
  "id": "accytec",
  "name": "ACCYTEC - Accesibilidad y Tecnología",
  "homepage": "https://accesibilidadytecnologia.blogspot.com/",
  "feedUrl": "https://accesibilidadytecnologia.blogspot.com/feeds/posts/default",
  "lang": "es",
  "categories": ["tecnologia-accesibilidad"],
  "maxItems": 6,
  "enabled": true
}
```

```json
{
  "id": "nvda-es",
  "name": "NVDA en español",
  "homepage": "https://nvda.es/",
  "feedUrl": "https://nvda.es/feed/",
  "lang": "es",
  "categories": ["nvda", "windows", "tecnologia-accesibilidad"],
  "maxItems": 8,
  "enabled": true
}
```

Cambiar además `name` de `applevis-apps` a `AppleVis Apps` y de `applevis-blog` a `AppleVis Blog`.

- [ ] **Step 4: Run source validation and tests**

Run: workflow `Sync Actualidad TifloAcosta` on the branch plus `npm test`.
Expected: todas las fuentes habilitadas responden y las pruebas pasan. Si una URL no responde, corregir el endpoint real; no desactivar silenciosamente una fuente solo para poner verde el workflow.

- [ ] **Step 5: Commit**

Commit: `feat: expand Spanish Actualidad sources`

---

### Task 2: Parser estable para el radar BuscaApps

**Files:**
- Modify: `scripts/actualidad-feed.mjs`
- Modify: `test/actualidad-feed.test.mjs`

**Interfaces:**
- Produces: `parseBuscaAppsHtml(html, source) -> Array<{id,title,url,platform,summary}>`
- Produces: `detectNewDiscoveryItems(items, seenIds) -> Array<item>`
- Reuses: `canonicalizeUrl()` y `stableStoryId()`.

- [ ] **Step 1: Write failing parser tests**

Usar un fixture mínimo representativo:

```js
const html = `
<section>
  <h2><a href="/ficha/sonicroom">SonicRoom:</a> (Web)</h2>
  <p>Una plataforma de comunicación audiovisual accesible y de baja latencia</p>
  <h2><a href="https://www.buscaapps.com/ficha/pingkit">PingKit:</a> (iOS)</h2>
  <p>Herramienta accesible para pruebas de red.</p>
</section>`;
const items = parseBuscaAppsHtml(html, { id: 'buscaapps', homepage: 'https://www.buscaapps.com/' });
assert.equal(items.length, 2);
assert.equal(items[0].title, 'SonicRoom');
assert.equal(items[0].platform, 'Web');
assert.equal(items[0].url, 'https://www.buscaapps.com/ficha/sonicroom');
assert.match(items[0].id, /^buscaapps-[a-f0-9]{16}$/);
```

- [ ] **Step 2: Verify red**

Run: `node --test test/actualidad-feed.test.mjs`
Expected: FAIL porque `parseBuscaAppsHtml` aún no existe.

- [ ] **Step 3: Implement minimal robust parser**

El parser debe:
- encontrar encabezados `h2` que contengan enlace;
- limpiar los dos puntos finales del nombre;
- obtener la plataforma del texto restante entre paréntesis;
- resolver enlaces relativos con `source.homepage`;
- tomar el primer párrafo siguiente antes del próximo `h2` como resumen;
- canonicalizar la URL;
- generar ID estable con `stableStoryId(source.id, url)`;
- descartar elementos sin título o URL;
- deduplicar por ID.

- [ ] **Step 4: Add novelty detection test**

```js
const unseen = detectNewDiscoveryItems(items, new Set([items[0].id]));
assert.deepEqual(unseen.map(item => item.id), [items[1].id]);
```

La función debe aceptar `Set`, array o valor vacío y devolver solo IDs no vistos, deduplicados y conservando el orden de entrada.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: add BuscaApps discovery parser`

---

### Task 3: Validación real de fuentes de descubrimiento

**Files:**
- Create: `actualidad-discovery-sources.json`
- Create: `scripts/validate-actualidad-discovery.mjs`
- Modify: `.github/workflows/sync-actualidad.yml`
- Test: `test/actualidad-pages-deploy.test.mjs`

**Interfaces:**
- `actualidad-discovery-sources.json` contiene fuentes que todavía no publican directamente en `actualidad.json`.
- `validate-actualidad-discovery.mjs` descarga cada fuente habilitada, ejecuta su parser y falla si una fuente configurada no responde o devuelve cero elementos.

- [ ] **Step 1: Add failing workflow test**

Verificar que `sync-actualidad.yml` ejecute:

```text
node scripts/validate-actualidad-discovery.mjs
```

durante `validate-sources` en ramas `feature/actualidad-*`.

- [ ] **Step 2: Create discovery registry**

```json
[
  {
    "id": "buscaapps",
    "name": "BuscaApps",
    "homepage": "https://www.buscaapps.com/",
    "url": "https://www.buscaapps.com/",
    "format": "buscaapps-html",
    "lang": "es",
    "enabled": true
  }
]
```

- [ ] **Step 3: Implement validator**

`validate-actualidad-discovery.mjs` debe:
- leer el JSON;
- exigir `id`, `url` y `format`;
- usar `fetch` con user-agent `TifloAcosta-Actualidad/1.0 (+https://tifloacosta.com/)`;
- reintentar hasta tres veces por fuente;
- para `buscaapps-html`, llamar `parseBuscaAppsHtml`;
- fallar con mensaje que identifique la fuente si no se puede descargar o parsear;
- imprimir `Discovery source <id>: <N> items.` cuando sea válida.

- [ ] **Step 4: Wire branch validation**

En `validate-sources`, ejecutar primero la sincronización normal, luego `node scripts/validate-actualidad-discovery.mjs`, y finalmente `npm test`.

Añadir a los `paths` del workflow:
- `actualidad-discovery-sources.json`
- `scripts/validate-actualidad-discovery.mjs`

- [ ] **Step 5: Run real validation**

Expected: BuscaApps devuelve al menos una entrada real. Si el HTML actual difiere del fixture, ajustar el parser a la estructura real observada y añadir el caso a pruebas antes de modificar de nuevo la implementación.

- [ ] **Step 6: Commit**

Commit: `ci: validate Actualidad discovery sources`

---

### Task 4: Verificación de aceptación de la fase 2

**Files:**
- No production files unless a defect is found.

- [ ] **Step 1: Run full suite**

Run: `npm test`
Expected: 0 failures.

- [ ] **Step 2: Run live source validation**

Expected:
- las fuentes RSS/Atom/HTML habilitadas sincronizan;
- las nuevas fuentes españolas no vacían el feed aunque no tengan historias dentro de los últimos 90 días;
- BuscaApps produce al menos una entrada de descubrimiento;
- ninguna entrada de BuscaApps se escribe todavía en `actualidad.json`.

- [ ] **Step 3: Inspect generated feed**

Confirmar que las entradas de AppleVis usan `sourceName` distinto (`AppleVis Apps` / `AppleVis Blog`) y que las entradas recientes de NVDA en español o TecnoConocimientoAccesible aparecen con `lang: es` y categorías específicas cuando las palabras clave lo permitan.

- [ ] **Step 4: Compare branch to main**

Expected changed scope: fuentes, parser/validator, tests, workflow y este plan. Ningún archivo nativo Android/iOS.

- [ ] **Step 5: Open PR only after green evidence**

El PR resumirá fuentes activadas, BuscaApps como radar no publicable todavía y resultados exactos de pruebas/validación.