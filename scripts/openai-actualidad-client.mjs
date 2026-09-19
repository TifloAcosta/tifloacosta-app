const API_URL = 'https://api.openai.com/v1/responses';

const localeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    body: { type: 'string' }
  },
  required: ['title', 'summary', 'body']
};

const evaluationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decision: { type: 'string', enum: ['source-only', 'adapt', 'withheld'] },
    interest: { type: 'string', enum: ['low', 'medium', 'high', 'very-high'] },
    practicalImpact: { type: 'string' },
    sourceReliability: { type: 'string', enum: ['low', 'medium', 'high'] },
    needsContrast: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 3 }
  },
  required: ['decision', 'interest', 'practicalImpact', 'sourceReliability', 'needsContrast', 'reasons']
};

const adaptationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    locales: {
      type: 'object',
      additionalProperties: false,
      properties: { es: localeSchema, en: localeSchema },
      required: ['es', 'en']
    },
    categories: { type: 'array', items: { type: 'string' } },
    featuredRank: { anyOf: [{ type: 'integer' }, { type: 'null' }] }
  },
  required: ['locales', 'categories', 'featuredRank']
};

const contrastSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    confirmed: { type: 'boolean' },
    summary: { type: 'string' },
    sourceUrls: { type: 'array', items: { type: 'string' } }
  },
  required: ['confirmed', 'summary', 'sourceUrls']
};

function outputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) return part.text.trim();
    }
  }
  return '';
}

function storyPayload(story) {
  return {
    id: story?.id || '',
    title: story?.title || story?.locales?.[story?.originalLanguage]?.title || '',
    summary: story?.summary || story?.locales?.[story?.originalLanguage]?.summary || '',
    body: story?.body || story?.locales?.[story?.originalLanguage]?.body || '',
    sourceName: story?.sourceName || '',
    sourceUrl: story?.sourceUrl || '',
    originalUrl: story?.originalUrl || '',
    originalLanguage: story?.lang || story?.originalLanguage || '',
    publishedAt: story?.publishedAt || '',
    categories: Array.isArray(story?.categories) ? story.categories : []
  };
}

export function createActualidadAIClient({ apiKey, fetchFn = fetch, model = 'gpt-5.6-luna' } = {}) {
  if (!String(apiKey || '').trim()) throw new Error('OPENAI_API_KEY is required for automatic Actualidad adaptation');

  async function request({ name, schema, instructions, input, tools }) {
    const body = {
      model,
      store: false,
      reasoning: { effort: 'low' },
      instructions,
      input: [{ role: 'user', content: [{ type: 'input_text', text: input }] }],
      text: {
        format: {
          type: 'json_schema',
          name,
          schema,
          strict: true
        }
      }
    };
    if (tools?.length) body.tools = tools;

    const response = await fetchFn(API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response?.ok) {
      const status = response?.status || 'unknown';
      throw new Error(`OpenAI Responses API request failed with status ${status}`);
    }

    const payload = await response.json();
    const text = outputText(payload);
    if (!text) throw new Error('OpenAI Responses API returned no structured output');
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('OpenAI Responses API returned malformed structured output');
    }
  }

  return {
    async evaluateStory(story, guidelines) {
      return request({
        name: 'actualidad_evaluation',
        schema: evaluationSchema,
        instructions: `${guidelines}\n\nTask: evaluate whether this item is sufficiently important to adapt. Use decision "adapt" only when interest is "very-high" and the practical value is clear. Use "withheld" only for content that should not be published at all. Otherwise use "source-only". Do not invent facts and return only the requested structure.`,
        input: JSON.stringify(storyPayload(story))
      });
    },

    async adaptStory(story, guidelines, evidence = '') {
      return request({
        name: 'actualidad_adaptation',
        schema: adaptationSchema,
        instructions: `${guidelines}\n\nTask: produce a natural Spanish and English adaptation of the supplied story. Both languages need a useful title, concise summary, and self-contained body. Do not add facts that are absent from the supplied evidence. Do not copy long passages. Use featuredRank null unless there is an explicit editorial reason to feature the item. Return only the requested structure.`,
        input: JSON.stringify({ story: storyPayload(story), additionalEvidence: evidence || '' })
      });
    },

    async contrastStory(story, purpose = '') {
      return request({
        name: 'actualidad_contrast',
        schema: contrastSchema,
        tools: [{ type: 'web_search' }],
        instructions: 'Check the material claims in this technology/accessibility news item using web search. Prefer first-party or otherwise reliable sources. Be concise. If reliable confirmation cannot be found, set confirmed to false. Return only the requested structure.',
        input: JSON.stringify({ story: storyPayload(story), purpose })
      });
    }
  };
}
