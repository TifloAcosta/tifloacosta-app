export function createShareService({ sharePlugin = null, navigatorObj = globalThis.navigator } = {}) {
  return {
    async shareLink({ title = '', text = '', url = '' }) {
      const options = {};
      if (title) options.title = title;
      if (text) options.text = text;
      if (url) options.url = url;

      if (sharePlugin && typeof sharePlugin.share === 'function') {
        await sharePlugin.share(options);
        return { shared: true, via: 'native' };
      }

      if (navigatorObj && typeof navigatorObj.share === 'function') {
        await navigatorObj.share(options);
        return { shared: true, via: 'web' };
      }

      return { shared: false, via: 'unavailable' };
    }
  };
}