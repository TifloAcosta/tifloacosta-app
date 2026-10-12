const prefix = 'tiflolector.annotations.v1.';
export function annotationKey(bookId) { return prefix + encodeURIComponent(String(bookId || '')); }
export function loadAnnotations(bookId, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(annotationKey(bookId)) || '[]');
    return Array.isArray(value) ? value.filter(item => Number.isInteger(item.blockIndex) && Number.isInteger(item.unitIndex) && typeof item.note === 'string').slice(0, 500) : [];
  } catch { return []; }
}
export function saveAnnotations(bookId, entries, storage = globalThis.localStorage) {
  if (!bookId || !Array.isArray(entries)) return false;
  try {
    storage?.setItem(annotationKey(bookId), JSON.stringify(entries.slice(0, 500)));
    return true;
  } catch { return false; }
}
export function annotationAt(entries, position) {
  return entries.find(item => item.blockIndex === position.blockIndex && item.unitIndex === position.unitIndex) || null;
}
