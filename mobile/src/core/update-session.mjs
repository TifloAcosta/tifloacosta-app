import { chooseUpdateMode } from './update-policy.mjs';

export function createUpdateSession({ plugin } = {}) {
  let current = {
    info: null,
    mode: 'none',
    prompt: false,
    dismissedVersionCode: null
  };

  function snapshot() {
    return {
      info: current.info,
      mode: current.mode,
      prompt: current.prompt,
      dismissedVersionCode: current.dismissedVersionCode
    };
  }

  async function check() {
    if (!plugin || typeof plugin.check !== 'function') {
      current = { ...current, info: null, mode: 'none', prompt: false };
      return snapshot();
    }
    try {
      const info = await plugin.check();
      const mode = chooseUpdateMode(info);
      const versionCode = Number(info?.versionCode || 0);
      const dismissed = mode !== 'immediate' && versionCode > 0 && current.dismissedVersionCode === versionCode;
      current = {
        ...current,
        info,
        mode,
        prompt: mode !== 'none' && !dismissed
      };
      return snapshot();
    } catch {
      current = { ...current, info: null, mode: 'none', prompt: false };
      return snapshot();
    }
  }

  async function start() {
    if (current.mode === 'immediate' && typeof plugin?.startImmediate === 'function') {
      return plugin.startImmediate();
    }
    if (current.mode === 'flexible' && typeof plugin?.startFlexible === 'function') {
      return plugin.startFlexible();
    }
    return { started: false };
  }

  async function complete() {
    if (typeof plugin?.completeFlexible !== 'function') return { completed: false };
    return plugin.completeFlexible();
  }

  function dismissForSession() {
    if (current.mode === 'immediate') {
      current = { ...current, prompt: true };
      return false;
    }
    const versionCode = Number(current.info?.versionCode || 0);
    current = {
      ...current,
      prompt: false,
      dismissedVersionCode: versionCode > 0 ? versionCode : current.dismissedVersionCode
    };
    return true;
  }

  return { check, start, complete, dismissForSession, state: snapshot };
}
