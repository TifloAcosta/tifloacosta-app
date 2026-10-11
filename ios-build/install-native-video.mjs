import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname);
const source = resolve(root, 'native/TifloYouTubeViewController.swift');
const authSource = resolve(root, 'native/TifloYouTubeAuth.swift');
const actionSource = resolve(root, 'native/TifloYouTubeAccountControls.swift');
const infoPath = resolve(root, 'ios/App/App/Info.plist');
const appDelegatePath = resolve(root, 'ios/App/App/AppDelegate.swift');
const storyboardPath = resolve(root, 'ios/App/App/Base.lproj/Main.storyboard');

const appDelegate = await readFile(appDelegatePath, 'utf8');
const storyboard = await readFile(storyboardPath, 'utf8');
const player = await readFile(source, 'utf8');
const authentication = await readFile(authSource, 'utf8');
const actions = await readFile(actionSource, 'utf8');
if (!appDelegate.includes('import Capacitor') ||
    !storyboard.includes('customClass="CAPBridgeViewController"')) {
  throw new Error('No se reconoce el proyecto nativo Capacitor: no se modifica la compilación');
}
for (const required of [
  'bridge?.registerPluginInstance(TifloYouTubePlugin())',
  'CAPBridgedPlugin',
  'request.setValue(referer, forHTTPHeaderField: "Referer")',
  'UIAccessibility.post(notification: .screenChanged, argument: closeButton)',
  'TifloNativeYouTubeAccount.shared'
]) {
  if (!player.includes(required)) throw new Error('Componente nativo incompleto: ' + required);
}
// AppDelegate.swift already belongs to the generated Xcode target. Append
// the native player there so it is compiled without manual .pbxproj edits.
const swiftBody = player.replace(/^import UIKit\nimport WebKit\nimport Capacitor\n(?:import AVFAudio\n)?/, '');
const delegateWithWebKit = appDelegate.includes('import WebKit')
  ? appDelegate : appDelegate.replace('import UIKit', 'import UIKit\nimport WebKit');
// Both Swift units are appended to the generated, tracked AppDelegate target.
const authBody = authentication.replace(/^import UIKit\nimport AuthenticationServices\nimport CryptoKit\nimport Security\n/, '');
const delegateWithAuth = delegateWithWebKit.includes('import AuthenticationServices')
  ? delegateWithWebKit
  : delegateWithWebKit.replace('import UIKit', 'import UIKit\nimport AuthenticationServices\nimport CryptoKit\nimport Security');
const actionsBody = actions.replace(/^import UIKit\n/, '');
await writeFile(appDelegatePath, delegateWithAuth.trimEnd() + '\n\n' + swiftBody + '\n\n' + authBody + '\n\n' + actionsBody);

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
// The callback scheme belongs to the ASWebAuthenticationSession of this app;
// it is never an arbitrary custom URL consumed by the embedded web page.
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleURLTypes array', infoPath]);
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleURLTypes:0 dict', infoPath]);
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleURLTypes:0:CFBundleURLSchemes array', infoPath]);
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string tifloacosta', infoPath]);
console.log('Reproductor y autorización Google iOS instalados con retorno seguro');
