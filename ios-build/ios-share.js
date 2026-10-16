(() => {
  'use strict';

  // The iOS bundle alone loads this bridge. The public web and Android UI
  // retain their own sharing behavior.
  const nativeShare = () => window.Capacitor?.Plugins?.Share;
  const PUBLIC_ORIGIN = 'https://tifloacosta.com/';

  function publicURL(raw) {
    const value = String(raw || '').trim();
    if (!value || value.startsWith('#') || value.startsWith('//')) return '';
    try {
      // A packaged relative asset lives at capacitor://localhost but
      // recipients need a public HTTPS URL, never the app-internal origin.
      const parsed = new URL(value, PUBLIC_ORIGIN);
      return ['https:', 'http:'].includes(parsed.protocol) &&
        parsed.username === '' && parsed.password === '' ? parsed.href : '';
    } catch {
      return '';
    }
  }

  async function shareURL({ url, title = '', text = '' } = {}) {
    const link = publicURL(url);
    if (!link || !nativeShare()?.share) return 'unavailable';
    try {
      await nativeShare().share({
        title: String(title || '').slice(0, 400),
        text: String(text || '').slice(0, 1500),
        url: link
      });
      // The system sheet closed; this is not a delivery receipt.
      return 'dismissed';
    } catch (error) {
      if (/cancel|abort|dismiss/i.test(String(error?.message || error))) {
        return 'cancelled';
      }
      return 'failed';
    }
  }

  window.TifloIOSShare = Object.freeze({ shareURL });
})();
