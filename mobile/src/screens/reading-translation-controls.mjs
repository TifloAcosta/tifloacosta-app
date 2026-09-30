import { resolveReadingSettings } from '../core/reading-settings.mjs';
import { createReadingTranslationClient } from '../core/reading-translation-client.mjs';
import { TifloReadingLanguage } from '../native/reading-language-plugin.mjs';
import { createReadingTranslationPanel } from './reading-translation-panel.mjs';

function text(t, key, es, en) {
  const translated = typeof t === 'function' ? t(key) : '';
  if (translated && translated !== key) return translated;
  return document.documentElement.lang === 'en' ? en : es;
}

function clean(value) {
  return String(value ?? '').trim();
}

function languageBase(value) {
  return clean(value).toLowerCase().split(/[-_]/u)[0];
}

function unitsFor(block) {
  const sentences = Array.isArray(block?.sentences)
    ? block.sentences.map(value => clean(value)).filter(Boolean)
    : [];
  if (sentences.length) return sentences;
  const value = clean(block?.text);
  return value ? [value] : [];
}

function currentRenderedPosition(readerContainer) {
  const element = readerContainer?.querySelector?.('[data-reading-unit="current"]');
  if (!element) return null;
  return {
    element,
    blockIndex: Math.max(0, Math.trunc(Number(element.dataset.blockIndex) || 0)),
    unitIndex: Math.max(0, Math.trunc(Number(element.dataset.unitIndex) || 0))
  };
}

function applyTranslatedUnit(readerContainer, translatedDocument) {
  const current = currentRenderedPosition(readerContainer);
  if (!current || !translatedDocument) return false;
  const block = translatedDocument?.blocks?.[current.blockIndex];
  const unitText = unitsFor(block)[current.unitIndex] || clean(block?.text);
  if (!unitText || current.element.textContent === unitText) return false;
  current.element.textContent = unitText;
  return true;
}

