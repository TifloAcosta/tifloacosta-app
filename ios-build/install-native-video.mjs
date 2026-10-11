import { copyFile, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const source = resolve(root, 'native/TifloYouTubeViewController.swift');
const target = resolve(root, 'ios/App/App/ViewController.swift');

await stat(source);
const generated = await readFile(target, 'utf8');
if (!generated.includes('CAPBridgeViewController') || !generated.includes('class ViewController')) {
  throw new Error('No se reconoce el controlador de Capacitor 7 generado: se cancela la compilación');
}
const replacement = await readFile(source, 'utf8');
for (const required of [
  'bridge?.registerPluginInstance(TifloYouTubePlugin())',
  'CAPBridgedPlugin',
  'request.setValue(referer, forHTTPHeaderField: "Referer")',
  'UIAccessibility.post(notification: .screenChanged, argument: closeButton)',
]) {
  if (!replacement.includes(required)) throw new Error('Falta componente nativo: ' + required);
}
await copyFile(source, target);
console.log('Reproductor iOS nativo con Referer y controles accesibles instalado');
