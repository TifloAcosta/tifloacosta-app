import assert from 'node:assert/strict';
import test from 'node:test';

const targets = [
  ['home', 'https://tifloacosta.com/', 'app-core.js?v=1.4'],
  ['app-core', 'https://tifloacosta.com/app-core.js?v=1.4', 'downloads-hub.js?v=1.0'],
  ['downloads-hub', 'https://tifloacosta.com/downloads-hub.js?v=1.0', 'Descargas']
];

test('diagnose public Descargas assets currently served through Cloudflare', async () => {
  for (const [name, url, marker] of targets) {
    const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
    const body = await response.text();
    console.log(JSON.stringify({
      name,
      status: response.status,
      contentType: response.headers.get('content-type'),
      cfCacheStatus: response.headers.get('cf-cache-status'),
      server: response.headers.get('server'),
      markerFound: body.includes(marker),
      bodyStart: body.slice(0, 80)
    }));
    assert.equal(response.status, 200);
    assert.ok(body.includes(marker), `${name} is missing ${marker}`);
  }
});
