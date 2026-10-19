import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const f = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Aplicación y extensión comparten exactamente el mismo App Group', () => {
  const app = f('Sources/App.entitlements');
  const share = f('ShareExtension/ShareExtension.entitlements');
  const expected = 'group.com.tifloacosta.app';
  assert.ok(app.includes(expected));
  assert.ok(share.includes(expected));
  assert.ok(f('Sources/NativeShareInbox.swift').includes(expected));
  assert.ok(f('ShareExtension/ShareViewController.swift').includes(expected));
});
test('La preparación valida App Groups en ambos perfiles nuevos antes de firmar', () => {
  const script = f('scripts/create-appstore-profiles.mjs');
  assert.ok(script.includes('APP_GROUPS'));
  assert.ok(script.includes('com.apple.security.application-groups'));
  assert.ok(script.includes('group.com.tifloacosta.app'));
  assert.ok(script.includes('security'));
  assert.ok(script.includes('com.tifloacosta.app.ShareExtension'));
});
test('La IPA se inspecciona para rechazar firmas sin el App Group', () => {
  const python = f('scripts/verify-testflight-ipa.py');
  assert.ok(python.includes('embedded.mobileprovision'));
  assert.ok(python.includes('codesign'));
  assert.ok(python.includes('com.apple.security.application-groups'));
  assert.ok(python.includes('group.com.tifloacosta.app'));
});

test('XcodeGen escribe el App Group de forma explícita al regenerar los dos entitlements', () => {
  const project = f('project.yml');
  assert.equal(project.split('com.apple.security.application-groups:').length - 1, 2);
  assert.equal(project.split('- group.com.tifloacosta.app').length - 1, 2);
  assert.ok(project.includes('path: Sources/App.entitlements'));
  assert.ok(project.includes('path: ShareExtension/ShareExtension.entitlements'));
});
