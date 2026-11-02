import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('voice provider catalog is a dedicated accessible subview',()=>{
 assert.match(html,/data-reading-view="reading-provider-view" aria-controls="reading-provider-view"/);
 assert.match(html,/id="reading-provider-view"[^>]*hidden/);
 assert.match(html,/id="reading-provider-heading" tabindex="-1"/);
 for (const name of ['Kokoro','ElevenLabs','Microsoft Azure Speech','Amazon Polly']) assert.ok(html.includes('<summary>'+name));
 assert.match(html,/id="reading-google-open" aria-controls="reading-google-guide" aria-expanded="false"/);
});
test('Google guide isolates other providers and gives accessible return',()=>{
 assert.match(html,/id="reading-google-guide" hidden/);
 assert.match(html,/id="reading-google-guide-heading" tabindex="-1"/);
 assert.match(html,/id="reading-provider-rest"/);
 assert.match(html,/providerRest.hidden = true/);
 assert.match(html,/id="reading-google-close"/);
 assert.match(html,/providerOpen.focus\(\)/);
 assert.match(html,/https:\/\/aistudio\.google\.com\/api-keys/);
});
test('Google guide requires no API key while secure connection is absent',()=>{
 assert.match(html,/No introduzcas aquí claves ni textos secretos/);
 assert.doesNotMatch(html,/id="reading-google-text-estimate"/);
 assert.doesNotMatch(html,/id="reading-google-api-key-input"/);
 assert.match(html,/Escribe un nombre para identificar tu clave/);
 assert.match(html,/Activa el botón de Google para crear la clave/);
 assert.match(html,/Activa el botón de Google para copiarla/);
});

test('Windows JAWS external-tab return is documented and focus recovery is available',()=>{
 assert.match(html,/Windows con JAWS/);
 assert.match(html,/Control \+ Mayús \+ Tabulador/);
 assert.match(html,/window.addEventListener\('focus', returnToGoogleStepThree\)/);
 assert.match(html,/document.addEventListener\('visibilitychange', returnToGoogleStepThree\)/);
});
