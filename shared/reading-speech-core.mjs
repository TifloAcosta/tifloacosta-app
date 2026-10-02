import { normalizeSemanticPosition } from './reading-semantic-model.mjs';

let nextControllerId = 1;
const SESSION_CHUNK_SIZE = 100;

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

function allSemanticUnits(document) {
  const result = [];
  documentBlocks(document).forEach((block, blockIndex) => {
    unitsFor(block).forEach((text, unitIndex) => {
      result.push({ blockIndex, unitIndex, text });
    });
  });
  return result;
}

function supportsBackgroundTts(value) {
  return Boolean(
    value?.beginTtsSession &&
    value?.appendTtsUnits &&
    value?.commitTtsSession &&
    value?.playTts &&
    value?.pauseTts &&
    value?.seekTts &&
    value?.getTtsState &&
    value?.stopTts &&
    value?.addListener
  );
}

export function createReadingSpeechController({
  client = {},
  book = {},
  document = { blocks: [] },
  initialPosition = { blockIndex: 0, unitIndex: 0 },
  settings = {},
  onPositionChange = () => {},
  fallbackTts = {},
  fallbackReading = {}
} = {}) {
  const controllerId = nextControllerId++;
  const tts = supportsBackgroundTts(client) ? client : fallbackTts;
  const activeBookId = typeof client?.getActiveBookId === 'function'
    ? client.getActiveBookId()
    : typeof fallbackReading?.getActiveBookId === 'function'
      ? fallbackReading.getActiveBookId()
      : '';
  const bookId = String(book?.id ?? document?.bookId ?? document?.id ?? activeBookId ?? '').trim();
  const title = String(book?.title ?? document?.title ?? '').trim();
  let position = normalizeSemanticPosition(initialPosition, document);
  let voiceId = String(settings?.['speech.voice'] ?? '').trim();
  let rate = clampRate(settings?.['speech.rate']);
  let playing = false;
  let ended = documentBlocks(document).length === 0 || currentUnit(document, position) == null;
  let prepared = false;
  let destroyed = false;
  let sessionSerial = 0;
  let activeSessionId = '';
  let preparedVoiceId = '';
  let preparedRate = 0;
  const handles = [];
  const visibilityDocument = globalThis?.document;

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

  const eventMatchesBook = event => {
    const eventBookId = String(event?.bookId ?? '').trim();
    return Boolean(bookId && eventBookId && eventBookId === bookId);
  };

  const adoptEventSession = event => {
    if (!eventMatchesBook(event)) return false;
    const eventSessionId = String(event?.sessionId ?? '').trim();
    if (!eventSessionId) return false;
    if (activeSessionId && activeSessionId !== eventSessionId) return false;
    activeSessionId = eventSessionId;
    prepared = event?.prepared !== false;
    return true;
  };

  const updatePositionFromEvent = event => {
    if (!documentBlocks(document).length) return;
    position = normalizeSemanticPosition({
      blockIndex: event?.blockIndex,
      unitIndex: event?.unitIndex
    }, document);
  };

  const handlePosition = event => {
    if (!adoptEventSession(event)) return;
    updatePositionFromEvent(event);
    if (typeof event?.playing === 'boolean') playing = event.playing;
    if (event?.ended === true) {
      ended = true;
      playing = false;
    }
    report();
  };

  const handleState = event => {
    if (!adoptEventSession(event)) return;
    updatePositionFromEvent(event);
    playing = event?.playing === true;
    ended = event?.ended === true;
    report();
  };

  const handleInterrupted = event => {
    if (!adoptEventSession(event)) return;
    updatePositionFromEvent(event);
    playing = false;
    report({ interrupted: true });
  };

  const handleEnded = event => {
    if (!adoptEventSession(event)) return;
    updatePositionFromEvent(event);
    playing = false;
    ended = true;
    report();
  };

  const handleError = event => {
    if (event?.bookId && !eventMatchesBook(event)) return;
    if (event?.sessionId && activeSessionId && event.sessionId !== activeSessionId) return;
    playing = false;
    report({ error: String(event?.message ?? 'tts-error') });
  };

  const listenersReady = (async () => {
    if (typeof tts?.addListener !== 'function') return;
    for (const [name, listener] of [
      ['ttsPosition', handlePosition],
      ['ttsState', handleState],
      ['ttsInterrupted', handleInterrupted],
      ['ttsEnded', handleEnded],
      ['ttsError', handleError]
    ]) {
      try {
        const handle = await tts.addListener(name, listener);
        if (handle?.remove) handles.push(handle);
      } catch {}
    }
  })();

  async function syncNativeState() {
    await listenersReady;
    if (destroyed || !bookId || typeof tts?.getTtsState !== 'function') return snapshot();
    let state = null;
    try { state = await tts.getTtsState(); } catch {}
    if (state && eventMatchesBook(state) && String(state.sessionId ?? '').trim()) {
      activeSessionId = String(state.sessionId).trim();
      prepared = state.prepared === true;
      playing = state.playing === true;
      ended = state.ended === true;
      updatePositionFromEvent(state);
      report();
    }
    return snapshot();
  }

  function configurationMatchesPreparedSession() {
    return prepared && preparedVoiceId === voiceId && preparedRate === rate;
  }

  async function prepareNativeSession() {
    await listenersReady;
    if (destroyed || ended || !bookId) return false;
    if (configurationMatchesPreparedSession() && activeSessionId) return true;

    const units = allSemanticUnits(document);
    if (!units.length) {
      ended = true;
      return false;
    }

    if (activeSessionId && typeof tts.stopTts === 'function') {
      try { await tts.stopTts(); } catch {}
    }

    activeSessionId = `reading-${controllerId}-${++sessionSerial}`;
    prepared = false;
    playing = false;

    const begun = await tts.beginTtsSession?.({
      sessionId: activeSessionId,
      bookId,
      title,
      voiceId,
      rate,
      blockIndex: position.blockIndex,
      unitIndex: position.unitIndex
    });
    if (begun !== true) {
      activeSessionId = '';
      return false;
    }

    for (let index = 0; index < units.length; index += SESSION_CHUNK_SIZE) {
      const appended = await tts.appendTtsUnits?.({
        sessionId: activeSessionId,
        units: units.slice(index, index + SESSION_CHUNK_SIZE)
      });
      if (appended !== true) {
        try { await tts.stopTts?.(); } catch {}
        activeSessionId = '';
        return false;
      }
    }

    const committed = await tts.commitTtsSession?.({ sessionId: activeSessionId });
    if (committed !== true) {
      try { await tts.stopTts?.(); } catch {}
      activeSessionId = '';
      return false;
    }

    prepared = true;
    preparedVoiceId = voiceId;
    preparedRate = rate;
    return true;
  }

  async function play() {
    await listenersReady;
    if (destroyed || ended) return false;
    if (playing) return true;
    if (!prepared || !activeSessionId || !configurationMatchesPreparedSession()) {
      const ready = await prepareNativeSession();
      if (!ready) return false;
    }
    const accepted = await tts.playTts?.();
    if (accepted !== true) return false;
    playing = true;
    ended = false;
    return true;
  }

  async function pause() {
    await listenersReady;
    if (destroyed) return false;
    const hadActive = playing || prepared;
    if (hadActive && typeof tts.pauseTts === 'function') {
      try { await tts.pauseTts(); } catch {}
    }
    playing = false;
    return hadActive;
  }

  async function moveTo(nextPosition = {}) {
    await listenersReady;
    const wasPlaying = playing;
    if (wasPlaying && typeof tts.pauseTts === 'function') {
      try { await tts.pauseTts(); } catch {}
    }
    playing = false;
    position = normalizeSemanticPosition(nextPosition, document);
    ended = documentBlocks(document).length === 0 || currentUnit(document, position) == null;
    if (prepared && activeSessionId && !ended && typeof tts.seekTts === 'function') {
      try {
        await tts.seekTts({ blockIndex: position.blockIndex, unitIndex: position.unitIndex });
      } catch {}
    }
    if (wasPlaying && !ended) {
      await play();
    }
    report();
    return { ...position };
  }

  function setVoice(value) {
    const next = String(value ?? '').trim();
    if (voiceId !== next) {
      voiceId = next;
      prepared = false;
    }
    return voiceId;
  }

  function setRate(value) {
    const next = clampRate(value);
    if (rate !== next) {
      rate = next;
      prepared = false;
    }
    return rate;
  }

  function snapshot() {
    return {
      position: { ...position },
      playing,
      ended,
      prepared,
      sessionId: activeSessionId,
      voiceId,
      rate,
      percent: ended ? 100 : percentFor(position, document)
    };
  }

  const handleVisibilityChange = () => {
    if (!destroyed && visibilityDocument?.visibilityState !== 'hidden') void syncNativeState();
  };
  visibilityDocument?.addEventListener?.('visibilitychange', handleVisibilityChange);
  void syncNativeState();

  async function destroy({ preserveNative = false } = {}) {
    if (destroyed) return;
    destroyed = true;
    visibilityDocument?.removeEventListener?.('visibilitychange', handleVisibilityChange);
    await listenersReady;
    if (!preserveNative && activeSessionId && typeof tts.stopTts === 'function') {
      try { await tts.stopTts(); } catch {}
    }
    for (const handle of handles.splice(0)) {
      try { await handle.remove(); } catch {}
    }
    playing = preserveNative ? playing : false;
    if (!preserveNative) {
      prepared = false;
      activeSessionId = '';
    }
  }

  return {
    play,
    pause,
    moveTo,
    setVoice,
    setRate,
    snapshot,
    syncNativeState,
    destroy
  };
}
