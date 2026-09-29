import { normalizeSemanticPosition } from './reading-semantic-model.mjs';

let nextControllerId = 1;

function clampRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(2, Math.max(0.5, number));
}

function documentBlocks(document) {
  return Array.isArray(document?.blocks) ? document.blocks : [];
}

function unitsFor(block) {
  const sentences = Array.isArray(block?.sentences)
    ? block.sentences.map(value => String(value ?? '').trim()).filter(Boolean)
    : [];
  if (sentences.length) return sentences;
  const text = String(block?.text ?? '').trim();
  return text ? [text] : [];
}

function percentFor(position, document) {
  const blocks = documentBlocks(document);
  if (!blocks.length) return 0;
  let total = 0;
  let completed = 0;
  blocks.forEach((block, blockIndex) => {
    const count = Math.max(1, unitsFor(block).length);
    total += count;
    if (blockIndex < position.blockIndex) completed += count;
    else if (blockIndex === position.blockIndex) completed += Math.min(count, position.unitIndex + 1);
  });
  return total ? Math.min(100, (completed * 100) / total) : 0;
}

function currentUnit(document, position) {
  const block = documentBlocks(document)[position.blockIndex];
  return unitsFor(block)[position.unitIndex] ?? null;
}

function advancePosition(document, position) {
  const blocks = documentBlocks(document);
  if (!blocks.length) return null;
  const currentUnits = unitsFor(blocks[position.blockIndex]);
  if (position.unitIndex + 1 < currentUnits.length) {
    return { blockIndex: position.blockIndex, unitIndex: position.unitIndex + 1 };
  }
  for (let blockIndex = position.blockIndex + 1; blockIndex < blocks.length; blockIndex++) {
    if (unitsFor(blocks[blockIndex]).length) return { blockIndex, unitIndex: 0 };
  }
  return null;
}

export function createReadingSpeechController({
  client = {},
  document = { blocks: [] },
  initialPosition = { blockIndex: 0, unitIndex: 0 },
  settings = {},
  onPositionChange = () => {}
} = {}) {
  const controllerId = nextControllerId++;
  let position = normalizeSemanticPosition(initialPosition, document);
  let voiceId = String(settings?.['speech.voice'] ?? '').trim();
  let rate = clampRate(settings?.['speech.rate']);
  let playing = false;
  let ended = documentBlocks(document).length === 0 || currentUnit(document, position) == null;
  let destroyed = false;
  let sessionSerial = 0;
  let utteranceSerial = 0;
  let activeSessionId = '';
  let activeUtteranceId = '';
  const handles = [];

  const report = extra => {
    const payload = {
      blockIndex: position.blockIndex,
      unitIndex: position.unitIndex,
      percent: ended ? 100 : percentFor(position, document),
      state: ended ? 'read' : 'in-reading',
      ...extra
    };
    try { onPositionChange(payload); } catch {}
    return payload;
  };

  const isCurrentEvent = event => Boolean(
    !destroyed &&
    activeSessionId &&
    String(event?.sessionId ?? '') === activeSessionId &&
    String(event?.utteranceId ?? '') === activeUtteranceId
  );

  async function speakCurrent() {
    const text = currentUnit(document, position);
    if (!text || destroyed) {
      playing = false;
      ended = true;
      activeUtteranceId = '';
      report();
      return false;
    }
    if (!activeSessionId) activeSessionId = `reading-${controllerId}-${++sessionSerial}`;
    const utteranceId = `${activeSessionId}-u${++utteranceSerial}`;
    activeUtteranceId = utteranceId;
    playing = true;
    ended = false;
    const accepted = await client.startTts?.({
      sessionId: activeSessionId,
      utteranceId,
      text,
      voiceId,
      rate
    });
    if (accepted !== true) {
      playing = false;
      activeUtteranceId = '';
      return false;
    }
    return true;
  }

  async function handleDone(event) {
    if (!isCurrentEvent(event) || !playing) return;
    const next = advancePosition(document, position);
    if (!next) {
      playing = false;
      ended = true;
      activeUtteranceId = '';
      report();
      return;
    }
    position = next;
    report();
    await speakCurrent();
  }

  function handleInterrupted(event) {
    if (!isCurrentEvent(event)) return;
    playing = false;
    activeSessionId = '';
    activeUtteranceId = '';
    report({ interrupted: true });
  }

  function handleError(event) {
    if (!isCurrentEvent(event)) return;
    playing = false;
    activeSessionId = '';
    activeUtteranceId = '';
    report({ error: String(event?.message ?? 'tts-error') });
  }

  const listenersReady = (async () => {
    if (typeof client.addListener !== 'function') return;
    for (const [name, listener] of [
      ['ttsDone', handleDone],
      ['ttsInterrupted', handleInterrupted],
      ['ttsError', handleError]
    ]) {
      try {
        const handle = await client.addListener(name, listener);
        if (handle?.remove) handles.push(handle);
      } catch {}
    }
  })();

  async function play() {
    await listenersReady;
    if (destroyed || ended) return false;
    if (playing) return true;
    activeSessionId = `reading-${controllerId}-${++sessionSerial}`;
    return speakCurrent();
  }

  async function pause() {
    await listenersReady;
    if (destroyed) return false;
    const hadActive = playing || Boolean(activeSessionId);
    activeSessionId = '';
    activeUtteranceId = '';
    playing = false;
    if (hadActive && typeof client.stopTts === 'function') {
      try { await client.stopTts(); } catch {}
    }
    return hadActive;
  }

  async function moveTo(nextPosition = {}) {
    await pause();
    position = normalizeSemanticPosition(nextPosition, document);
    ended = documentBlocks(document).length === 0 || currentUnit(document, position) == null;
    report();
    return { ...position };
  }

  function setVoice(value) {
    voiceId = String(value ?? '').trim();
    return voiceId;
  }

  function setRate(value) {
    rate = clampRate(value);
    return rate;
  }

  function snapshot() {
    return {
      position: { ...position },
      playing,
      ended,
      voiceId,
      rate,
      percent: ended ? 100 : percentFor(position, document)
    };
  }

  async function destroy() {
    if (destroyed) return;
    await pause();
    destroyed = true;
    await listenersReady;
    for (const handle of handles.splice(0)) {
      try { await handle.remove(); } catch {}
    }
  }

  return { play, pause, moveTo, setVoice, setRate, snapshot, destroy };
}
