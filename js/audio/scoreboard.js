import { getCachedAsset } from '../assets/cache.js';

const AUDIO_PRE_WIN = 'assets/audio/pre-win.mp3';
const AUDIO_LOSE = 'assets/audio/lose.mp3';
const AUDIO_WIN = 'assets/audio/win.mp3';

function resolveSource(path) {
  const cached = getCachedAsset(path);
  if (cached) return cached;
  if (path.startsWith('./') || path.startsWith('http')) return path;
  return `./${path}`;
}

function createLoopPlayer(path) {
  let audio = null;
  let playCount = 0;

  const ensure = async () => {
    const source = resolveSource(path);
    if (!audio) {
      audio = new Audio(source);
      audio.loop = true;
      audio.preload = 'auto';
      audio.playsInline = true;
      audio.crossOrigin = 'anonymous';
    } else if (audio.src !== source) {
      audio.src = source;
    }
    return audio;
  };

  return {
    async play() {
      playCount += 1;
      if (playCount > 1) return; // already running
      const element = await ensure();
      try {
        await element.play();
      } catch (err) {
        playCount = 0;
        console.error(err);
      }
    },
    stop() {
      if (playCount > 0) playCount -= 1;
      if (playCount === 0 && audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    },
    reset() {
      playCount = 0;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  };
}

function createOneShotPlayer(path) {
  return {
    async play() {
      const source = resolveSource(path);
      const audio = new Audio(source);
      audio.playsInline = true;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      try {
        await audio.play();
      } catch (err) {
        console.error(err);
      }
    }
  };
}

const loopPreWin = createLoopPlayer(AUDIO_PRE_WIN);
const loopLose = createLoopPlayer(AUDIO_LOSE);
const oneShotWin = createOneShotPlayer(AUDIO_WIN);

let winPending = false;

export function markWinTransfer() {
  winPending = true;
}

export function handleScoreAnimationStart(role, direction) {
  if (direction > 0 && role === 'potential') {
    void loopPreWin.play();
    return;
  }
  if (direction < 0) {
    void loopLose.play();
  }
}

export function handleScoreAnimationEnd(role, direction, { completed = true } = {}) {
  if (direction > 0 && role === 'potential') {
    loopPreWin.stop();
    return;
  }
  if (direction < 0) {
    loopLose.stop();
  }
  if (direction > 0 && role === 'total' && winPending) {
    if (completed) {
      void oneShotWin.play();
    }
    winPending = false;
  }
}

export function resetScoreAudio() {
  loopPreWin.reset();
  loopLose.reset();
  winPending = false;
}
