import { App } from '@capacitor/app';
import { TifloUpdate } from './native/update-plugin.mjs';
import { createUpdateSession } from './core/update-session.mjs';
import { renderUpdate } from './screens/update.mjs';

const DOWNLOADED = 11;
const session = createUpdateSession({ plugin: TifloUpdate });
let dialog = null;
let returnFocus = null;

function ensureDialog() {
  if (dialog?.isConnected) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'tiflo-update-dialog';
  dialog.setAttribute('aria-labelledby', 'tiflo-update-heading');
  dialog.addEventListener('cancel', event => {
    if (session.state().mode === 'immediate') {
      event.preventDefault();
      return;
    }
    session.dismissForSession();
  });
  document.body.append(dialog);
  return dialog;
}

function closeDialog() {
  if (dialog?.open) dialog.close();
  const target = returnFocus;
  returnFocus = null;
  queueMicrotask(() => {
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  });
}

function showDialog() {
  const target = ensureDialog();
  if (!target.open) returnFocus = document.activeElement;
  renderUpdate({
    root: target,
    session,
    lang: document.documentElement.lang === 'en' ? 'en' : 'es',
    onStart: closeDialog,
    onDismiss: closeDialog,
    onComplete: closeDialog
  });
  const heading = target.querySelector('h1');
  if (heading) heading.id = 'tiflo-update-heading';
  if (!target.open) target.showModal();
  queueMicrotask(() => heading?.focus());
}

export async function checkAndOfferUpdate() {
  const state = await session.check();
  if (state.prompt) showDialog();
  return state;
}

void checkAndOfferUpdate();
void App.addListener('resume', () => { void checkAndOfferUpdate(); });
void TifloUpdate.addListener('stateChange', event => {
  if (Number(event?.installStatus) === DOWNLOADED) {
    void checkAndOfferUpdate();
  }
});
