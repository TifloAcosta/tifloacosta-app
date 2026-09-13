export function createRouter({ render, focusScreenHeading, restoreOriginFocus }) {
  const stack = [];

  function renderCurrent({ focusHeading = true, restoreId = null } = {}) {
    const route = stack.at(-1);
    render(route);
    if (focusHeading) focusScreenHeading();
    if (restoreId) restoreOriginFocus(restoreId);
    return route;
  }

  return {
    start(route = 'home') {
      stack.splice(0, stack.length, { name: route, originId: null });
      return renderCurrent();
    },

    navigate(route, { originId = null } = {}) {
      stack.push({ name: route, originId });
      return renderCurrent();
    },

    enterExternal(route) {
      if (route === 'home') {
        stack.splice(0, stack.length, { name: 'home', originId: null });
      } else {
        stack.splice(
          0,
          stack.length,
          { name: 'home', originId: null },
          { name: route, originId: null }
        );
      }
      return renderCurrent();
    },

    back() {
      if (stack.length <= 1) return false;
      const leaving = stack.pop();
      renderCurrent({ focusHeading: false, restoreId: leaving.originId });
      return true;
    },

    current() {
      return stack.at(-1) || null;
    }
  };
}