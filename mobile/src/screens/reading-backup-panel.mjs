import { createReadingBackupClient } from '../core/reading-backup-client.mjs';
import { TifloReadingBackup } from '../native/reading-backup-plugin.mjs';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'select:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function bilingual(es, en) {
  return document.documentElement.lang === 'en' ? en : es;
}

function focusableElements(section) {
  return Array.from(section.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

export function createReadingBackupPanel({ root, returnFocus, client = createReadingBackupClient(TifloReadingBackup) }) {
  const section = document.createElement('section');
  section.className = 'reading-panel reading-backup-panel';
  section.hidden = true;
  section.tabIndex = -1;
  section.setAttribute('role', 'dialog');
  section.setAttribute('aria-modal', 'true');

  const heading = document.createElement('h2');
  heading.id = 'reading-backup-heading';
  heading.textContent = bilingual('Copia y restauración', 'Backup and restore');
  section.setAttribute('aria-labelledby', heading.id);

  const explanation = document.createElement('p');
  explanation.textContent = bilingual(
    'La copia incluye documentos, posiciones, marcas, cola y ajustes de lectura. La restauración se revisa antes de aplicar cambios.',
    'The backup includes documents, positions, marks, queue and reading settings. A restore is reviewed before changes are applied.'
  );

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = bilingual('Exportar toda la biblioteca', 'Export entire library');

  const restoreButton = document.createElement('button');
  restoreButton.type = 'button';
  restoreButton.textContent = bilingual('Restaurar desde una copia', 'Restore from backup');

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const planSection = document.createElement('section');
  planSection.hidden = true;
  const planHeading = document.createElement('h3');
  planHeading.textContent = bilingual('Revisar restauración', 'Review restore');
  const planSummary = document.createElement('p');
  const conflictsHost = document.createElement('div');

  const applyButton = document.createElement('button');
  applyButton.type = 'button';
  applyButton.textContent = bilingual('Aplicar restauración', 'Apply restore');
  applyButton.disabled = true;

  const cancelRestore = document.createElement('button');
  cancelRestore.type = 'button';
  cancelRestore.textContent = bilingual('Cancelar restauración', 'Cancel restore');
  cancelRestore.hidden = true;

  planSection.append(planHeading, planSummary, conflictsHost, applyButton, cancelRestore);

  const returnButton = document.createElement('button');
  returnButton.type = 'button';
  returnButton.textContent = bilingual('Volver a la lectura', 'Return to reading');

  section.append(heading, explanation, exportButton, restoreButton, status, planSection, returnButton);
  root.append(section);

  let restorePlan = null;
  let destroyed = false;
  let lastInvoker = null;

  function choicesFromForm() {
    const choices = {};
    for (const select of conflictsHost.querySelectorAll('select[data-conflict-sha]')) {
      choices[select.dataset.conflictSha] = select.value === 'use-backup' ? 'use-backup' : 'keep-current';
    }
    return choices;
  }

  function renderPlan(plan) {
    restorePlan = plan;
    conflictsHost.replaceChildren();
    planSection.hidden = false;
    cancelRestore.hidden = false;
    applyButton.disabled = false;
    const additions = plan.additions?.length || 0;
    const duplicates = plan.duplicates?.length || 0;
    const conflicts = plan.positionConflicts?.length || 0;
    planSummary.textContent = bilingual(
      `Se añadirán ${additions} documentos; ${duplicates} ya existen; hay ${conflicts} conflictos de posición.`,
      `${additions} documents will be added; ${duplicates} already exist; there are ${conflicts} position conflicts.`
    );

    for (const [index, conflict] of (plan.positionConflicts || []).entries()) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = bilingual(
        `Conflicto de posición ${index + 1}`, 
        `Position conflict ${index + 1}`
      );
      const details = document.createElement('p');
      details.textContent = bilingual(
        `Posición actual: ${Math.round(conflict.currentPercent)} %. Posición de la copia: ${Math.round(conflict.backupPercent)} %.`,
        `Current position: ${Math.round(conflict.currentPercent)}%. Backup position: ${Math.round(conflict.backupPercent)}%.`
      );
      const label = document.createElement('label');
      label.textContent = bilingual('Qué posición conservar', 'Position to keep');
      const select = document.createElement('select');
      select.dataset.conflictSha = conflict.sha256;
      const keep = document.createElement('option');
      keep.value = 'keep-current';
      keep.textContent = bilingual('Mantener posición actual', 'Keep current position');
      const useBackup = document.createElement('option');
      useBackup.value = 'use-backup';
      useBackup.textContent = bilingual('Usar posición de la copia', 'Use backup position');
      select.append(keep, useBackup);
      label.append(select);
      fieldset.append(legend, details, label);
      conflictsHost.append(fieldset);
    }
  }

  function clearPlan() {
    restorePlan = null;
    planSection.hidden = true;
    planSummary.textContent = '';
    conflictsHost.replaceChildren();
    applyButton.disabled = true;
    cancelRestore.hidden = true;
  }

  function trapFocus(event) {
    if (event.key === 'Tab') {
      const controls = focusableElements(section);
      if (!controls.length) {
        event.preventDefault();
        section.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  async function cancelPendingRestore() {
    if (restorePlan) await client.cancelReadingRestore();
    clearPlan();
  }

  exportButton.addEventListener('click', () => {
    void (async () => {
      exportButton.disabled = true;
      status.textContent = bilingual('Preparando copia…', 'Preparing backup…');
      const result = await client.exportReadingBackup(null);
      exportButton.disabled = false;
      if (destroyed) return;
      status.textContent = result.exported
        ? bilingual('Copia guardada.', 'Backup saved.')
        : result.cancelled
          ? bilingual('Copia cancelada.', 'Backup cancelled.')
          : bilingual('No se pudo guardar la copia.', 'The backup could not be saved.');
    })();
  });

  restoreButton.addEventListener('click', () => {
    void (async () => {
      await cancelPendingRestore();
      restoreButton.disabled = true;
      status.textContent = bilingual('Revisando copia…', 'Reviewing backup…');
      const plan = await client.pickReadingRestore();
      restoreButton.disabled = false;
      if (destroyed) return;
      if (plan.cancelled) {
        status.textContent = bilingual('Restauración cancelada.', 'Restore cancelled.');
        return;
      }
      renderPlan(plan);
      status.textContent = bilingual('Revisa los cambios antes de restaurar.', 'Review the changes before restoring.');
      queueMicrotask(() => applyButton.focus());
    })();
  });

  applyButton.addEventListener('click', () => {
    void (async () => {
      if (!restorePlan) return;
      applyButton.disabled = true;
      status.textContent = bilingual('Restaurando…', 'Restoring…');
      const restored = await client.applyReadingRestore({
        restoreId: restorePlan.restoreId,
        positionChoices: choicesFromForm()
      });
      if (destroyed) return;
      if (restored) {
        clearPlan();
        status.textContent = bilingual('Restauración completada.', 'Restore completed.');
      } else {
        applyButton.disabled = false;
        status.textContent = bilingual('No se pudo completar la restauración.', 'The restore could not be completed.');
      }
    })();
  });

  cancelRestore.addEventListener('click', () => {
    void (async () => {
      await cancelPendingRestore();
      status.textContent = bilingual('Restauración cancelada.', 'Restore cancelled.');
      restoreButton.focus();
    })();
  });

  function close() {
    section.hidden = true;
    const invoker = lastInvoker;
    lastInvoker = null;
    if (invoker && invoker.isConnected !== false) invoker.focus();
    else returnFocus?.();
  }

  returnButton.addEventListener('click', close);
  section.addEventListener('keydown', trapFocus);

  function open() {
    lastInvoker = document.activeElement && typeof document.activeElement.focus === 'function'
      ? document.activeElement
      : null;
    section.hidden = false;
    queueMicrotask(() => exportButton.focus());
  }

  function destroy() {
    destroyed = true;
    void cancelPendingRestore();
    section.remove();
  }

  return { open, close, destroy };
}
