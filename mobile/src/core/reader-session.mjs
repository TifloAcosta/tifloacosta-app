function copyPage(page) {
  if (!page || typeof page !== 'object') return null;
  return {
    ...page,
    blocks: Array.isArray(page.blocks)
      ? page.blocks.map(block => ({
          ...block,
          parts: Array.isArray(block.parts) ? block.parts.map(part => ({ ...part })) : block.parts
        }))
      : []
  };
}

export function createReaderSession() {
  let generation = 0;
  let requestSequence = 0;
  let state = {
    url: '',
    title: '',
    allowOriginalFallback: false,
    pages: [],
    error: null,
    loading: false
  };

  function begin({ url = '', title = '', allowOriginalFallback = false } = {}) {
    generation += 1;
    requestSequence = 0;
    state = {
      url: String(url || '').trim(),
      title: String(title || '').trim(),
      allowOriginalFallback: Boolean(allowOriginalFallback),
      pages: [],
      error: null,
      loading: false
    };
    return snapshot();
  }

  function beginRequest() {
    requestSequence += 1;
    state.loading = true;
    state.error = null;
    return { generation, requestSequence };
  }

  function isCurrentRequest(token) {
    return Boolean(token)
      && token.generation === generation
      && token.requestSequence === requestSequence;
  }

  function push(page) {
    const copy = copyPage(page);
    if (!copy) return snapshot();
    state.pages.push(copy);
    state.url = String(copy.url || state.url || '').trim();
    state.title = String(copy.title || state.title || '').trim();
    state.loading = false;
    state.error = null;
    return snapshot();
  }

  function pop() {
    if (state.pages.length > 1) state.pages.pop();
    const page = state.pages.at(-1) || null;
    if (page) {
      state.url = String(page.url || state.url || '').trim();
      state.title = String(page.title || state.title || '').trim();
    }
    state.loading = false;
    state.error = null;
    return page ? copyPage(page) : null;
  }

  function setError(error = null) {
    state.loading = false;
    state.error = error ? { ...error } : null;
    return snapshot();
  }

  function setLoading(value = true) {
    state.loading = Boolean(value);
    return snapshot();
  }

  function snapshot() {
    return {
      generation,
      requestSequence,
      url: state.url,
      title: state.title,
      allowOriginalFallback: state.allowOriginalFallback,
      pages: state.pages.map(copyPage),
      error: state.error ? { ...state.error } : null,
      loading: state.loading
    };
  }

  function clear() {
    generation += 1;
    requestSequence = 0;
    state = { url: '', title: '', allowOriginalFallback: false, pages: [], error: null, loading: false };
    return snapshot();
  }

  return { begin, beginRequest, isCurrentRequest, push, pop, setError, setLoading, snapshot, clear };
}
