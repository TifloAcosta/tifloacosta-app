const POSITION_CHOICES = new Set(['keep-current', 'use-backup']);

const clean = value => String(value ?? '').trim();
const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const nonNegativeInteger = value => Math.max(0, Math.trunc(numberOr(value, 0)));
const percent = value => Math.min(100, Math.max(0, numberOr(value, 0)));

function normalizeConflict(value) {
  if (!value || typeof value !== 'object') return null;
  const sha256 = clean(value.sha256);
  if (!sha256) return null;
  return {
    sha256,
    currentBookId: clean(value.currentBookId),
    currentBlockIndex: nonNegativeInteger(value.currentBlockIndex),
    backupBlockIndex: nonNegativeInteger(value.backupBlockIndex),
    currentPercent: percent(value.currentPercent),
    backupPercent: percent(value.backupPercent)
  };
}

function normalizeMissingItem(value) {
  if (!value || typeof value !== 'object') return null;
  const id = clean(value.id);
  if (!id) return null;
  return { id, title: clean(value.title) };
}

function normalizePlan(value) {
  if (!value || typeof value !== 'object') return { cancelled: true };
  if (value.cancelled === true) return { cancelled: true };
  const restoreId = clean(value.restoreId);
  if (!restoreId) return { cancelled: true };
  return {
    cancelled: false,
    restoreId,
    additions: (Array.isArray(value.additions) ? value.additions : []).map(clean).filter(Boolean),
    duplicates: (Array.isArray(value.duplicates) ? value.duplicates : []).map(clean).filter(Boolean),
    positionConflicts: (Array.isArray(value.positionConflicts) ? value.positionConflicts : [])
      .map(normalizeConflict)
      .filter(Boolean)
  };
}

function normalizeChoices(choices = {}) {
  if (!choices || typeof choices !== 'object' || Array.isArray(choices)) return {};
  const result = {};
  for (const [sha256, rawChoice] of Object.entries(choices)) {
    const cleanSha = clean(sha256);
    const choice = clean(rawChoice);
    if (!cleanSha || !POSITION_CHOICES.has(choice)) continue;
    result[cleanSha] = choice;
  }
  return result;
}

export function createReadingBackupClient(plugin = {}) {
  async function exportReadingBackup(bookIds = null) {
    if (!plugin?.exportReadingBackup) return { exported: false, cancelled: true };
    const selected = Array.isArray(bookIds)
      ? [...new Set(bookIds.map(clean).filter(Boolean))]
      : null;
    try {
      const result = await plugin.exportReadingBackup(selected === null ? {} : { bookIds: selected });
      return {
        exported: result?.exported === true,
        cancelled: result?.cancelled === true
      };
    } catch {
      return { exported: false, cancelled: false };
    }
  }

  async function pickReadingRestore() {
    if (!plugin?.pickReadingRestore) return { cancelled: true };
    try { return normalizePlan(await plugin.pickReadingRestore()); }
    catch { return { cancelled: true }; }
  }

  async function applyReadingRestore({ restoreId, positionChoices = {} } = {}) {
    const id = clean(restoreId);
    if (!id || !plugin?.applyReadingRestore) return false;
    try {
      const result = await plugin.applyReadingRestore({
        restoreId: id,
        positionChoices: normalizeChoices(positionChoices)
      });
      return result === true || result?.restored === true;
    } catch {
      return false;
    }
  }

  async function cancelReadingRestore() {
    if (!plugin?.cancelReadingRestore) return true;
    try {
      const result = await plugin.cancelReadingRestore();
      return result === true || result?.cancelled === true;
    } catch {
      return false;
    }
  }

  async function checkReadingLibrary() {
    if (!plugin?.checkReadingLibrary) return { healthy: false, bookCount: 0, missingItems: [] };
    try {
      const result = await plugin.checkReadingLibrary();
      return {
        healthy: result?.healthy === true,
        bookCount: nonNegativeInteger(result?.bookCount),
        missingItems: (Array.isArray(result?.missingItems) ? result.missingItems : [])
          .map(normalizeMissingItem)
          .filter(Boolean)
      };
    } catch {
      return { healthy: false, bookCount: 0, missingItems: [] };
    }
  }

  async function deleteAllReadingData() {
    if (!plugin?.deleteAllReadingData) return false;
    try {
      const result = await plugin.deleteAllReadingData({ confirmed: true });
      return result === true || result?.deleted === true;
    } catch {
      return false;
    }
  }

  return {
    exportReadingBackup,
    pickReadingRestore,
    applyReadingRestore,
    cancelReadingRestore,
    checkReadingLibrary,
    deleteAllReadingData
  };
}
