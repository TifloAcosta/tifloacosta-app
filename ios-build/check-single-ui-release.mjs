/**
 * Fail-closed TestFlight gate. A native build can have any number of reusable
 * web libraries, but must contain exactly ONE mobile presentation source.
 * Do not weaken this gate to silence CI: port the native/data dependencies.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const parent = fileURLToPath(new URL('../', import.meta.url));
const load = relative => readFile(join(parent, relative), 'utf8');

const [workflow, prepScript, configText, sourceHtml] = await Promise.all([
  load('.github/workflows/ios-testflight.yml'),
  load('ios-build/prepare-web.mjs'),
  load('ios-build/capacitor.config.json'),
  load('mobile/src/index.html')
]);
const config = JSON.parse(configText);
const isMobileSource = workflow.includes('node ios-build/prepare-mobile-ui.mjs') ||
  workflow.includes('npm run prepare:mobile');
const isLegacyWebPackaging = workflow.includes('npm run prepare:web') ||
  prepScript.includes('await visit(root,output)');
if (!isMobileSource || isLegacyWebPackaging) {
  throw new Error(
    'BLOQUEO TESTFLIGHT: se empaqueta todavía la interfaz web pública. ' +
    'Se exige una única UI móvil y paridad nativa/datos antes de distribuir. ' +
    'Seguimiento: issue #210.'
  );
}
if (!/<main id="app" tabindex="-1"><\/main>/.test(sourceHtml) ||
    config.appId !== 'com.tifloacosta.app' ||
    config.server?.url) {
  throw new Error('La interfaz móvil o la configuración iOS no cumplen el contrato de origen local.');
}
const approval = await load('ios-build/MOBILE-PARITY-ACCEPTED.json').catch(() => '');
if (!approval) {
  throw new Error('BLOQUEO TESTFLIGHT: falta aceptación técnica verificable de funciones iOS y datos del lector.');
}
const checkpoint = JSON.parse(approval);
if (checkpoint.status !== 'approved' ||
    checkpoint.nativeShare !== true ||
    checkpoint.nativeReader !== true ||
    checkpoint.existingLibraryPreserved !== true ||
    checkpoint.voiceOverDeviceVerified !== true ||
    checkpoint.mobileUiBuildVerified !== true) {
  throw new Error('BLOQUEO TESTFLIGHT: la paridad móvil iOS y sus datos no están verificados.');
}
console.log('Preflight iOS de interfaz móvil única: superado.');
