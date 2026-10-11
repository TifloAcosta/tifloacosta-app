import { readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname);
const source = resolve(root, 'native/TifloYouTubeViewController.swift');
const authSource = resolve(root, 'native/TifloYouTubeAuth.swift');
const actionSource = resolve(root, 'native/TifloYouTubeAccountControls.swift');
const iframeSource = resolve(root, 'native/tiflo-youtube-player.html');
const iframeTarget = resolve(root, 'ios/App/App/public/tiflo-youtube-player.html');
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
  'webView.loadHTMLString(html, baseURL: baseURL)',
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
const delegateWithAudio = delegateWithAuth.includes('import AVFAudio')
  ? delegateWithAuth
  : delegateWithAuth.replace('import UIKit', 'import UIKit\nimport AVFAudio');
const actionsBody = actions.replace(/^import UIKit\n/, '');
await writeFile(appDelegatePath, delegateWithAudio.trimEnd() + '\n\n' + swiftBody + '\n\n' + authBody + '\n\n' + actionsBody);
await copyFile(iframeSource, iframeTarget);

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
// Keep the iPhone Home Screen icon aligned with the published TifloAcosta
// identity, not Capacitor's generated default. This Xcode project is
// regenerated during every CI run, so the asset must be installed here.
const appIconSet = resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const appIconSource = resolve(root, '../tifloacosta-icon-512.png');
const appIconTarget = resolve(appIconSet, 'TifloAcosta-1024.png');
await rm(appIconSet, { recursive: true, force: true });
await mkdir(appIconSet, { recursive: true });
execFileSync('/usr/bin/swift', [
  resolve(root, 'make-app-icon.swift'), appIconSource, appIconTarget
], { stdio: 'inherit' });
const iconBytes = await readFile(appIconTarget);
if (iconBytes.length < 100 || iconBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    iconBytes.readUInt32BE(16) !== 1024 || iconBytes.readUInt32BE(20) !== 1024 ||
    iconBytes.readUInt8(25) !== 2) {
  throw new Error('El icono iOS de TifloAcosta debe ser PNG 1024x1024 RGB sin alfa');
}
await writeFile(resolve(appIconSet, 'Contents.json'), JSON.stringify({
  images: [{
    filename: 'TifloAcosta-1024.png',
    idiom: 'universal',
    platform: 'ios',
    size: '1024x1024'
  }],
  info: { author: 'xcode', version: 1 }
}, null, 2) + '\n');
console.log('Icono nativo iOS de TifloAcosta instalado: 1024x1024, sin transparencia');

console.log('Reproductor y autorización Google iOS instalados con retorno seguro');
