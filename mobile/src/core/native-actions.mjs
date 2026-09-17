export function createNativeActions({ appPlugin, sharePlugin, browserPlugin } = {}) {
  async function installBackHandler(router) {
    if (!appPlugin?.addListener || !router?.back) return null;
    return appPlugin.addListener('backButton', async () => {
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
    await browserPlugin.open({ url: value });
    return true;
  }

  return { installBackHandler, share, openExternal };
}
