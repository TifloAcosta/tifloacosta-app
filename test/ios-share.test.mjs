import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../ios-build/ios-share.js', import.meta.url), 'utf8');
function bridge(plugin) {
  const window = { Capacitor: plugin ? { Plugins: { Share: plugin } } : {} };
  runInNewContext(script, { window, URL });
  return window.TifloIOSShare;
}

test('Compartir un recurso relativo usa su URL pública, nunca capacitor://localhost', async () => {
  let sent;
  const share = bridge({ share: async options => { sent = options; } });
  assert.equal(await share.shareURL({ title: 'Guía', url: 'recursos/guia.pdf' }), 'dismissed');
  assert.equal(sent.url, 'https://tifloacosta.com/recursos/guia.pdf');
  assert.equal(sent.title, 'Guía');
});

test('Compartir un enlace absoluto mantiene la dirección original', async () => {
  let sent;
  const share = bridge({ share: async value => { sent = value; } });
  await share.shareURL({ title: 'Vídeo', url: 'https://www.youtube.com/watch?v=abc' });
  assert.equal(sent.url, 'https://www.youtube.com/watch?v=abc');
});

test('No se comparten rutas locales, fragmentos ni protocolos inseguros', async () => {
  let calls = 0;
  const share = bridge({ share: async () => { calls++; } });
  for (const url of ['#interno', '//malicioso.example', 'javascript:alert(1)', 'file:///private/tmp/secret']) {
    assert.equal(await share.shareURL({ url }), 'unavailable');
  }
  assert.equal(calls, 0);
});

test('La cancelación del menú no se interpreta como envío realizado', async () => {
  const share = bridge({ share: async () => { throw new Error('Share canceled'); } });
  assert.equal(await share.shareURL({ url: 'https://tifloacosta.com/' }), 'cancelled');
});

test('Errores y ausencia de componente nativo se notifican sin simular éxito', async () => {
  const share = bridge({ share: async () => { throw new Error('No presenter'); } });
  assert.equal(await share.shareURL({ url: 'https://tifloacosta.com/' }), 'failed');
  assert.equal(await bridge(null).shareURL({ url: 'https://tifloacosta.com/' }), 'unavailable');
});

test('La integración se limita al empaquetado iOS', () => {
  const prepare = readFileSync(new URL('../ios-build/prepare-web.mjs', import.meta.url), 'utf8');
  const dependencies = JSON.parse(readFileSync(new URL('../ios-build/package.json', import.meta.url), 'utf8'));
  assert.equal(dependencies.dependencies['@capacitor/share'], '^7.0.0');
  assert.ok(prepare.includes("join(root, 'ios-build/ios-share.js')"));
  assert.ok(prepare.includes('<script src="ios-share.js"></script>'));
  assert.ok(prepare.includes("const oldResourceShare"));
  assert.ok(prepare.includes("article.dataset.tifloShareUrl"));
});
