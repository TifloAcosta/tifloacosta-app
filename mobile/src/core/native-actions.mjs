export function createNativeActions({ appPlugin, sharePlugin, browserPlugin, savePlugin, tifloSharePlugin } = {}) {
  async function installBackHandler(router, { beforeBack = null } = {}) {
    if (!appPlugin?.addListener || !router?.back) return null;
    return appPlugin.addListener('backButton', async () => {
      if (typeof beforeBack === 'function' && await beforeBack()) return;
      const handled = router.back();
      if (!handled && appPlugin?.exitApp) await appPlugin.exitApp();
    });
  }

  async function share({ title = '', text = '', url = '' } = {}) {
    const cleanTitle = String(title || '').trim();
    const cleanText = String(text || '').trim();
    const cleanUrl = String(url || '').trim();
    if (!cleanTitle && !cleanText && !cleanUrl) return false;
    if (!sharePlugin?.share) return false;
    await sharePlugin.share({
      title: cleanTitle,
      text: cleanText,
      url: cleanUrl,
      dialogTitle: 'TifloAcosta'
    });
    return true;
  }

  async function openExternal(url) {
    const value = String(url || '').trim();
    if (!value || !browserPlugin?.open) return false;
    try {
      await browserPlugin.open({ url: value });
      return true;
    } catch {
      return false;
    }
  }

  async function saveFile({ url = '', filename = '', mimeType = 'application/octet-stream' } = {}) {
    const cleanUrl = String(url || '').trim();
    const cleanFilename = String(filename || '').trim();
    const cleanMimeType = String(mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
    if (!cleanUrl || !cleanFilename || !savePlugin?.saveUrl) return false;
    try {
      const result = await savePlugin.saveUrl({ url: cleanUrl, filename: cleanFilename, mimeType: cleanMimeType });
      return result?.saved === true;
    } catch {
      return false;
    }
  }

  async function finishSharedFlow() {
    if (!tifloSharePlugin?.finishShare) return false;
    try {
      const result = await tifloSharePlugin.finishShare();
      return result?.finished === true;
    } catch {
      return false;
    }
  }

  return { installBackHandler, share, openExternal, saveFile, finishSharedFlow };
}
