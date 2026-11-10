import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const get = path => readFileSync(new URL('../../'+path, import.meta.url), 'utf8');
test('Existe una sola aplicación oficial iOS con dos targets firmables', () => {
 const p=get('ios-app-native/project.yml');
 const ids=p.match(/PRODUCT_BUNDLE_IDENTIFIER:/g) || [];
 assert.equal(ids.length,2);
 assert.match(p, /PRODUCT_BUNDLE_IDENTIFIER: com\.tifloacosta\.app\n/);
 assert.match(p, /PRODUCT_BUNDLE_IDENTIFIER: com\.tifloacosta\.app\.ShareExtension\n/);
 assert.doesNotMatch(p, /nativeprototype|nativevalidation/);
 assert.ok(get('ios-app-native/Sources/TifloAcostaNativeApp.swift').includes('@main'));
});
test('No hay rutas de construcción iOS híbridas ni proyectos SwiftUI paralelos', () => {
 assert.equal(existsSync(new URL('../../mobile/ios-swiftui',import.meta.url)),false);
 assert.equal(existsSync(new URL('../../.github/workflows/ios-voiceover-build-check.yml',import.meta.url)),false);
 assert.equal(existsSync(new URL('../../.github/workflows/ios-native-swiftui-check.yml',import.meta.url)),false);
 const mobile=JSON.parse(get('mobile/package.json'));
 assert.equal(mobile.scripts['sync:ios'],undefined);
 assert.equal(mobile.scripts['check:ios-native'],undefined);
 assert.ok(mobile.scripts['sync:android']);
 assert.ok(mobile.dependencies['@tifloacosta/ios-native']); // plugin legacy, no segundo app
});
test('El proyecto main compila automáticamente; TestFlight se ejecuta solo a petición expresa', () => {
 const build=get('.github/workflows/ios-native-swiftui-build.yml');
 const release=get('.github/workflows/ios-native-testflight-upload.yml');
 assert.match(build,/branches: \[main\]/);
 assert.match(release,/workflow_dispatch:/);
 // Una única candidata de iOS puede iniciarse mediante un cambio explícito
 // del propio workflow en la rama integrada; ningún push general lo ejecuta.
 if (/^\s+push:/m.test(release)) {
   assert.match(release,/integration\/ios-phases1-6-consolidated-20261110/);
   assert.match(release,/paths:\s*\n\s+- '\.github\/workflows\/ios-native-testflight-upload\.yml'/);
   assert.doesNotMatch(release,/^\s+push:\s*\n\s+branches:\s*\n\s+- main/m);
 }
 assert.doesNotMatch(release,/branches: \[main\]/);
 assert.match(build,/ios-app-native\/tests\/\*\.test\.mjs/);
 assert.match(release,/ios-app-native\/tests\/\*\.test\.mjs/);
 assert.match(release,/verify-native-testflight\.mjs/);
 assert.doesNotMatch(build+release,/nativeprototype|npx cap add ios|npx cap sync ios/);
});
