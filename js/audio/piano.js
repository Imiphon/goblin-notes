import { ENHARMONIC } from '../constants.js';
import { getCachedAsset } from '../assets/cache.js';

const audioBase = './assets/audio/piano/';
const MAX_NOTE_DURATION = 1.2; // seconds
const FADE_DURATION = 0.24; // seconds
const BOOST = 1.25;

const webAudioSupported =
  typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);

const bufferCache = new Map();
const bufferPromises = new Map();
const activeSources = new Set();

const htmlAudioCache = new Map();
const htmlAudioPromises = new Map();
const htmlActive = new Set();

let audioContext = null;
let contextUnlockPromise = null;

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

function getContext() {
  if (!webAudioSupported) return null;
  return audioContext;
}

function createContext() {
  if (!webAudioSupported) return null;
  if (!audioContext) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    audioContext = new Ctor();
  }
  return audioContext;
}

async function ensureContext(options = {}) {
  const { resume = false, allowCreate = false } = options;
  const ctx = allowCreate ? createContext() : getContext();
  if (!ctx) return null;
  if (resume && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (err) {
      if (!(err && err.name === 'NotAllowedError')) {
        console.error(err);
      }
    }
  }
  return ctx;
}

async function resumeContext() {
  const ctx = await ensureContext({ resume: true, allowCreate: true });
  return ctx;
}

export function unlockPianoContext(fromGesture = false) {
  if (!webAudioSupported) return Promise.resolve(null);
  if (fromGesture) {
    return resumeContext();
  }
  if (!contextUnlockPromise) {
    contextUnlockPromise = ensureContext();
  }
  return contextUnlockPromise;
}

function canUseWebAudio() {
  if (!webAudioSupported) return false;
  const ctx = getContext();
  return !!ctx && ctx.state === 'running';
}

async function fetchNoteBuffer(note) {
  const ctx = await ensureContext({ allowCreate: true });
  if (!ctx) return null;
  const file = audioBase + noteToFilename(note);
  const source = getCachedAsset(file) || file;
  if (bufferCache.has(file)) return bufferCache.get(file);
  if (!bufferPromises.has(file)) {
    bufferPromises.set(
      file,
      fetch(source)
        .then(response => {
          if (!response.ok) throw new Error(`Unable to fetch ${file}`);
          return response.arrayBuffer();
        })
        .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
        .then(buffer => {
          bufferCache.set(file, buffer);
          return buffer;
        })
        .catch(err => {
          console.error(err);
          bufferCache.delete(file);
          throw err;
        })
        .finally(() => {
          bufferPromises.delete(file);
        })
    );
  }
  return bufferPromises.get(file);
}

function scheduleFadeOut(item, now = getContext()?.currentTime ?? 0) {
  const ctx = getContext();
  if (!ctx) return;
  const end = now + FADE_DURATION;
  item.gain.gain.cancelScheduledValues(now);
  const current = item.gain.gain.value;
  item.gain.gain.setValueAtTime(current, now);
  item.gain.gain.linearRampToValueAtTime(0, end);
  try {
    item.source.stop(end + 0.01);
  } catch {
    // already stopped
  }
}

function clearFinishedSources() {
  const ctx = getContext();
  const now = ctx ? ctx.currentTime : 0;
  activeSources.forEach(item => {
    if (now >= item.stopTime) {
      activeSources.delete(item);
    }
  });
}

function fadeOutActiveSources() {
  clearFinishedSources();
  const ctx = getContext();
  const now = ctx ? ctx.currentTime : 0;
  activeSources.forEach(item => {
    scheduleFadeOut(item, now);
    activeSources.delete(item);
  });
}

async function webAudioPlay(note, velocity) {
  if (!canUseWebAudio()) {
    await ensureContext({ allowCreate: true });
    if (!canUseWebAudio()) {
      return htmlAudioPlay(note, velocity);
    }
  }
  const ctx = getContext();
  if (!ctx) return;
  const buffer = await fetchNoteBuffer(note);
  if (!buffer) return;
  fadeOutActiveSources();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  const peak = Math.min(1, Math.max(0, velocity * BOOST));
  const start = Math.max(ctx.currentTime, 0);
  const naturalStop = start + Math.min(buffer.duration, MAX_NOTE_DURATION);
  const fadeStop = naturalStop + FADE_DURATION;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.015);
  gain.gain.setValueAtTime(peak, naturalStop);
  gain.gain.linearRampToValueAtTime(0, fadeStop);

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(start);
  source.stop(fadeStop + 0.01);

  const item = { source, gain, stopTime: fadeStop };
  source.onended = () => {
    activeSources.delete(item);
  };
  activeSources.add(item);
}

function getHtmlAudio(note) {
  const file = audioBase + noteToFilename(note);
  const source = getCachedAsset(file) || file;
  let audio = htmlAudioCache.get(file);
  if (audio) {
    if (audio.src !== source) audio.src = source;
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return audio;
  }
  if (!audio) {
    audio = new Audio(source);
    audio.preload = 'auto';
    audio.playsInline = true;
    htmlAudioCache.set(file, audio);
  }
  if (htmlAudioPromises.has(file)) return htmlAudioPromises.get(file);
  htmlAudioPromises.set(
    file,
    new Promise(resolve => {
      const onReady = () => {
        cleanup();
        resolve(audio);
      };
      const onError = () => {
        cleanup();
        resolve(audio);
      };
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onError);
      };
      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });
      try {
        audio.load();
      } catch {
        resolve(audio);
      }
    }).finally(() => {
      htmlAudioPromises.delete(file);
    })
  );
  return htmlAudioPromises.get(file);
}

async function htmlAudioPlay(note, velocity) {
  fadeOutHtmlAudio();
  const base = await getHtmlAudio(note);
  const instance = base.cloneNode();
  instance.src = base.src;
  instance.playsInline = true;
  instance.volume = Math.min(1, Math.max(0, velocity * BOOST));
  instance.currentTime = 0;
  htmlActive.add(instance);
  const cleanup = () => {
    instance.pause();
    htmlActive.delete(instance);
  };
  instance.addEventListener('ended', cleanup, { once: true });
  instance.addEventListener('error', cleanup, { once: true });
  await instance.play().catch(() => cleanup());
  setTimeout(() => fadeOutHtmlInstance(instance), MAX_NOTE_DURATION * 1000);
}

function fadeOutHtmlAudio() {
  htmlActive.forEach(inst => fadeOutHtmlInstance(inst));
}

function fadeOutHtmlInstance(instance) {
  if (!htmlActive.has(instance)) return;
  const start = performance.now();
  const initial = instance.volume;
  const tick = now => {
    const ratio = Math.min(1, (now - start) / (FADE_DURATION * 1000));
    instance.volume = Math.max(0, initial * (1 - ratio));
    if (ratio < 1) {
      requestAnimationFrame(tick);
    } else {
      instance.pause();
      htmlActive.delete(instance);
    }
  };
  requestAnimationFrame(tick);
}

export async function playNote(note, velocity = 1.0) {
  if (webAudioSupported) {
    return webAudioPlay(note, velocity);
  }
  return htmlAudioPlay(note, velocity);
}

export async function preloadNotes(notes) {
  if (!notes || !notes.length) return;
  const unique = Array.from(new Set(notes));
  if (canUseWebAudio()) {
    await Promise.all(unique.map(note => fetchNoteBuffer(note).catch(() => null)));
  } else {
    await Promise.all(unique.map(note => getHtmlAudio(note).catch(() => null)));
  }
}
