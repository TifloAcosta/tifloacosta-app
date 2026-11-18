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
  assert.equal((prepare.match(/MARKETING_VERSION: "1\.5"/g) ?? []).length, 2,
    'la aplicación y la extensión deben usar la misma versión, superior a la 1.3 cerrada');
});

test('el flujo de TestFlight no anuncia éxito ante un rechazo de altool', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
  assert.match(workflow, /UPLOAD FAILED\|Validation failed/);
  assert.match(workflow, /Apple ha rechazado el IPA/);
});
