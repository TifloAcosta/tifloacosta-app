/**
 * Bridges actual, uniquely labeled mobile controls to UIKit VoiceOver Actions.
 * Never intercepts swipe events. Swipe up/down works when VoiceOver's rotor is
 * set to Actions, followed by double tap. Existing buttons remain the fallback.
 */
const ACTION_LABELS = Object.freeze({
  es: {
    open:'Abrir', play:'Reproducir', read:'Leer', youtube:'Abrir en YouTube',
    original:'Abrir original', share:'Compartir', favorite:'Favoritos',
    download:'Guardar o descargar', info:'Información', delete:'Eliminar',
    pause:'Pausar', listen:'Escuchar', queue:'Cola', options:'Más opciones'
  },
  en: {
    open:'Open', play:'Play', read:'Read', youtube:'Open in YouTube',
    original:'Open original', share:'Share', favorite:'Favorites',
    download:'Save or download', info:'Information', delete:'Delete',
    pause:'Pause', listen:'Listen', queue:'Queue', options:'More options'
  }
});
const MAX_TARGETS = 200;
const MAX_ACTIONS = 9;

function isVisible(element) {
  if (!element?.isConnected || element.hidden || element.disabled) return false;
  return !element.closest?.('[hidden], [aria-hidden="true"]');
}

export function collectIosVoiceOverTargets(root, { lang = 'es' } = {}) {
  const language = lang === 'en' ? 'en' : 'es';
  const targets = [];
  const handlers = new Map();
  const seen = new Set();
  const seenIds = new Set();
  for (const element of root?.querySelectorAll?.('[data-vo-target="true"]') || []) {
    if (!isVisible(element)) continue;
    const card = element.closest?.('article') || element.closest?.('[data-vo-card]') || element.parentElement;
    if (!card) continue;
    const label = String(element.getAttribute?.('aria-label') || element.textContent || '').trim();
    if (!label || seen.has(label)) continue; // Never target an ambiguous VoiceOver label.
    const id = String(element.id || '').trim();
    if (!id || seenIds.has(id)) continue; // Screen owns its stable, unique IDs.
    const actions = [];
    const localHandlers = new Map();
    for (const control of card.querySelectorAll?.('[data-vo-action]') || []) {
      if (!isVisible(control)) continue;
      const key = String(control.dataset?.voAction || '').trim();
      if (!Object.hasOwn(ACTION_LABELS[language], key) || localHandlers.has(key)) continue;
      if (actions.length >= MAX_ACTIONS) break;
      actions.push({ id:key, label:ACTION_LABELS[language][key] });
      localHandlers.set(key, control);
    }
    if (!actions.length) continue;
    seen.add(label);
    seenIds.add(id);
    targets.push({ id, label, actions });
    handlers.set(id, localHandlers);
    if (targets.length >= MAX_TARGETS) break;
  }
  return { targets, handlers };
}

export function createIosContextActions({ root, plugin, lang = () => 'es',
  observerFactory = callback => new MutationObserver(callback) } = {}) {
  let disposed = false;
  let scheduled = false;
  let currentHandlers = new Map();
  let lastSignature = '';
  let generation = 0;
  let updates = Promise.resolve();
  let subscription = null;
  let observer = null;

  function dispatch({ targetId, action } = {}) {
    const target = currentHandlers.get(String(targetId || ''))?.get(String(action || ''));
    if (!isVisible(target)) return false;
    target.click?.();
    return true;
  }

  function refresh() {
    if (disposed) return updates;
    const current = ++generation;
    const { targets, handlers } = collectIosVoiceOverTargets(root, { lang: lang() });
    currentHandlers = handlers;
    const signature = JSON.stringify(targets);
    if (lastSignature === signature) return updates;
    lastSignature = signature;
    // Serialize bridge updates. A delayed response from a prior screen must
    // never overwrite the currently visible screen's VoiceOver action list.
    updates = updates.catch(() => {}).then(async () => {
      if (disposed || generation !== current) return;
      try { await plugin?.registerAccessibleTargets?.({ targets }); }
      catch { /* Existing accessible controls remain available. */ }
    });
    return updates;
  }

  function schedule() {
    if (disposed || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void refresh();
    });
  }

  async function install() {
    if (!plugin?.registerAccessibleTargets || !plugin?.addListener) return;
    try { subscription = await plugin.addListener('targetAction', dispatch); }
    catch { return; }
    if (disposed) { await subscription?.remove?.(); return; }
    observer = observerFactory(schedule);
    observer?.observe?.(root, { childList:true, subtree:true });
    // Ensure first screen is registered before the asynchronous install ends.
    await refresh();
  }

  async function destroy() {
    disposed = true;
    observer?.disconnect?.();
    currentHandlers.clear();
    await subscription?.remove?.();
    await updates.catch(() => {});
    try { await plugin?.registerAccessibleTargets?.({ targets: [] }); } catch {}
  }

  return { install, refresh, dispatch, destroy };
}
