import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../kokoro-prueba.html',import.meta.url),'utf8');
test('Spanish Kokoro prototype never downloads an unsupported voice model',()=>{
 assert.match(html,/id="generate"[^>]*disabled/);
 assert.match(html,/biblioteca JavaScript utilizada todavía no admite las voces españolas/);
 assert.match(html,/ef_dora/);
 assert.match(html,/em_alex/);
 assert.match(html,/em_santa/);
 assert.match(html,/aria-live="polite"/);
 assert.doesNotMatch(html,/KokoroTTS\.from_pretrained/);
});
