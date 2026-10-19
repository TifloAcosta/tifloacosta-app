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
test('El mismo proyecto main compila y se envía a TestFlight', () => {
 const build=get('.github/workflows/ios-native-swiftui-build.yml');
 const release=get('.github/workflows/ios-native-testflight-upload.yml');
 assert.match(build,/branches: \[main\]/);
 assert.match(release,/branches: \[main\]/);
 assert.match(build,/ios-app-native\/tests\/\*\.test\.mjs/);
 assert.match(release,/ios-app-native\/tests\/\*\.test\.mjs/);
 assert.match(release,/verify-native-testflight\.mjs/);
 assert.doesNotMatch(build+release,/nativeprototype|npx cap add ios|npx cap sync ios/);
});
