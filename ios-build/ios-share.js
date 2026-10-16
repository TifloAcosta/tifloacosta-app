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

  async function shareBlob({ blob, name } = {}) {
    const transfer = window.Capacitor?.Plugins?.TifloShareInbox;
    if (!transfer?.shareData || !(blob instanceof Blob) || blob.size === 0 ||
        blob.size > 15 * 1024 * 1024) return 'unavailable';
    const filename = String(name || 'documento.txt').replace(/[\\/:*?"<>|]/g, '-').slice(0, 160);
    const base64 = await new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onerror = () => reject(new Error('file-read-failed'));
      fileReader.onload = () => {
        const value = String(fileReader.result || '');
        resolve(value.substring(value.indexOf(',') + 1));
      };
      fileReader.readAsDataURL(blob);
    });
    try {
      const result = await transfer.shareData({ name: filename, base64 });
      return result?.completed ? 'completed' : 'cancelled';
    } catch {
      return 'failed';
    }
  }

  window.TifloIOSShare = Object.freeze({ shareURL, shareBlob });
})();
