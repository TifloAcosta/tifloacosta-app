function clone(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function freshState(generation = 0) {
  return {
    active: false,
    generation,
    text: '',
    urls: [],
    selectedUrl: '',
    classification: null,
    readableHistory: [],
    view: 'received',
    error: null
  };
}

export function createShareSession() {
  let state = freshState();
  let requestSequence = 0;

  function begin({ text = '', urls = [] } = {}) {
    const generation = state.generation + 1;
    state = {
      ...freshState(generation),
      active: true,
      text: String(text || '').trim(),
      urls: Array.isArray(urls) ? urls.map(value => String(value || '').trim()).filter(Boolean) : []
    };
    return snapshot();
  }

  function beginRequest() {
    requestSequence += 1;
    return { generation: state.generation, requestId: requestSequence };
  }

  function isCurrentRequest(token) {
    return Boolean(token)
      && Number(token.generation) === state.generation
      && Number(token.requestId) === requestSequence;
  }

  function selectUrl(url = '') {
    state.selectedUrl = String(url || '').trim();
    return snapshot();
  }

  function setClassification(value) {
    state.classification = value && typeof value === 'object' ? clone(value) : null;
    return snapshot();
  }

  function pushReadable(page) {
    if (!page || typeof page !== 'object') return snapshot();
    state.readableHistory.push(clone(page));
    state.view = 'readable';
    return snapshot();
  }

  function popReadable() {
    if (state.readableHistory.length > 1) state.readableHistory.pop();
    const current = state.readableHistory.at(-1) || null;
    if (current) state.view = 'readable';
    return clone(current);
  }

  function setView(view, error = null) {
    state.view = String(view || 'received');
    state.error = error ? clone(error) : null;
    return snapshot();
  }

  function snapshot() {
    return clone(state);
  }

  function clear() {
    state = freshState(state.generation + 1);
    return snapshot();
  }

  return {
    begin,
    beginRequest,
    isCurrentRequest,
    selectUrl,
    setClassification,
    pushReadable,
    popReadable,
    setView,
    snapshot,
    clear
  };
}
