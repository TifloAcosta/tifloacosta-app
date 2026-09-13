function escapeId(value) {
  if (globalThis.CSS && typeof globalThis.CSS.escape === 'function') return globalThis.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
}

export function focusScreenHeading(root) {
  const heading = root.querySelector('[data-screen-heading]');
  if (!heading || typeof heading.focus !== 'function') return false;
  heading.focus();
  return true;
}

export function restoreOriginFocus(root, originId) {
  if (!originId) return false;
  const target = root.querySelector(`#${escapeId(originId)}`);
  if (!target || typeof target.focus !== 'function') return false;
  target.focus();
  return true;
}
