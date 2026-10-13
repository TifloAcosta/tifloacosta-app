// Structural navigation shared by web and the packaged iOS reader.
// This uses the parsed document's semantics; it does not claim DAISY/SMIL support.
const TYPES = Object.freeze({
  heading: block => block?.type === 'heading',
  mainHeading: block => block?.type === 'heading' && Number(block?.level) >= 1 && Number(block.level) <= 2,
  paragraph: block => ['paragraph', 'table-cell', 'list-item'].includes(block?.type),
  listItem: block => block?.type === 'list-item',
  quote: block => block?.type === 'quote',
  tableCell: block => block?.type === 'table-cell'
});

export function adjacentWebReadingStructure(document, position, mode, direction = 1) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  const length = blocks.length;
  const index = Number(position?.blockIndex);
  const current = Number.isFinite(index) ? Math.max(0, Math.min(length - 1, Math.trunc(index))) : 0;
  const criterion = TYPES[String(mode || '')];
  const step = Number(direction) < 0 ? -1 : 1;
  const unchanged = { position: { blockIndex: Math.max(0, current), unitIndex: 0 }, moved: false };
  if (!length || !criterion) return unchanged;
  for (let at = current + step; at >= 0 && at < length; at += step) {
    const block = blocks[at];
    if (criterion(block) && String(block?.text || '').trim()) {
      return { position: { blockIndex: at, unitIndex: 0 }, moved: true };
    }
  }
  return unchanged;
}

export const WEB_READING_STRUCTURE_MODES = Object.freeze(Object.keys(TYPES));
