import {
  automaticRecordHash,
  buildEditorialRecord,
  findCorroboratingStory,
  selectEvaluationCandidates,
  sourceFingerprint,
  validateAdaptation
} from './actualidad-auto-core.mjs';

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function compactEvaluation(value, evaluatedAt) {
  return {
    decision: value?.decision || 'source-only',
    interest: value?.interest || 'low',
    practicalImpact: String(value?.practicalImpact || '').trim(),
    sourceReliability: value?.sourceReliability || 'low',
    needsContrast: Boolean(value?.needsContrast),
    reasons: Array.isArray(value?.reasons) ? value.reasons.slice(0, 3).map(item => String(item || '').trim()).filter(Boolean) : [],
    evaluatedAt
  };
}

function autoStateRecord(story, editorialState, metadata = {}) {
  const record = {
    id: story.id,
    originalUrl: story.originalUrl,
    editorialState,
    automation: {
      generatedBy: 'actualidad-auto',
      model: String(metadata.model || ''),
      evaluatedAt: String(metadata.evaluatedAt || ''),
      adaptedAt: '',
      validation: editorialState === 'selected' ? 'pending' : 'not-applicable',
      autoHash: ''
    }
  };
  record.automation.autoHash = automaticRecordHash(record);
  return record;
}

function upsertEditorial(records, record) {
  const index = records.findIndex(item => item?.id === record.id || (item?.originalUrl && item.originalUrl === record.originalUrl));
  if (index >= 0) records[index] = record;
  else records.push(record);
}

function removeAutomaticEditorial(records, story) {
  const index = records.findIndex(item => item?.id === story.id || (item?.originalUrl && item.originalUrl === story.originalUrl));
  if (index >= 0 && records[index]?.automation?.generatedBy === 'actualidad-auto') records.splice(index, 1);
}

function localEvidence(corroborating) {
  if (!corroborating) return '';
  return [
    `Local corroboration from ${corroborating.sourceName || corroborating.sourceId || 'another source'}.`,
    corroborating.title || '',
    corroborating.summary || '',
    corroborating.originalUrl || ''
  ].filter(Boolean).join(' ');
}

function contrastEvidence(contrast) {
  if (!contrast?.confirmed) return '';
  const urls = Array.isArray(contrast.sourceUrls) ? contrast.sourceUrls.filter(Boolean).join(', ') : '';
  return [`External contrast: ${contrast.summary || ''}`, urls ? `Sources: ${urls}` : ''].filter(Boolean).join(' ');
}

function prepareStateEntry(previous, story, nowIso) {
  const fingerprint = sourceFingerprint(story);
  const sameSource = previous?.sourceFingerprint === fingerprint;
  return {
    ...(sameSource ? previous : {}),
    attempts: sameSource ? Number(previous?.attempts || 0) + 1 : 1,
    lastAttemptAt: nowIso,
    sourceFingerprint: fingerprint,
    status: 'evaluating'
  };
}

