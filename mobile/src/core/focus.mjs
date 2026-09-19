function escapeId(value) {
  const text = String(value || '');
  if (globalThis.CSS && typeof globalThis.CSS.escape === 'function') return globalThis.CSS.escape(text);
  return text.replace(/[^A-Za-z0-9_-]/g, character => `\\${character}`);
}

export function focusScreenHeading(root) {
  const heading = root?.querySelector?.('[data-screen-heading]');
  if (!heading || typeof heading.focus !== 'function') return false;
  heading.focus();
  return true;
}

export function restoreOriginFocus(root, originId) {
  if (!originId || !root?.querySelector) return false;
  const target = root.querySelector(`#${escapeId(originId)}`);
  if (!target || typeof target.focus !== 'function') return false;
  target.focus();
  return true;
}
