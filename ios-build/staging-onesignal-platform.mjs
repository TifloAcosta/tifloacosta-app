/**
 * Temporary staging compatibility shim for the pinned OneSignal Capacitor
 * dependency whose Swift package declares iOS 14, while its XCFramework
 * requires iOS 15+. Never edit node_modules in production without replacing
 * the dependency with an official compatible version and pinning its hash.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../mobile/node_modules/@onesignal/capacitor-plugin/Package.swift', import.meta.url));
let original;
try { original = await readFile(target, 'utf8'); }
catch { throw new Error('OneSignal Swift Package manifest not found in installed dependency'); }
if (/\.iOS\(\.v1[0-4]\)/.test(original)) {
  const updated = original.replace(/\.iOS\(\.v1[0-4]\)/g, '.iOS(.v15)');
  await writeFile(target, updated, 'utf8');
  console.log('Staging-only: raised OneSignal Swift Package iOS minimum to 15');
} else if (/\.iOS\(\.v(?:15|16|17|18)\)/.test(original)) {
  console.log('OneSignal Swift Package already declares iOS >= 15');
} else {
  throw new Error('Unknown OneSignal Swift Package minimum: inspect and fix dependency explicitly');
}
