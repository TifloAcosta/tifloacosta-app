import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('voice provider catalog is an optional accessible TifloLector settings subview',()=>{
 assert.match(html,/data-reading-view="reading-provider-view" aria-controls="reading-provider-view"/);
 assert.match(html,/id="reading-provider-view"[^>]*hidden/);
 assert.match(html,/id="reading-provider-heading" tabindex="-1"/);
 for(const name of ['Kokoro','Google','ElevenLabs','Microsoft Azure Speech','Amazon Polly']) assert.ok(html.includes('<summary>'+name));
 assert.match(html,/todavía no se pueden generar audios desde estos proveedores/);
 assert.match(html,/no se solicitan ni almacenan claves API/);
 assert.match(html,/id="reading-provider-status"/);
});
