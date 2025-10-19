import { GOBLIN_STATES } from '../constants.js';
import { goblinImg } from '../ui/dom.js';

const audioBase = './assets/audio/goblin/';
const audioCache = new Map();
const loadPromises = new Map();

let currentAudio = null;
let pendingPlayback = Promise.resolve();
let playbackGeneration = 0;

async function ensureGoblinAudio(name) {
  const file = `${audioBase}${name}.mp3`;
  let audio = audioCache.get(file);
  if (audio && audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return audio;
  if (!audio) {
    audio = new Audio(file);
    audio.preload = 'auto';
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
    goblinImg.src = `./assets/images/goblin/${meta.img}.png`;
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
            instance.play().catch(() => cleanup());
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

export async function waitForGoblinAudio() {
  try {
    await pendingPlayback;
  } catch (err) {
    console.error(err);
  }
}
