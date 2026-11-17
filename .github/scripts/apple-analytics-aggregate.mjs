export function summarizeReportRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return {};
  const metric = Object.hasOwn(rows[0], 'Counts') ? 'Counts'
    : Object.hasOwn(rows[0], 'Sessions') ? 'Sessions' : null;
  if (!metric) return {};
  const dimensions = {
    byDate: 'Date',
    byEvent: 'Event',
    byTerritory: 'Territory',
    byDevice: 'Device',
    bySource: 'Source Type',
    byDownloadType: 'Download Type'
  };
  const result = { metric };
  for (const [label, field] of Object.entries(dimensions)) {
    if (rows.some(row => Object.hasOwn(row, field))) result[label] = {};
  }
  for (const row of rows) {
    const raw = row[metric];
    if (typeof raw !== 'string' || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(raw)) {
      throw new Error('Conteo no válido en el informe Apple');
    }
    const count = Number(raw);
    if (!Number.isSafeInteger(count)) throw new Error('Conteo no válido en el informe Apple');
    for (const [label, field] of Object.entries(dimensions)) {
      if (!result[label] || !row[field]) continue;
      result[label][row[field]] = (result[label][row[field]] ?? 0) + count;
    }
  }
  return result;
}
