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

test('Google assistant gives direct official links and never requests a secret before secure integration',()=>{
 assert.match(html,/id="reading-google-provider"/);
 for(const id of ['reading-google-step-account','reading-google-step-key','reading-google-step-connect']) assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/https:\/\/aistudio\.google\.com\/api-keys/);
 assert.match(html,/https:\/\/ai\.google\.dev\/gemini-api\/docs\/api-key/);
 assert.match(html,/no pegues la clave en esta web/);
 assert.doesNotMatch(html,/id="reading-google-api-key-input"/);
});

test('local consumption preview is accessible and never sends text to a provider',()=>{
 assert.match(html,/id="reading-google-text-estimate"/);
 assert.match(html,/id="reading-google-text-estimate-result" role="status" aria-live="polite"/);
 assert.match(html,/id="reading-google-text-estimate-clear"/);
 assert.match(html,/googleEstimateInput\?\.addEventListener\('input', updateGoogleEstimate\)/);
 assert.match(html,/No se ha enviado ningún texto/);
});

test('Google beginner instructions do not pretend to create or store keys',()=>{
 assert.match(html,/Ayuda detallada para crear la clave con un lector de pantalla/);
 assert.match(html,/Google AI Studio puede preparar automáticamente un proyecto/);
 assert.match(html,/Google advierte que las claves privadas no deben exponerse/);
 assert.match(html,/no pegues la clave en esta web/);
});
