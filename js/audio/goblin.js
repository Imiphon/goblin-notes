import { GOBLIN_STATES } from '../constants.js';
import { goblinImg } from '../ui/dom.js';
import { getCachedAsset } from '../assets/cache.js';

const audioBase = './assets/audio/goblin/';
const audioCache = new Map();
const loadPromises = new Map();

let helloPlaybackUnlocked = false;

let currentAudio = null;
let pendingPlayback = Promise.resolve();
let playbackGeneration = 0;

async function ensureGoblinAudio(name) {
  const file = `${audioBase}${name}.mp3`;
  const source = getCachedAsset(file) || file;
  let audio = audioCache.get(file);
  if (audio && audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return audio;
  if (!audio) {
    audio = new Audio(source);
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.crossOrigin = 'anonymous';
    audioCache.set(file, audio);
  }
  if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return audio;
  if (!loadPromises.has(file)) {
    loadPromises.set(
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
          reject(new Error(`Unable to load goblin audio ${file}`));
        };
        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.addEventListener('error', onError, { once: true });
        try {
          audio.load();
        } catch {
          // ignored
        }
      }).finally(() => {
        loadPromises.delete(file);
      })
    );
  }
  try {
    return await loadPromises.get(file);
  } catch (err) {
    console.error(err);
    return audio;
  }
}

function setGoblinVisual(meta) {
  if (!goblinImg || !meta) return;
  if (goblinImg.dataset.state !== meta.img) {
    const path = `assets/images/goblin/${meta.img}.png`;
    const cached = getCachedAsset(path);
    goblinImg.src = cached || `./${path}`;
    goblinImg.dataset.state = meta.img;
  }
  goblinImg.alt = meta.alt;
}

export function showGoblin(state, playAudio = true) {
  const meta = GOBLIN_STATES[state];
  if (!meta) return Promise.resolve();
  const generation = ++playbackGeneration;
  setGoblinVisual(meta);
  if (playAudio) {
    const queued = pendingPlayback
      .catch(() => {})
      .then(async () => {
        if (generation !== playbackGeneration) return;
        try {
          const buffer = await ensureGoblinAudio(meta.audio);
          if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
          }
          const instance = buffer.cloneNode();
          instance.playsInline = true;
          instance.crossOrigin = 'anonymous';
          instance.currentTime = 0;
          instance.volume = 0.55;
          currentAudio = instance;
          await new Promise(resolve => {
            const cleanup = () => {
              instance.removeEventListener('ended', cleanup);
              instance.removeEventListener('pause', cleanup);
              instance.removeEventListener('error', cleanup);
              if (currentAudio === instance) currentAudio = null;
              if (generation === playbackGeneration) {
                setGoblinVisual(GOBLIN_STATES.hello);
              }
              resolve();
            };
            instance.addEventListener('ended', cleanup, { once: true });
            instance.addEventListener('pause', cleanup, { once: true });
            instance.addEventListener('error', cleanup, { once: true });
            const markSuccess = () => {
              if (state === 'hello') {
                helloPlaybackUnlocked = true;
              }
            };
            const handleBlocked = err => {
              if (state === 'hello') {
                helloPlaybackUnlocked = false;
              }
              cleanup();
              if (err && err.name !== 'NotAllowedError') {
                console.error(err);
              }
            };
            try {
              const playResult = instance.play();
              if (playResult && typeof playResult.then === 'function') {
                playResult.then(markSuccess).catch(handleBlocked);
              } else {
                markSuccess();
              }
            } catch (err) {
              handleBlocked(err);
            }
          });
        } catch (err) {
          console.error(err);
        }
      });
    pendingPlayback = queued.catch(() => {});
    return queued;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (state !== 'hello') {
    setGoblinVisual(GOBLIN_STATES.hello);
  }
  pendingPlayback = Promise.resolve();
  return pendingPlayback;
}

export function hasHelloGreetingPlayed() {
  return helloPlaybackUnlocked;
}

export async function warmUpGoblinHello() {
  try {
    const audio = await ensureGoblinAudio(GOBLIN_STATES.hello.audio);
    if (!audio) return;
    const wasMuted = audio.muted;
    audio.muted = true;
    audio.currentTime = 0;
    await audio.play().catch(() => {});
    audio.pause();
    audio.currentTime = 0;
    audio.muted = wasMuted;
  } catch (err) {
    console.error(err);
  }
}

export async function preloadGoblinHello() {
  try {
    await ensureGoblinAudio(GOBLIN_STATES.hello.audio);
  } catch (err) {
    console.error(err);
  }
}

export async function preloadGoblinAudio() {
  const uniqueNames = Array.from(new Set(Object.values(GOBLIN_STATES).map(meta => meta.audio)));
  await Promise.all(uniqueNames.map(name => ensureGoblinAudio(name).catch(() => null)));
}

export async function waitForGoblinAudio() {
  try {
    await pendingPlayback;
  } catch (err) {
    console.error(err);
  }
}
