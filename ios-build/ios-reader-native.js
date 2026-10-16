(() => {
  'use strict';
  // This bridge ships ONLY inside the iOS app. No browser voices or remote translation.
  const tts = () => window.Capacitor?.Plugins?.TifloReadingTts;
  const translator = () => window.Capacitor?.Plugins?.TifloReadingLanguage;
  let voices = [];
  let pending = null;
  const bool = (x, field) => x === true || x?.[field] === true;
  const safe = async (run, fallback) => { try { return await run(); } catch { return fallback; } };

  const reader = {
    get hasNativeSpeech() { return !!tts()?.beginTtsSession; },
    get hasNativeTranslation() { return !!translator()?.translateBatch; },
    listVoices() { return voices.slice(); },
    onVoicesChanged: null,
    async refreshVoices() {
      if (pending) return pending;
      pending = safe(async () => {
        const result = await tts()?.listTtsVoices?.();
        const list = Array.isArray(result?.voices) ? result.voices : [];
        voices = list.filter(v => v?.id).map(v => ({
          id: String(v.id), name: String(v.name || v.id), locale: String(v.locale || ''),
          language: String(v.locale || '').split('-')[0], networkRequired: false
        }));
        reader.onVoicesChanged?.();
        return voices;
      }, []).finally(() => { pending = null; });
      return pending;
    },
    createSpeechAdapter() {
      return {
        beginTtsSession: async options => bool(await safe(() => tts()?.beginTtsSession?.(options), null), 'prepared'),
        appendTtsUnits: async options => {
          const result = await safe(() => tts()?.appendTtsUnits?.(options), null);
          return result != null && Number(result.appended) >= 0;
        },
        commitTtsSession: async options => bool(await safe(() => tts()?.commitTtsSession?.(options), null), 'prepared'),
        playTts: async () => bool(await safe(() => tts()?.playTts?.(), null), 'accepted'),
        pauseTts: async () => bool(await safe(() => tts()?.pauseTts?.(), null), 'paused'),
        seekTts: async options => bool(await safe(() => tts()?.seekTts?.(options), null), 'accepted'),
        getTtsState: async () => safe(() => tts()?.getTtsState?.(), {}),
        stopTts: async () => bool(await safe(() => tts()?.stopTts?.(), null), 'stopped'),
        addListener: async (name, callback) => safe(
          () => tts()?.addListener?.(name, callback),
          { remove: async () => {} }
        )
      };
    },
    createTranslationAdapter() {
      return {
        identifyLanguage: options => safe(() => translator()?.identifyLanguage?.(options), { language: 'und' }),
        listTranslationLanguages: () => safe(() => translator()?.listTranslationLanguages?.(), { languages: [] }),
        prepareTranslationPair: options => safe(() => translator()?.prepareTranslationPair?.(options), { ready: false }),
        downloadTranslationModel: () => Promise.resolve({ downloaded: false }),
        translateBatch: options => safe(() => translator()?.translateBatch?.(options), { translations: [], status: 'error' })
      };
    }
  };

  // iPhone: Importar opens Files itself; WKWebView's generic file input
  // would insert Camera/Photo Library/Files and an extra confirmation.
  const accessibility = () => window.Capacitor?.Plugins?.TifloReadingAccessibility;
  const iosText = (es, en) => document.documentElement.lang === 'en' ? en : es;

  function installNativeFilesImport() {
    const plugin = accessibility();
    const fileInput = document.getElementById('reading-file');
    const fileLabel = document.getElementById('reading-file-label');
    if (!plugin?.pickDocument || !fileInput || !fileLabel ||
        document.getElementById('ios-reading-import')) return;
    const trigger = document.createElement('button');
    trigger.id = 'ios-reading-import';
    trigger.type = 'button';
    trigger.className = 'button-link';
    trigger.textContent = iosText('Importar', 'Import');
    trigger.addEventListener('click', async () => {
      if (trigger.disabled) return;
      // Keep the Files sheet native and do not open an HTML file chooser.
      trigger.disabled = true;
      const originalLabel = trigger.textContent;
      try {
        const picked = await plugin.pickDocument();
        if (picked?.cancelled) return;
        if (!picked?.uri || !picked?.name) throw new Error('invalid-selection');
        const address = window.Capacitor?.convertFileSrc?.(picked.uri);
        if (!address) throw new Error('unreadable-file-url');
        const response = await fetch(address);
        if (!response.ok) throw new Error('file-read-failed');
        const blob = await response.blob();
        const file = new File([blob], String(picked.name), {
          type: blob.type || 'application/octet-stream',
          lastModified: Date.now()
        });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        // Reuse TifloLector's existing MP3/DAISY/PDF/document import handler.
        fileInput.value = '';
        fileInput.files = transfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        const status = document.getElementById('reading-status');
        if (status) status.textContent = iosText(
          'No se pudo importar el archivo seleccionado desde Archivos.',
          'The selected file could not be imported from Files.'
        );
      } finally {
        trigger.disabled = false;
        trigger.textContent = originalLabel;
      }
    });
    fileLabel.before(trigger);
    // Never leave a second "Open Files" action or camera/gallery sheet.
    fileLabel.hidden = true;
    fileInput.hidden = true;
    fileInput.style.display = 'none';
    fileInput.tabIndex = -1;
    fileInput.setAttribute('aria-hidden', 'true');
  }

  let nativeDocumentListenerInstalled = false;
  let activeDocumentId = '';
  let focusSequence = 0;
  const voiceOverActions = [
    ['open', 'Abrir para leer', 'Open for reading'],
    ['continue', 'Leer', 'Read'],
    ['translate', 'Traducir', 'Translate'],
    ['queue', 'Añadir o quitar de cola', 'Add or remove from queue'],
    ['info', 'Información', 'Information'],
    ['move', 'Mover a carpeta', 'Move to folder'],
    ['export', 'Exportar', 'Export'],
    ['share', 'Compartir', 'Share'],
    ['rename', 'Cambiar título', 'Rename document'],
    ['delete', 'Eliminar', 'Delete']
  ];

  // Keep native rotor actions tied to each focused document. No prior
  // activation and no secondary button needed while VoiceOver is running.
  function installLibraryNativeActions() {
    const plugin = accessibility();
    const list = document.getElementById('reading-library-list');
    if (!plugin?.setDocumentActions || !list || list.dataset.iosNativeActions) return;
    list.dataset.iosNativeActions = '1';
    let voiceOverEnabled = false;
    let nativeOpening = false;
    let suppressedDomFocusId = '';

    function dispatch(id, action) {
      const title = document.getElementById(id);
      const card = title?.closest('.reading-library-title-card');
      const bookId = card?.dataset.iosBookId;
      const api = window.TifloIOSBookActions;
      if (!title || !bookId || !api) return;
      if (action === 'open' || action === 'continue') { title.click(); return; }
      if (action === 'translate') {
        // Open the existing reader and move focus to its translation language
        // selector. Never launch a translation without a target language.
        const reader = document.getElementById('reading-reader');
        const translation = document.getElementById('reading-translation-web');
        const target = document.getElementById('reading-translation-target');
        const focusLanguages = () => {
          if (!reader || reader.hidden || !translation || translation.hidden || !target) return false;
          target.focus({ preventScroll: true });
          return true;
        };
        title.click();
        if (!focusLanguages() && reader) {
          const observer = new MutationObserver(() => {
            if (focusLanguages()) observer.disconnect();
          });
          observer.observe(reader, { attributes: true, attributeFilter: ['hidden'] });
          setTimeout(() => observer.disconnect(), 12000);
        }
        return;
      }
      if (action === 'export') { void api.exportBook(bookId, 'original'); return; }
      if (action === 'share') { void api.shareBook(bookId); return; }
      if (action === 'rename') { void api.renameBook(bookId); return; }
      if (action === 'delete') { void api.deleteBook(bookId); return; }
      if (action === 'queue') { void api.queueBook(bookId); return; }
      if (action === 'move') { window.TifloIOSFolders?.promptAssignment?.(bookId); return; }
      if (action === 'info') { void api.infoBook(bookId); }
    }

    if (!nativeDocumentListenerInstalled) {
      nativeDocumentListenerInstalled = true;
      void plugin.addListener('documentAction', ({ documentId, action }) => {
        const title = document.getElementById(String(documentId));
        if (title?.closest('.reading-library-title-card')) {
          dispatch(String(documentId), String(action));
        }
      }).catch(() => {});
      // Native UIKit cells send the action for their own document ID.
      void plugin.addListener('nativeListAction', ({ itemId, action }) => {
        const id = String(itemId || '');
        nativeOpening = false;
        suppressedDomFocusId = id;
        const title = document.getElementById(id);
        if (title?.closest('.reading-library-title-card')) {
          dispatch(id, String(action || ''));
        }
      }).catch(() => {});
      void plugin.addListener('nativeListClosed', ({ itemId }) => {
        nativeOpening = false;
        suppressedDomFocusId = String(itemId || '');
        const title = document.getElementById(suppressedDomFocusId);
        if (title?.isConnected) title.focus({ preventScroll: true });
      }).catch(() => {});
    }

    // UIKit is the single owner of VoiceOver focus. DOM focusin often
    // points elsewhere, causing the web bridge to erase the rotor actions.
    // El foco accesible de WKWebView no siempre genera focusin/focusout.
    // Registrar todos los títulos y dejar que UIKit detecte el foco real.
    let lastRegistered = '';
    const registerVisibleTitles = () => {
      if (!plugin.registerLibraryTitles) return;
      const documents = [...list.querySelectorAll('.reading-library-title')].map(title => ({
        id: title.id,
        label: title.getAttribute('aria-label') || title.textContent?.trim() || '',
        plainLabel: title.textContent?.trim() || '',
        actions: voiceOverActions.map(([id, es, en]) => ({ id, label: iosText(es, en) }))
      })).filter(item => item.id && item.label);
      const next = JSON.stringify(documents);
      if (next === lastRegistered) return;
      lastRegistered = next;
      void plugin.registerLibraryTitles({ documents, nativeRowsOnFocus: true })
        .then(reply => { voiceOverEnabled = reply?.voiceOverEnabled === true; })
        .catch(() => { voiceOverEnabled = false; });
    };
    // The application-wide UIKit catalogue owns native title focus. Do not
    // reopen a second UIKit screen merely because WKWebView sends focusin.
    registerVisibleTitles();
    const observer = new MutationObserver(registerVisibleTitles);
    observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
  }

  function installIOSReadingBridges() {
    installNativeFilesImport();
    installLibraryNativeActions();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installIOSReadingBridges, { once: true });
  } else {
    installIOSReadingBridges();
  }
  window.addEventListener('load', installIOSReadingBridges);

  window.TifloIOSReading = reader;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reader.refreshVoices();
  });
})();
