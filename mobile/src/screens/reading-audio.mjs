import { createReadingAudioController, READING_AUDIO_SLEEP_MINUTES } from '../core/reading-audio.mjs';
import { resolveReadingSettings } from '../core/reading-settings.mjs';
import { createReadingMarksPanel } from './reading-marks.mjs';

const AUDIO_TIMER_CHOICES = READING_AUDIO_SLEEP_MINUTES.length
  ? READING_AUDIO_SLEEP_MINUTES
  : [15, 30, 45, 60];

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    String(template || '')
  );
}

function clock(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function option(select, value, label) {
  const item = document.createElement('option');
  item.value = String(value);
  item.textContent = label;
  select.append(item);
}

export function createReadingAudioView({ root, panelsRoot = root, client, book, tracks = [], t }) {
  const section = document.createElement('section');
  section.className = 'reading-audio';
  section.setAttribute('aria-label', t('readingAudio.controls'));

  const status = document.createElement('p');
  status.className = 'reading-audio-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.textContent = t('readingAudio.preparing');

  const controls = document.createElement('div');
  controls.className = 'reading-audio-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', t('readingAudio.controls'));

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = t('readingAudio.play');

  const rewindButton = document.createElement('button');
  rewindButton.type = 'button';

  const forwardButton = document.createElement('button');
  forwardButton.type = 'button';

  const previousTrackButton = document.createElement('button');
  previousTrackButton.type = 'button';
  previousTrackButton.textContent = t('readingAudio.previousTrack');
  previousTrackButton.disabled = true;

  const nextTrackButton = document.createElement('button');
  nextTrackButton.type = 'button';
  nextTrackButton.textContent = t('readingAudio.nextTrack');
  nextTrackButton.disabled = true;

  const positionLabel = document.createElement('label');
  positionLabel.textContent = t('readingAudio.position');
  const position = document.createElement('input');
  position.type = 'range';
  position.id = `reading-audio-position-${book.id}`;
  position.min = '0';
  position.max = '0';
  position.step = '1000';
  position.value = String(Math.max(0, Number(book.mediaPositionMs) || 0));
  positionLabel.htmlFor = position.id;

  const speedLabel = document.createElement('label');
  speedLabel.textContent = t('readingAudio.speed');
  const speed = document.createElement('select');
  speed.id = `reading-audio-speed-${book.id}`;
  speedLabel.htmlFor = speed.id;
  for (const value of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]) option(speed, value, `${value}×`);

  const timerLabel = document.createElement('label');
  timerLabel.textContent = t('readingAudio.timer');
  const timer = document.createElement('select');
  timer.id = `reading-audio-timer-${book.id}`;
  timerLabel.htmlFor = timer.id;
  option(timer, '', t('readingAudio.timerOff'));
  for (const minutes of AUDIO_TIMER_CHOICES) {
    option(timer, minutes, format(t('readingAudio.timerMinutes'), { minutes }));
  }
  option(timer, 'track-end', t('readingAudio.trackEnd'));

  const marksButton = document.createElement('button');
  marksButton.type = 'button';
  marksButton.textContent = t('readingAudio.marks');

  controls.append(
    playButton,
    rewindButton,
    forwardButton,
    previousTrackButton,
    nextTrackButton,
    positionLabel,
    position,
    speedLabel,
    speed,
    timerLabel,
    timer,
    marksButton
  );
  section.append(status, controls);
  root.replaceChildren(section);

  let destroyed = false;
  let marksPanel = null;
  let controller = null;
  let audioTracks = Array.isArray(tracks) ? tracks : [];
  let effectiveSettings = resolveReadingSettings().effective;

  function applySkipLabels() {
    const seconds = effectiveSettings['audio.skipSeconds'];
    rewindButton.textContent = format(t('readingAudio.rewind'), { seconds });
    forwardButton.textContent = format(t('readingAudio.forward'), { seconds });
  }

  function renderState(snapshot = {}) {
    if (destroyed || !snapshot) return;
    const positionMs = Math.max(0, Number(snapshot.positionMs) || 0);
    const durationMs = Math.max(0, Number(snapshot.durationMs) || 0);
    const trackIndex = Math.max(0, Number(snapshot.trackIndex) || 0);
    const trackCount = Math.max(0, Number(snapshot.trackCount) || audioTracks.length);
    position.max = String(Math.max(durationMs, positionMs, 0));
    position.value = String(positionMs);
    position.disabled = durationMs <= 0;
    previousTrackButton.disabled = trackCount <= 1 || trackIndex <= 0;
    nextTrackButton.disabled = trackCount <= 1 || trackIndex >= trackCount - 1;
    playButton.textContent = snapshot.playing ? t('readingAudio.pause') : t('readingAudio.play');
    status.textContent = format(t('readingAudio.positionStatus'), {
      elapsed: clock(positionMs),
      remaining: clock(Math.max(0, durationMs - positionMs))
    });
  }

  async function saveBookSetting(key, value) {
    return client.setReadingSetting({ scope: 'book', bookId: book.id, key, value });
  }

  playButton.addEventListener('click', () => {
    void (async () => {
      if (!controller) return;
      const snapshot = controller.getState();
      const next = snapshot.playing ? await controller.pause() : await controller.play();
      if (next) renderState(next);
    })();
  });

  rewindButton.addEventListener('click', () => {
    if (controller) void controller.skip(-1).then(renderState);
  });

  forwardButton.addEventListener('click', () => {
    if (controller) void controller.skip(1).then(renderState);
  });

  previousTrackButton.addEventListener('click', () => {
    if (controller) void controller.previousTrack().then(renderState);
  });

  nextTrackButton.addEventListener('click', () => {
    if (controller) void controller.nextTrack().then(renderState);
  });

  position.addEventListener('change', () => {
    if (controller) void controller.seek(Number(position.value) || 0).then(renderState);
  });

  speed.addEventListener('change', () => {
    void (async () => {
      if (!controller) return;
      const selected = Number(speed.value) || 1;
      await saveBookSetting('audio.speed', selected);
      const next = await controller.setSpeed(selected);
      if (next) renderState(next);
    })();
  });

  timer.addEventListener('change', () => {
    if (!controller) return;
    const value = timer.value === 'track-end' ? 'track-end' : Number(timer.value) || 0;
    void controller.setSleepTimer(value).then(enabled => {
      status.textContent = enabled ? t('readingAudio.timerSet') : t('readingAudio.timerOffStatus');
    });
  });

  marksButton.addEventListener('click', () => marksPanel?.open());

  async function jumpToAudioMark(value = {}) {
    if (!controller) return;
    await controller.pause();
    const targetTrack = Math.max(0, Number(value.mediaTrackIndex) || 0);
    let currentTrack = controller.getState().trackIndex;
    const safetyLimit = Math.max(audioTracks.length, controller.getState().trackCount, 1) + 1;
    let moves = 0;
    while (currentTrack < targetTrack && moves < safetyLimit) {
      await controller.nextTrack();
      const next = controller.getState().trackIndex;
      if (next === currentTrack) break;
      currentTrack = next;
      moves += 1;
    }
    while (currentTrack > targetTrack && moves < safetyLimit * 2) {
      await controller.previousTrack();
      const next = controller.getState().trackIndex;
      if (next === currentTrack) break;
      currentTrack = next;
      moves += 1;
    }
    const next = await controller.seek(value.mediaPositionMs);
    if (next) renderState(next);
  }

  async function prepare() {
    const [stored, loadedTracks] = await Promise.all([
      client.getReadingSettings(book.id),
      audioTracks.length ? Promise.resolve(audioTracks) : client.listAudioTracks(book.id)
    ]);
    audioTracks = Array.isArray(loadedTracks) ? loadedTracks : [];
    effectiveSettings = resolveReadingSettings(stored.global, stored.book).effective;
    applySkipLabels();
    speed.value = String(effectiveSettings['audio.speed']);

    controller = createReadingAudioController({
      client,
      book,
      tracks: audioTracks,
      initialPosition: {
        trackIndex: book.mediaTrackIndex,
        positionMs: book.mediaPositionMs
      },
      settings: effectiveSettings,
      onPosition: renderState
    });

    marksPanel = createReadingMarksPanel({
      root: panelsRoot,
      client,
      bookId: book.id,
      t,
      getPosition: () => ({
        mediaTrackIndex: controller.getState().trackIndex,
        mediaPositionMs: controller.getState().positionMs
      }),
      getExcerpt: () => book.title || '',
      getReference: value => format(t('readingAudio.markReference'), {
        track: Math.max(0, Number(value?.mediaTrackIndex) || 0) + 1,
        time: clock(value?.mediaPositionMs)
      }),
      onJump: value => {
        void jumpToAudioMark(value);
      }
    });

    const prepared = await controller.prepare();
    if (destroyed) return null;
    if (!prepared) {
      status.textContent = t('readingAudio.unavailable');
      return null;
    }
    renderState(prepared);
    status.textContent = format(t('readingAudio.ready'), {
      elapsed: clock(prepared.positionMs),
      remaining: clock(Math.max(0, prepared.durationMs - prepared.positionMs))
    });
    queueMicrotask(() => {
      if (!destroyed) playButton.focus();
    });
    return prepared;
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    marksPanel?.destroy();
    marksPanel = null;
    if (controller) await controller.destroy();
  }

  return {
    prepare,
    destroy,
    element: section,
    getState: () => controller?.getState?.() || null
  };
}
