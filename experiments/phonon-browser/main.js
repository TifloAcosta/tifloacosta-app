import { PhononTTS } from 'phonon-tts';
const $ = id => document.getElementById(id);
let engine = null;
let audioUrl = null;
let busy = false;
const status = text => { $('status').textContent = text; };
$('load').addEventListener('click', async () => {
  if (busy || engine) return;
  busy = true;
  $('load').disabled = true;
  status('Descargando e iniciando el modelo de prueba. No cierres esta pestaña.');
  try {
    engine = await PhononTTS.load({ lang: 'en' });
    status('Motor local cargado. Ya puedes escuchar una muestra en inglés.');
    $('play').disabled = false;
  } catch (error) {
    status('No se ha podido cargar el motor en este navegador. Comprueba la conexión, la compatibilidad y el espacio disponible.');
    $('load').disabled = false;
  } finally { busy = false; }
});
$('play').addEventListener('click', async () => {
  if (!engine || busy) return;
  const text = $('sample').value.trim();
  if (!text || text.length > 300) {
    status('Escribe un texto de entre 1 y 300 caracteres.');
    return;
  }
  busy = true;
  $('play').disabled = true;
  status('Generando audio localmente.');
  try {
    const audio = await engine.synthWav(text);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(audio);
    $('audio').src = audioUrl;
    $('stop').disabled = false;
    await $('audio').play();
    status('Muestra reproducida. Puedes detenerla con el botón Detener.');
  } catch (error) {
    status('No se pudo generar o reproducir el audio. Prueba otra vez o cambia de navegador.');
  } finally { busy = false; $('play').disabled = false; }
});
$('stop').addEventListener('click', () => {
  $('audio').pause();
  $('audio').currentTime = 0;
  status('Reproducción detenida.');
});
window.addEventListener('pagehide', () => {
  $('audio').pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  engine?.dispose?.();
});
