import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('la compilación sin firma tiene números de versión válidos para instalar la extensión en el simulador', () => {
  const project = fs.readFileSync(new URL('../project.yml', import.meta.url), 'utf8');
  assert.match(project, /MARKETING_VERSION: "1\.0"/);
  assert.match(project, /CURRENT_PROJECT_VERSION: "1"/);
  assert.match(project, /TifloAcostaShare:/);
  const prepare = fs.readFileSync(new URL('../scripts/prepare-testflight-project.mjs', import.meta.url), 'utf8');
  assert.match(prepare, /CURRENT_PROJECT_VERSION: "'\+version\+'"/);
});
