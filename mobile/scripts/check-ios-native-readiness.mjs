import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const config = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
const buildScript = readFileSync(join(root, 'scripts/build.mjs'), 'utf8');
const iosSources = join(root, 'ios-native/ios/Sources');
const nativeFiles = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.swift$/.test(entry.name)) nativeFiles.push(path);
  }
}
walk(iosSources);
const swiftText = nativeFiles.map(path => readFileSync(path, 'utf8')).join('\n');
const checks = {
  webDirectoryConfigured: typeof config.webDir === 'string',
  htmlEntryPoint: existsSync(join(root, 'src/index.html')),
  htmlBundledForApp: /sourceHtml|bundledHtml|index\.html/.test(buildScript),
  swiftUiAppEntryPoint: /@main\s+(?:struct|class)|@main[\s\S]{0,160}\bApp\s*\{/.test(swiftText),
  swiftUiScreenArchitecture: /import SwiftUI/.test(swiftText)
};
const nativeReady = !checks.webDirectoryConfigured && !checks.htmlBundledForApp
  && checks.swiftUiAppEntryPoint && checks.swiftUiScreenArchitecture;
console.log(JSON.stringify({
  target: 'TifloAcosta iOS — native-only release readiness',
  nativeReady,
  checks,
  instruction: nativeReady
    ? 'Review screen coverage, VoiceOver and Xcode archive before uploading.'
    : 'STOP: the iOS app still depends on the HTML/Capacitor shell. Do not advertise this as native-only or send it as the clean replacement.'
}, null, 2));
if (process.argv.includes('--require-native') && !nativeReady) process.exitCode = 1;
