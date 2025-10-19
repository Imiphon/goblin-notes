import { ENHARMONIC } from '../constants.js';

const audioBase = './assets/audio/piano/';
const audioCache = new Map();
const audioLoadPromises = new Map();
const activeInstances = new Set();
const MAX_NOTE_DURATION_MS = 1200;
const FADE_DURATION_MS = 240;

function noteToFilename(note) {
  const match = note.match(/^([A-G][b#]?)(\d)$/);
  if (!match) throw new Error(`Invalid note ${note}`);
  let [, name, octave] = match;
  if (name.endsWith('b')) {
    const enharmonic = ENHARMONIC[`${name[0]}b`];
    if (enharmonic) name = enharmonic;
  }
  return `${name}${octave}.mp3`.toLowerCase().replace('#', '%23');
}

async function ensureAudioBuffer(note) {
  const file = audioBase + noteToFilename(note);
  let audio = audioCache.get(file);
  if (audio && audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return audio;
  if (!audio) {
    audio = new Audio(file);
    audio.preload = 'auto';
    audioCache.set(file, audio);
  }
  if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return audio;
  if (!audioLoadPromises.has(file)) {
    audioLoadPromises.set(
      file,
      new Promise((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onReady);
          audio.removeEventListener('error', onError);
        };
        const onReady = () => {
          cleanup();
          resolve(audio);
        };
        const onError = () => {
          cleanup();
          reject(new Error(`Unable to load ${file}`));
        };
        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.addEventListener('error', onError, { once: true });
        try {
          audio.load();
        } catch {
          // ignored
        }
      }).finally(() => {
        audioLoadPromises.delete(file);
      })
    );
  }
  try {
    return await audioLoadPromises.get(file);
  } catch (err) {
    console.error(err);
    return audio;
  }
}

export async function playNote(note, velocity = 1.0) {
  fadeOutActiveInstances();
  const buffer = await ensureAudioBuffer(note);
  const instance = buffer.cloneNode();
  const boosted = Math.min(1, velocity * 1.3);
  instance.volume = Math.max(0, boosted);
  instance.currentTime = 0;
  activeInstances.add(instance);
  const cleanup = () => {
    instance.pause();
    activeInstances.delete(instance);
  };
  instance.addEventListener('ended', cleanup, { once: true });
  instance.addEventListener('error', cleanup, { once: true });
  await instance.play().catch(() => cleanup());
  setTimeout(() => fadeOutInstance(instance), MAX_NOTE_DURATION_MS);
}

export async function preloadNotes(notes) {
  if (!notes || !notes.length) return;
  const unique = Array.from(new Set(notes));
  await Promise.all(unique.map(note => ensureAudioBuffer(note).catch(() => null)));
}

function fadeOutActiveInstances() {
  activeInstances.forEach(inst => fadeOutInstance(inst));
}

function fadeOutInstance(instance) {
  if (!activeInstances.has(instance)) return;
  const startVolume = Math.min(1, Math.max(0, instance.volume));
  const startTime = performance.now();
  const tick = now => {
    const elapsed = now - startTime;
    const ratio = Math.min(1, Math.max(0, elapsed / FADE_DURATION_MS));
    const targetVolume = Math.max(0, startVolume * (1 - ratio));
    instance.volume = Math.min(1, targetVolume);
    if (ratio < 1) {
      requestAnimationFrame(tick);
    } else {
      instance.pause();
      activeInstances.delete(instance);
    }
  };
  requestAnimationFrame(tick);
}
