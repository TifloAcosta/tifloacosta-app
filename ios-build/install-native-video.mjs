import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const source = resolve(root, 'native/TifloYouTubeViewController.swift');
const appDelegatePath = resolve(root, 'ios/App/App/AppDelegate.swift');
const storyboardPath = resolve(root, 'ios/App/App/Base.lproj/Main.storyboard');

const appDelegate = await readFile(appDelegatePath, 'utf8');
const storyboard = await readFile(storyboardPath, 'utf8');
const player = await readFile(source, 'utf8');
if (!appDelegate.includes('import Capacitor') ||
    !storyboard.includes('customClass="CAPBridgeViewController"')) {
  throw new Error('No se reconoce el proyecto nativo Capacitor: no se modifica la compilación');
}
for (const required of [
  'bridge?.registerPluginInstance(TifloYouTubePlugin())',
  'CAPBridgedPlugin',
  'request.setValue(referer, forHTTPHeaderField: "Referer")',
  'UIAccessibility.post(notification: .screenChanged, argument: closeButton)'
]) {
  if (!player.includes(required)) throw new Error('Componente nativo incompleto: ' + required);
}
// AppDelegate.swift already belongs to the generated Xcode target. Append
// the native player there so it is compiled without manual .pbxproj edits.
const swiftBody = player.replace(/^import UIKit\nimport WebKit\nimport Capacitor\n(?:import AVFAudio\n)?/, '');
const delegateWithWebKit = appDelegate.includes('import WebKit')
  ? appDelegate : appDelegate.replace('import UIKit', 'import UIKit\nimport WebKit');
await writeFile(appDelegatePath, delegateWithWebKit.trimEnd() + '\n\n' + swiftBody);

// The Capacitor starter storyboard creates the default bridge by class name.
// Point that existing scene at the subclass that registers our native plugin.
const patchedStoryboard = storyboard.replace(
  /customClass="CAPBridgeViewController" customModule="Capacitor"/,
  'customClass="ViewController" customModule="App"'
);
if (patchedStoryboard === storyboard) {
  throw new Error('No se encontró la clase de la vista principal en el storyboard iOS');
}
await writeFile(storyboardPath, patchedStoryboard);
console.log('Reproductor nativo y controlador de navegación instalados en iOS');
