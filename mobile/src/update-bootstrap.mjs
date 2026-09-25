import { App } from '@capacitor/app';
import { TifloUpdate } from './native/update-plugin.mjs';
import { createUpdateSession } from './core/update-session.mjs';
import { renderUpdate } from './screens/update.mjs';

const session = createUpdateSession({ plugin: TifloUpdate });
let dialog = null;

function ensureDialog() {
  if (dialog?.isConnected) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'tiflo-update-dialog';
  dialog.setAttribute('aria-labelledby', 'tiflo-update-heading');
  document.body.append(dialog);
  return dialog;
}

function closeDialog() {
  if (dialog?.open) dialog.close();
}

function showDialog() {
  const target = ensureDialog();
  renderUpdate({
    root: target,
    session,
    lang: document.documentElement.lang === 'en' ? 'en' : 'es',
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
