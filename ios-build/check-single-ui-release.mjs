/**
 * Fail-closed iOS release gate.
 * Internal TestFlight is a restricted technical acceptance stage, NOT App Store
 * approval. Physical-device VoiceOver acceptance is required for production,
 * but cannot logically precede installing a TestFlight build on the tester's iPhone.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const parent = fileURLToPath(new URL('../', import.meta.url));
const load = relative => readFile(join(parent, relative), 'utf8');
const [workflow, configText, sourceHtml] = await Promise.all([
  load('.github/workflows/ios-testflight.yml'),
  load('mobile/capacitor.config.json'),
  load('mobile/src/index.html')
]);
const config = JSON.parse(configText);
const mobileOnly = workflow.includes('node ../ios-build/prepare-mobile-ui.mjs') &&
                   !workflow.includes('npm run prepare:web') &&
                   !workflow.includes('tiflo-build-identity.json');
if (!mobileOnly || !/<main id="app" tabindex="-1"><\/main>/.test(sourceHtml) ||
    config.appId !== 'com.tifloacosta.app' || config.webDir !== 'dist' ||
    config.server?.url || config.server?.iosScheme !== 'capacitor' ||
    config.server?.hostname !== 'localhost') {
  throw new Error('BLOQUEO TESTFLIGHT: interfaz móvil única, identidad o origen persistente incompatibles.');
}
const isRestrictedBeta = process.env.TIFLO_INTERNAL_BETA === '1';
if (isRestrictedBeta) {
  if (process.env.GITHUB_REF_NAME !== 'preparacion-ios' ||
      !workflow.includes("branches: [preparacion-ios]") ||
      !workflow.includes("'ios-build/solicitud-testflight-20261014.txt'")) {
    throw new Error('BLOQUEO TESTFLIGHT: beta interna sólo desde rama y solicitud explícitas.');
  }
  // This stage is only an internal, reversible testing delivery. Remaining
  // build checks, native checks, signing, Apple upload and device acceptance
  // occur *after* this preflight. Never claim device acceptance here.
  console.log('TESTFLIGHT INTERNO: empaquetado móvil permitido para pruebas reales; NO aprobación App Store.');
  process.exit(0);
}
// An actual public release (or an ungated signed workflow) must still have
// evidence of VoiceOver checks and continuity of the existing iPhone library.
const approval = await load('ios-build/MOBILE-PARITY-ACCEPTED.json').catch(() => '');
if (!approval) throw new Error('BLOQUEO: falta aceptación completa de accesibilidad y datos en iPhone real.');
const verified = JSON.parse(approval);
if (verified.status !== 'approved' ||
    verified.nativeShare !== true ||
    verified.nativeReader !== true ||
    verified.existingLibraryPreserved !== true ||
    verified.voiceOverDeviceVerified !== true ||
    verified.mobileUiBuildVerified !== true) {
  throw new Error('BLOQUEO: la paridad móvil y la persistencia real aún no están certificadas.');
}
console.log('Validación completa de iOS verificada para distribución.');
