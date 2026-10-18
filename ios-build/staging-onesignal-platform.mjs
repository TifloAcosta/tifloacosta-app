/** Verify the official pinned OneSignal iOS 15+ SwiftPM manifest.
 * Never mutate node_modules for an App Store / TestFlight build.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../mobile/node_modules/@onesignal/capacitor-plugin/Package.swift', import.meta.url));
const packagePath = fileURLToPath(new URL('../mobile/node_modules/@onesignal/capacitor-plugin/package.json', import.meta.url));
const [manifest, pkg] = await Promise.all([
  readFile(target, 'utf8'),
  readFile(packagePath, 'utf8').then(JSON.parse)
]);
if (pkg.version !== '1.2.0' || !/platforms:\\s*\\[\\.iOS\\(\\.v15\\)\\]/.test(manifest) ||
    !manifest.includes('capacitor-swift-pm')) {
  throw new Error('OneSignal must be the unmodified official iOS 15+ SDK (1.2.0); refusing a temporary SwiftPM patch');
}
console.log('Official OneSignal 1.2.0 SwiftPM iOS 15+ manifest validated; node_modules unchanged');
