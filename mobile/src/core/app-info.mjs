export async function loadAppInfo(appPlugin) {
  if (!appPlugin || typeof appPlugin.getInfo !== 'function') {
    return { version: '', build: '' };
  }

  try {
    const info = await appPlugin.getInfo();
    return {
      version: String(info?.version || '').trim(),
      build: String(info?.build || '').trim()
    };
  } catch {
    return { version: '', build: '' };
  }
}