async function documentFingerprint(documentModel) {
  const source = JSON.stringify({
    language: documentModel?.language || '',
    blocks: (Array.isArray(documentModel?.blocks) ? documentModel.blocks : []).map(block => ({
      type: block?.type || '',
      text: block?.text || '',
      href: block?.href || '',
      page: block?.page || block?.pageNumber || null
    }))
  });
  try {
    if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}-${source.length}`;
}

function matchingVoice(voices, targetLanguage, preferredVoiceId = '') {
  const list = Array.isArray(voices) ? voices : [];
  const target = languageBase(targetLanguage);
  if (!target) return '';
  const preferred = list.find(voice => clean(voice?.id) === clean(preferredVoiceId));
  if (preferred && languageBase(preferred.locale) === target) return clean(preferred.id);
  return clean(list.find(voice => languageBase(voice?.locale) === target)?.id);
}

export function createReadingTranslationControls({
  root,
  client,
  bookId,
  speech,
  t,
  returnFocus
}) {
  const sourceDocumentModel = speech?.getDocument?.();
  if (!sourceDocumentModel?.blocks?.length) {
    return { destroy() {}, close() {} };
  }

  const readerContainer = root?.parentElement?.querySelector?.('.reading-reader') || null;
  const actions = document.createElement('div');
  actions.className = 'reading-translation-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', text(t, 'readingBook.translationHeading', 'Traducción', 'Translation'));

  const translateButton = document.createElement('button');
  translateButton.type = 'button';
  translateButton.textContent = text(t, 'readingBook.translate', 'Traducir', 'Translate');

  const viewLabel = document.createElement('span');
  viewLabel.textContent = text(t, 'readingBook.translationView', 'Versión', 'Version');

  const originalButton = document.createElement('button');
  originalButton.type = 'button';
  originalButton.textContent = text(t, 'readingBook.translationOriginal', 'Original', 'Original');
  originalButton.hidden = true;
  originalButton.setAttribute('aria-pressed', 'true');

  const translatedButton = document.createElement('button');
  translatedButton.type = 'button';
  translatedButton.textContent = text(t, 'readingBook.translationTranslated', 'Traducción', 'Translation');
  translatedButton.hidden = true;
  translatedButton.setAttribute('aria-pressed', 'false');

  const status = document.createElement('p');
  status.className = 'reading-translation-view-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  actions.append(translateButton, viewLabel, originalButton, translatedButton, status);
  root.prepend(actions);

  const translationClient = createReadingTranslationClient(TifloReadingLanguage);
  let translationPanel = null;
  let translationDocument = null;
  let targetLanguage = '';
  let showingTranslation = false;
  let destroyed = false;
  let observer = null;
  let originalVoiceId = '';

  function updateViewButtons() {
    const available = Boolean(translationDocument?.blocks?.length);
    originalButton.hidden = !available;
    translatedButton.hidden = !available;
    originalButton.setAttribute('aria-pressed', showingTranslation ? 'false' : 'true');
    translatedButton.setAttribute('aria-pressed', showingTranslation ? 'true' : 'false');
  }

  function startObserver() {
    if (!readerContainer || observer || !globalThis.MutationObserver) return;
    observer = new MutationObserver(() => {
      if (showingTranslation && translationDocument) {
        queueMicrotask(() => {
          if (!destroyed && showingTranslation) applyTranslatedUnit(readerContainer, translationDocument);
        });
      }
    });
    observer.observe(readerContainer, { childList: true, subtree: true, characterData: true });
  }

  async function preferredVoiceForTarget(language) {
    try {
      const [stored, voices] = await Promise.all([
        client.getReadingSettings(bookId),
        client.listTtsVoices()
      ]);
      const resolved = resolveReadingSettings(stored?.global, stored?.book, { availableVoices: voices });
      originalVoiceId = clean(resolved?.effective?.['speech.voice']);
      return matchingVoice(voices, language, originalVoiceId);
    } catch {
      return '';
    }
  }

  async function showTranslation() {
    if (!translationDocument?.blocks?.length || showingTranslation || destroyed) return false;
    showingTranslation = true;
    const targetVoiceId = await preferredVoiceForTarget(targetLanguage || translationDocument.targetLanguage || translationDocument.language);
    await speech?.setDocument?.(translationDocument);
    speech?.setVoice?.(targetVoiceId);
    applyTranslatedUnit(readerContainer, translationDocument);
    updateViewButtons();
    status.textContent = text(t, 'readingBook.translationShowing', 'Mostrando la traducción.', 'Showing translation.');
    startObserver();
    return true;
  }

  async function showOriginal() {
    if (!showingTranslation || destroyed) return false;
    showingTranslation = false;
    await speech?.setDocument?.(sourceDocumentModel);
    speech?.setVoice?.(originalVoiceId);
    updateViewButtons();
    const current = speech?.snapshot?.().position;
    if (current && readerContainer) {
      const rendered = currentRenderedPosition(readerContainer);
      const block = sourceDocumentModel?.blocks?.[current.blockIndex];
      const unitText = unitsFor(block)[current.unitIndex] || clean(block?.text);
      if (rendered?.element && unitText) rendered.element.textContent = unitText;
    }
    status.textContent = text(t, 'readingBook.translationShowingOriginal', 'Mostrando el original.', 'Showing original.');
    return true;
  }

  async function ensurePanel() {
    if (translationPanel || destroyed) return translationPanel;
    const sourceSha256 = await documentFingerprint(sourceDocumentModel);
    if (destroyed) return null;
    translationPanel = createReadingTranslationPanel({
      root,
      client,
      translationClient,
      book: { id: bookId, language: sourceDocumentModel.language },
      documentModel: sourceDocumentModel,
      sourceSha256,
      t,
      onTranslationReady(documentModel, state) {
        translationDocument = documentModel;
        targetLanguage = clean(state?.targetLanguage || documentModel?.targetLanguage || documentModel?.language);
        updateViewButtons();
      },
      returnFocus() {
        translateButton.focus();
      }
    });
    return translationPanel;
  }

  translateButton.addEventListener('click', () => {
    void (async () => {
      const panel = await ensurePanel();
      if (!destroyed) panel?.open?.();
    })();
  });
  originalButton.addEventListener('click', () => { void showOriginal(); });
  translatedButton.addEventListener('click', () => { void showTranslation(); });

  function close() {
    translationPanel?.close?.();
  }

  function destroy() {
    destroyed = true;
    observer?.disconnect?.();
    observer = null;
    translationPanel?.destroy?.();
    translationPanel = null;
    actions.remove();
  }

  updateViewButtons();
  return { destroy, close, showOriginal, showTranslation, element: actions };
}
