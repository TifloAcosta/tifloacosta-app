import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = f => readFileSync(new URL('../Sources/'+f, import.meta.url),'utf8');
const account = read('NativeAudiocinematecaAccount.swift');
test('Audiocinemateca credentials are device-only and never reported as authenticated before validation',()=>{
  assert.match(account,/kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(account,/SecItemCopyMatching/);
  assert.match(account,/SecItemDelete/);
  assert.match(account,/SecureField/);
  assert.match(account,/textContentType\(\.password\)/);
  assert.match(account,/Credenciales guardadas de forma segura/);
  assert.doesNotMatch(account,/Acceso al catálogo pendiente de validación/);
  assert.doesNotMatch(account,/UserDefaults|AppStorage|print\(/);
  assert.match(read('NativeAccessibleCinema.swift'),/NativeAudiocinematecaBrowser\(\)/);
  assert.match(read('NativeAudiocinematecaBrowser.swift'),/NativeAudiocinematecaAccountScreen\(\)/);
});
test('official signup, password recovery and secure web fallback are available',()=>{
  for (const path of ['usuario/register','usuario/password','ayuda','contact']) assert.ok(account.includes('https://audiocinemateca.com/'+path));
  assert.match(account,/conserva esa protección/);
  for (const lang of ['en','pt','fr','it','de']) {
    const dict=read(lang+'.lproj/Localizable.strings');
    for (const key of ['Crear cuenta gratuita','Guardar credenciales','Olvidar credenciales','Cuenta de Audiocinemateca']) assert.ok(dict.includes('"'+key+'" = '),lang+' '+key);
  }
});
