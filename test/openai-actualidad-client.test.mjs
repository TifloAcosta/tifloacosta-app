import assert from 'node:assert/strict';
import test from 'node:test';
import { createActualidadAIClient } from '../scripts/openai-actualidad-client.mjs';

function okResponse(payload) {
  return {
    ok: true,
    json: async () => ({
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }]
    })
  };
}

test('evaluation uses Responses API structured outputs without storing responses', async () => {
  let request;
  const client = createActualidadAIClient({
    apiKey: 'secret-test-key',
    model: 'gpt-5.6-luna',
    fetchFn: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return okResponse({ decision: 'adapt', interest: 'very-high', practicalImpact: 'Useful', sourceReliability: 'high', needsContrast: false, reasons: ['Relevant'] });
    }
  });

  const result = await client.evaluateStory({ title: 'Accessibility update', summary: 'Useful change', sourceName: 'Source', originalUrl: 'https://example.com/item' }, 'Guidelines');
  assert.equal(result.decision, 'adapt');
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.authorization, 'Bearer secret-test-key');
  assert.equal(request.body.model, 'gpt-5.6-luna');
  assert.equal(request.body.store, false);
  assert.equal(request.body.text.format.type, 'json_schema');
  assert.equal(request.body.text.format.strict, true);
  assert.equal(request.body.tools, undefined);
});

test('adaptation request requires complete bilingual structured output', async () => {
  let body;
  const payload = {
    locales: {
      es: { title: 'Título', summary: 'Resumen', body: 'Cuerpo' },
      en: { title: 'Title', summary: 'Summary', body: 'Body' }
    },
    categories: ['tecnologia-accesibilidad'],
    featuredRank: null
  };
  const client = createActualidadAIClient({
    apiKey: 'key', model: 'gpt-5.6-luna',
    fetchFn: async (_url, options) => { body = JSON.parse(options.body); return okResponse(payload); }
  });
  assert.deepEqual(await client.adaptStory({ title: 'Story', summary: 'Summary' }, 'Guidelines', ''), payload);
  const schema = body.text.format.schema;
  assert.deepEqual(schema.required, ['locales', 'categories', 'featuredRank']);
  assert.deepEqual(schema.properties.locales.required, ['es', 'en']);
});

test('contrast is the only operation that enables web search', async () => {
  let body;
  const client = createActualidadAIClient({
    apiKey: 'key', model: 'gpt-5.6-luna',
    fetchFn: async (_url, options) => { body = JSON.parse(options.body); return okResponse({ confirmed: true, summary: 'Confirmed', sourceUrls: ['https://example.org/confirm'] }); }
  });
  const result = await client.contrastStory({ title: 'Story', originalUrl: 'https://example.com/story' }, 'Check material facts');
  assert.equal(result.confirmed, true);
  assert.deepEqual(body.tools, [{ type: 'web_search' }]);
});

test('API errors are surfaced without exposing the API key', async () => {
  const client = createActualidadAIClient({
    apiKey: 'do-not-leak', model: 'gpt-5.6-luna',
    fetchFn: async () => ({ ok: false, status: 429, text: async () => 'quota' })
  });
  await assert.rejects(client.evaluateStory({ title: 'Story' }, 'Guidelines'), error => {
    assert.match(error.message, /429/);
    assert.doesNotMatch(error.message, /do-not-leak/);
    return true;
  });
});

test('malformed structured output is rejected', async () => {
  const client = createActualidadAIClient({
    apiKey: 'key', model: 'gpt-5.6-luna',
    fetchFn: async () => ({ ok: true, json: async () => ({ output: [] }) })
  });
  await assert.rejects(client.evaluateStory({ title: 'Story' }, 'Guidelines'), /structured output/i);
});
