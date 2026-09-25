import { chooseUpdateMode } from './update-policy.mjs';

function cloneState(value) {
  return {
    status: value.status,
    info: value.info ? { ...value.info } : null,
    mode: value.mode,
    shouldPrompt: value.shouldPrompt,
    error: value.error
  };
}

export function createUpdateSession({ plugin } = {}) {
  let current = {
    status: 'idle',
    info: null,
    mode: 'none',
    shouldPrompt: false,
    error: ''
  };
  let promptedVersionCode = null;
  let dismissedVersionCode = null;

  async function check({ force = false } = {}) {
    try {
      if (!plugin || typeof plugin.check !== 'function') throw new Error('plugin unavailable');
      const info = await plugin.check();
      const mode = chooseUpdateMode(info);
      const versionCode = Number(info?.versionCode) || 0;

      if (!info?.available || mode === 'none') {
        current = { status: 'unavailable', info: info || null, mode: 'none', shouldPrompt: false, error: '' };
        return cloneState(current);
      }

      const downloaded = info?.downloaded === true;
      const alreadyDismissed = versionCode > 0 && dismissedVersionCode === versionCode;
      const alreadyPrompted = versionCode > 0 && promptedVersionCode === versionCode;
      const shouldPrompt = !alreadyDismissed && (downloaded || (!alreadyPrompted && (force || true)));

      if (shouldPrompt && versionCode > 0) promptedVersionCode = versionCode;
      current = {
        status: downloaded ? 'downloaded' : 'available',
        info: { ...info },
        mode,
        shouldPrompt,
        error: ''
      };
      return cloneState(current);
    } catch {
      current = { status: 'unavailable', info: null, mode: 'none', shouldPrompt: false, error: 'update_failed' };
      return cloneState(current);
    }
  }

  function dismissForSession() {
    const versionCode = Number(current.info?.versionCode) || 0;
    if (versionCode > 0) dismissedVersionCode = versionCode;
    current = { ...current, shouldPrompt: false };
    return cloneState(current);
  }

  async function start() {
    if (current.mode === 'immediate' && typeof plugin?.startImmediate === 'function') {
      await plugin.startImmediate();
      current = { ...current, status: 'updating', shouldPrompt: false };
      return cloneState(current);
    }
    if (current.mode === 'flexible' && typeof plugin?.startFlexible === 'function') {
      await plugin.startFlexible();
      current = { ...current, status: 'updating', shouldPrompt: false };
      return cloneState(current);
    }
    return cloneState(current);
  }

  async function complete() {
    if (current.status !== 'downloaded' || typeof plugin?.completeFlexible !== 'function') return false;
    try {
      await plugin.completeFlexible();
      current = { ...current, status: 'completing', shouldPrompt: false };
      return true;
    } catch {
      current = { ...current, status: 'downloaded', error: 'update_failed' };
      return false;
    }
  }

  function state() {
    return cloneState(current);
  }

  return { check, start, complete, dismissForSession, state };
}
