function routeRecord(name, originId = null) {
  const value = String(name || '').trim();
  if (!value) throw new TypeError('Route name is required');
  return { name: value, originId: originId || null };
}

export function createRouter({ render, focusScreenHeading, restoreOriginFocus }) {
  if (typeof render !== 'function') throw new TypeError('render must be a function');
  if (typeof focusScreenHeading !== 'function') throw new TypeError('focusScreenHeading must be a function');
  if (typeof restoreOriginFocus !== 'function') throw new TypeError('restoreOriginFocus must be a function');

  let stack = [];

  function current() {
    return stack.length ? { ...stack.at(-1) } : null;
  }

  function start(route = 'home') {
    const record = routeRecord(route);
    stack = [record];
    render({ ...record });
    focusScreenHeading();
    return current();
  }

  function navigate(route, { originId = null } = {}) {
    const record = routeRecord(route, originId);
    stack.push(record);
    render({ ...record });
    focusScreenHeading();
    return current();
  }

  function back() {
    if (stack.length <= 1) return false;
    const leaving = stack.pop();
    const destination = stack.at(-1);
    render({ ...destination });
    restoreOriginFocus(leaving.originId);
    return true;
  }

  return { start, navigate, back, current };
}
