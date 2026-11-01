import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../kokoro-prueba.html',import.meta.url),'utf8');
test('Kokoro pilot is opt-in and keeps existing TifloLector unchanged',()=>{
  assert.match(html,/id="generate"/);
  assert.match(html,/button\.addEventListener\('click',async/);
  assert.match(html,/KokoroTTS\.from_pretrained/);
  assert.match(html,/device:'wasm'/);
  assert.match(html,/ef_dora/);
  assert.match(html,/em_alex/);
  assert.match(html,/em_santa/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/URL\.createObjectURL\(blob\)/);
});
