function clean(value) {
  return String(value ?? '').trim();
}

function createEmitter() {
  const listeners = new Map();
  return {
    emit(name, payload) {
      for (const listener of listeners.get(name) || []) {
        try { listener(payload); } catch {}
      }
    },
    addListener(name, listener) {
      if (typeof listener !== 'function') return Promise.resolve({ remove() {} });
      const bucket = listeners.get(name) || new Set();
      bucket.add(listener);
      listeners.set(name, bucket);
      return Promise.resolve({
        remove() {
          bucket.delete(listener);
          if (!bucket.size) listeners.delete(name);
        }
      });
    }
  };
}

export function listWebTtsVoices(speechSynthesis = globalThis.speechSynthesis) {
  const values = typeof speechSynthesis?.getVoices === 'function' ? speechSynthesis.getVoices() : [];
  return (Array.isArray(values) ? values : Array.from(values || [])).map((voice, index) => ({
    id: clean(voice?.voiceURI || voice?.name || `web-voice-${index + 1}`),
    name: clean(voice?.name || voice?.voiceURI || `Voice ${index + 1}`),
    language: clean(voice?.lang).toLowerCase(),
    locale: clean(voice?.lang),
    networkRequired: voice?.localService === false
  })).filter(voice => voice.id);
}

export function createWebReadingSpeechAdapter({
  speechSynthesis = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance
} = {}) {
  const emitter = createEmitter();
  let session = null;
  let units = [];
  let cursor = 0;
  let playing = false;
  let paused = false;
  let prepared = false;
  let ended = false;
  let currentUtterance = null;
  let serial = 0;

  const state = extra => ({
    sessionId: clean(session?.sessionId),
    bookId: clean(session?.bookId),
    blockIndex: Number(units[cursor]?.blockIndex ?? session?.blockIndex ?? 0),
    unitIndex: Number(units[cursor]?.unitIndex ?? session?.unitIndex ?? 0),
    playing,
    prepared,
    ended,
    ...extra
  });

  function resolveVoice(voiceId) {
    const id = clean(voiceId);
    if (!id || typeof speechSynthesis?.getVoices !== 'function') return null;
    const voices = Array.from(speechSynthesis.getVoices() || []);
    return voices.find(voice => clean(voice?.voiceURI) === id || clean(voice?.name) === id) || null;
  }

  function cursorForPosition(blockIndex, unitIndex) {
    const block = Number(blockIndex) || 0;
    const unit = Number(unitIndex) || 0;
    const exact = units.findIndex(item => Number(item?.blockIndex) === block && Number(item?.unitIndex) === unit);
    if (exact >= 0) return exact;
    const later = units.findIndex(item =>
      Number(item?.blockIndex) > block ||
      (Number(item?.blockIndex) === block && Number(item?.unitIndex) >= unit)
    );
    return later >= 0 ? later : Math.max(0, units.length - 1);
  }

  function emitState(name, extra = {}) {
    emitter.emit(name, state(extra));
  }

  function cancelNative() {
    serial += 1;
    try { speechSynthesis?.cancel?.(); } catch {}
    currentUtterance = null;
  }

  const MAX_UTTERANCE_CHARS = 1800;

  function speechChunkFrom(startCursor) {
    const starts = [];
    const parts = [];
    let length = 0;
    let endCursor = startCursor;

    for (let index = startCursor; index < units.length; index += 1) {
      const text = clean(units[index]?.text);
      if (!text) continue;

      const separatorLength = parts.length ? 2 : 0;
      const projected = length + separatorLength + text.length;
      if (parts.length && projected > MAX_UTTERANCE_CHARS) break;

      starts.push({ offset: length + separatorLength, unitCursor: index });
      parts.push(text);
      length = projected;
      endCursor = index;

      // Always allow at least one unit, even if a single row is unusually long.
      if (length >= MAX_UTTERANCE_CHARS) break;
    }

    return {
      text: parts.join('. '),
      starts,
      endCursor
    };
  }

  function speakCurrent() {
    if (!session || !prepared || ended || !units.length || cursor >= units.length) return false;
    if (typeof Utterance !== 'function' || typeof speechSynthesis?.speak !== 'function') return false;

    const token = ++serial;
    const baseCursor = cursor;
    const chunk = speechChunkFrom(baseCursor);
    if (!chunk.text) return false;

    const utterance = new Utterance(chunk.text);
    utterance.rate = Number(session.rate) || 1;
    const voice = resolveVoice(session.voiceId);
    if (voice) utterance.voice = voice;

    let lastReportedCursor = cursor;

    utterance.onstart = () => {
      if (token !== serial) return;
      playing = true;
      paused = false;
      ended = false;
      emitState('ttsState');
      emitState('ttsPosition');
    };

    utterance.onboundary = event => {
      if (token !== serial) return;
      const charIndex = Number(event?.charIndex);
      if (!Number.isFinite(charIndex)) return;

      let nextCursor = baseCursor;
      for (const marker of chunk.starts) {
        if (marker.offset <= charIndex) nextCursor = marker.unitCursor;
        else break;
      }

      if (nextCursor === lastReportedCursor) return;
      cursor = nextCursor;
      lastReportedCursor = nextCursor;
      emitState('ttsPosition');
    };

    utterance.onend = () => {
      if (token !== serial) return;
      currentUtterance = null;
      cursor = chunk.endCursor;

      if (cursor + 1 < units.length && playing) {
        cursor += 1;
        emitState('ttsPosition');
        speakCurrent();
        return;
      }

      cursor = Math.min(cursor, units.length - 1);
      playing = false;
      paused = false;
      ended = cursor >= units.length - 1;
      emitState('ttsPosition');
      if (ended) emitState('ttsEnded');
      emitState('ttsState');
    };

    utterance.onerror = event => {
      if (token !== serial) return;
      currentUtterance = null;
      playing = false;
      paused = false;
      emitter.emit('ttsError', state({ message: clean(event?.error || 'tts-error') }));
    };

    currentUtterance = utterance;
    speechSynthesis.speak(utterance);
    return true;
  }

  async function beginTtsSession(value = {}) {
    cancelNative();
    session = {
      sessionId: clean(value.sessionId),
      bookId: clean(value.bookId),
      title: clean(value.title),
      voiceId: clean(value.voiceId),
      rate: Number(value.rate) || 1,
      blockIndex: Number(value.blockIndex) || 0,
      unitIndex: Number(value.unitIndex) || 0
    };
    units = [];
    cursor = 0;
    playing = false;
    paused = false;
    prepared = false;
    ended = false;
    return Boolean(session.sessionId && session.bookId);
  }

  async function appendTtsUnits(value = {}) {
    if (!session || clean(value.sessionId) !== session.sessionId) return false;
    const next = (Array.isArray(value.units) ? value.units : []).map(item => ({
      blockIndex: Number(item?.blockIndex) || 0,
      unitIndex: Number(item?.unitIndex) || 0,
      text: clean(item?.text)
    })).filter(item => item.text);
    units.push(...next);
    return true;
  }

  async function commitTtsSession(value = {}) {
    if (!session || clean(value.sessionId) !== session.sessionId || !units.length) return false;
    cursor = cursorForPosition(session.blockIndex, session.unitIndex);
    prepared = true;
    ended = false;
    emitState('ttsState');
    return true;
  }

  async function playTts() {
    if (!session || !prepared || ended) return false;
    if (paused && typeof speechSynthesis?.resume === 'function') {
      try { speechSynthesis.resume(); } catch {}
      paused = false;
      playing = true;
      emitState('ttsState');
      return true;
    }
    if (playing) return true;
    playing = true;
    return speakCurrent();
  }

  async function pauseTts() {
    if (!session || !prepared) return false;
    try { speechSynthesis?.pause?.(); } catch {}
    playing = false;
    paused = true;
    emitState('ttsState');
    return true;
  }

  async function seekTts(value = {}) {
    if (!session || !prepared || !units.length) return false;
    const resume = playing;
    cancelNative();
    cursor = cursorForPosition(value.blockIndex, value.unitIndex);
    playing = false;
    paused = false;
    ended = false;
    emitState('ttsPosition');
    if (resume) {
      playing = true;
      return speakCurrent();
    }
    return true;
  }

  async function getTtsState() {
    return state();
  }

  async function stopTts() {
    cancelNative();
    playing = false;
    paused = false;
    prepared = false;
    ended = false;
    units = [];
    cursor = 0;
    const previous = session;
    session = null;
    emitter.emit('ttsState', {
      sessionId: clean(previous?.sessionId),
      bookId: clean(previous?.bookId),
      blockIndex: 0,
      unitIndex: 0,
      playing: false,
      prepared: false,
      ended: false
    });
    return true;
  }

  return {
    beginTtsSession,
    appendTtsUnits,
    commitTtsSession,
    playTts,
    pauseTts,
    seekTts,
    getTtsState,
    stopTts,
    addListener: emitter.addListener
  };
}
