import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const account = readFileSync(new URL('../Sources/NativeCloudAccount.swift', import.meta.url), 'utf8');

test('account store is a global component, independent of music', () => {
  assert.match(account, /final class NativeCloudAccountStore/);
  assert.match(account, /func connect\(provider: NativeCloudProvider\)/);
  assert.match(account, /func disconnect\(provider: NativeCloudProvider\)/);
  assert.match(account, /func validAccessToken\(for provider: NativeCloudProvider\)/);
  assert.doesNotMatch(account, /NativeMusicLibrary|NativeMyMusic/);
});

test('OAuth uses system browser, PKCE and independently checked state', () => {
  assert.match(account, /ASWebAuthenticationSession/);
  assert.match(account, /S256/);
  assert.match(account, /SHA256\.hash/);
  assert.match(account, /\$0\.name == "state" \}\)\?\.value == state/);
  assert.match(account, /code_verifier/);
  assert.match(account, /canceledLogin/);
});

test('sessions reside in device keychain and missing provider registration fails closed', () => {
  assert.match(account, /kSecClassGenericPassword/);
  assert.match(account, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.match(account, /SecItemDelete/);
  assert.match(account, /guard let configuration = configurations\[provider\]/);
  assert.doesNotMatch(account, /UserDefaults|print\(|NSLog\(|client_secret|case mega/);
});
