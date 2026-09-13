export function backgroundRefreshMode({ activeElement, body, root }) {
  if (!activeElement || activeElement === body || activeElement === root) return 'render';

  const dataset = activeElement.dataset;
  if (dataset && Object.prototype.hasOwnProperty.call(dataset, 'screenHeading')) {
    return 'render-restore-heading';
  }

  return 'defer';
}
