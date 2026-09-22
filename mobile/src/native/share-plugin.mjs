import { registerPlugin } from '@capacitor/core';

const NativeTifloShare = registerPlugin('TifloShare');

export function createSharePlugin(plugin = NativeTifloShare) {
  async function getInitialShare() {
    if (!plugin?.getInitialShare) return { shared: false, text: '' };
    try {
      const result = await plugin.getInitialShare();
      return {
        shared: result?.shared === true,
        text: result?.shared === true ? String(result?.text || '').trim() : ''
      };
    } catch {
      return { shared: false, text: '' };
    }
  }

  async function addListener(eventName, listener) {
    if (!plugin?.addListener || typeof listener !== 'function') {
      return { remove: async () => {} };
    }
    try {
      return await plugin.addListener(eventName, listener);
    } catch {
      return { remove: async () => {} };
    }
  }

  async function finishShare() {
    if (!plugin?.finishShare) return { finished: false };
    try {
      const result = await plugin.finishShare();
      return { finished: result?.finished === true };
    } catch {
      return { finished: false };
    }
  }

  return { getInitialShare, addListener, finishShare };
}

export const TifloShare = createSharePlugin();