export async function runAutomaticEditorial({
  stories,
  sources,
  editorial,
  state,
  aiClient,
  config,
  guidelines,
  now = new Date()
}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new Error('Invalid automatic editorial reference date');
  const nowIso = nowDate.toISOString();
  const nextEditorial = clone(Array.isArray(editorial) ? editorial : []);
  const nextState = clone(state && typeof state === 'object' ? state : { version: 1, stories: {} });
  nextState.version = 1;
  if (!nextState.stories || typeof nextState.stories !== 'object') nextState.stories = {};

  const stats = { evaluated: 0, adapted: 0, selected: 0, withheld: 0, sourceOnly: 0, failed: 0, contrasts: 0 };
  if (!aiClient) return { editorial: nextEditorial, state: nextState, stats };

  const candidates = selectEvaluationCandidates({ stories, sources, editorial: nextEditorial, state: nextState, now: nowDate, config });

  for (const story of candidates) {
    const previousState = nextState.stories[story.id];
    nextState.stories[story.id] = prepareStateEntry(previousState, story, nowIso);

    let evaluation;
    try {
      evaluation = await aiClient.evaluateStory(story, guidelines);
      stats.evaluated += 1;
      nextState.stories[story.id].evaluation = compactEvaluation(evaluation, nowIso);
    } catch (error) {
      nextState.stories[story.id].status = 'error';
      nextState.stories[story.id].lastError = String(error?.message || 'AI evaluation failed').slice(0, 300);
      stats.failed += 1;
      continue;
    }

    if (evaluation?.decision === 'withheld') {
      const record = autoStateRecord(story, 'withheld', { model: config?.model, evaluatedAt: nowIso });
      upsertEditorial(nextEditorial, record);
      nextState.stories[story.id].status = 'withheld';
      stats.withheld += 1;
      continue;
    }

    if (evaluation?.decision !== 'adapt' || evaluation?.interest !== 'very-high') {
      removeAutomaticEditorial(nextEditorial, story);
      nextState.stories[story.id].status = 'source-only';
      stats.sourceOnly += 1;
      continue;
    }

    if (stats.adapted >= Number(config?.maxAdaptationsPerRun || 2)) {
      upsertEditorial(nextEditorial, autoStateRecord(story, 'selected', { model: config?.model, evaluatedAt: nowIso }));
      nextState.stories[story.id].status = 'selected';
      stats.selected += 1;
      continue;
    }

    let evidence = '';
    const corroborating = findCorroboratingStory(story, stories);
    if (corroborating) {
      evidence = localEvidence(corroborating);
      nextState.stories[story.id].contrast = { kind: 'local', sourceId: corroborating.sourceId, originalUrl: corroborating.originalUrl };
    } else if (evaluation?.needsContrast && Number(config?.maxContrastSearchesPerStory || 1) > 0 && typeof aiClient.contrastStory === 'function') {
      try {
        const contrast = await aiClient.contrastStory(story, evaluation.practicalImpact || 'Confirm material claims');
        stats.contrasts += 1;
        nextState.stories[story.id].contrast = {
          kind: 'web',
          confirmed: Boolean(contrast?.confirmed),
          sourceUrls: Array.isArray(contrast?.sourceUrls) ? contrast.sourceUrls.slice(0, 5) : []
        };
        if (!contrast?.confirmed) {
          upsertEditorial(nextEditorial, autoStateRecord(story, 'selected', { model: config?.model, evaluatedAt: nowIso }));
          nextState.stories[story.id].status = 'selected';
          nextState.stories[story.id].lastError = 'Contrast did not confirm the material claims';
          stats.selected += 1;
          continue;
        }
        evidence = contrastEvidence(contrast);
      } catch (error) {
        upsertEditorial(nextEditorial, autoStateRecord(story, 'selected', { model: config?.model, evaluatedAt: nowIso }));
        nextState.stories[story.id].status = 'selected';
        nextState.stories[story.id].lastError = String(error?.message || 'Contrast failed').slice(0, 300);
        stats.failed += 1;
        continue;
      }
    }

    try {
      const generated = await aiClient.adaptStory(story, guidelines, evidence);
      const validation = validateAdaptation(story, generated, { extraEvidence: evidence });
      if (!validation.ok) {
        upsertEditorial(nextEditorial, autoStateRecord(story, 'selected', { model: config?.model, evaluatedAt: nowIso }));
        nextState.stories[story.id].status = 'selected';
        nextState.stories[story.id].lastError = validation.errors.join('; ').slice(0, 500);
        nextState.stories[story.id].validation = { ok: false, errors: validation.errors.slice(0, 5) };
        stats.failed += 1;
        continue;
      }

      const record = buildEditorialRecord(story, generated, {
        model: config?.model,
        evaluatedAt: nowIso,
        adaptedAt: nowIso
      });
      upsertEditorial(nextEditorial, record);
      nextState.stories[story.id].status = 'adapted';
      nextState.stories[story.id].validation = { ok: true };
      delete nextState.stories[story.id].lastError;
      stats.adapted += 1;
    } catch (error) {
      upsertEditorial(nextEditorial, autoStateRecord(story, 'selected', { model: config?.model, evaluatedAt: nowIso }));
      nextState.stories[story.id].status = 'selected';
      nextState.stories[story.id].lastError = String(error?.message || 'Adaptation failed').slice(0, 300);
      stats.failed += 1;
    }
  }

  return { editorial: nextEditorial, state: nextState, stats };
}
