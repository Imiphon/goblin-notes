import { ASSET_MANIFEST, ensureAssetsCached, getCachedAsset } from './assets/cache.js';
import { showGoblin, hasHelloGreetingPlayed, warmUpGoblinHello } from './audio/goblin.js';

const OVERLAY_ID = 'bootOverlay';
const STATUS_ID = 'bootStatus';
const PROGRESS_BAR_ID = 'bootProgressBar';
const HINT_ID = 'bootHint';

function select(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const statusEl = select(STATUS_ID);
  if (statusEl) statusEl.textContent = text;
}

function setProgress(ratio) {
  const bar = select(PROGRESS_BAR_ID);
  if (!bar) return;
  const clamped = Math.max(0, Math.min(1, ratio));
  bar.style.width = `${Math.round(clamped * 100)}%`;
}

function setHintVisible(visible) {
  const hint = select(HINT_ID);
  if (!hint) return;
  hint.hidden = !visible;
}

function applyCachedImages() {
  document.querySelectorAll('[data-asset-src]').forEach(img => {
    const path = img.getAttribute('data-asset-src');
    if (!path) return;
    const cached = getCachedAsset(path);
    if (cached) {
      img.src = cached;
    }
  });
  const favicon = document.querySelector('link[rel="shortcut icon"], link[rel="icon"]');
  if (favicon) {
    const cachedIcon = getCachedAsset('assets/images/logo-black.png');
    if (cachedIcon) favicon.href = cachedIcon;
  }
}

async function waitForHelloGreeting() {
  const attempt = async () => {
    try {
      await showGoblin('hello');
    } catch (err) {
      console.error(err);
    }
  };

  setStatus('Wir warten auf den Kobold …');
  await attempt();
  if (hasHelloGreetingPlayed()) {
    return;
  }

  setStatus('Tippe einmal, damit der Kobold hallo sagen darf.');
  setHintVisible(true);

  await new Promise(resolve => {
    const events = ['pointerup', 'click', 'touchend', 'keydown'];
    const options = { capture: true };
    const overlay = select(OVERLAY_ID);

    const register = () => {
      events.forEach(event => document.addEventListener(event, handler, options));
      if (overlay) overlay.addEventListener('click', handler, options);
    };

    const cleanup = () => {
      events.forEach(event => document.removeEventListener(event, handler, options));
      if (overlay) overlay.removeEventListener('click', handler, options);
    };

    async function handler() {
      cleanup();
      await attempt();
      if (hasHelloGreetingPlayed()) {
        setHintVisible(false);
        resolve();
        return;
      }
      register();
    }

    register();
  });
}

export async function runPreloadSequence() {
  const overlay = select(OVERLAY_ID);
  if (overlay) {
    overlay.classList.remove('is-hidden');
  }
  document.body.classList.add('boot-loading');

  const total = ASSET_MANIFEST.length;
  let completed = 0;

  setStatus('Lade Kobold-Klänge …');
  await ensureAssetsCached(ASSET_MANIFEST, ({ completed: done, total: max, asset }) => {
    completed = done;
    const percent = max ? completed / max : 1;
    setProgress(percent);
    if (asset?.type === 'audio') {
      setStatus(`Lade Audios (${completed}/${max}) …`);
    } else {
      setStatus(`Lade Bilder (${completed}/${max}) …`);
    }
  });

  applyCachedImages();

  setProgress(1);
  setStatus('Der Kobold bereitet den Gruß vor …');
  await warmUpGoblinHello();
  await waitForHelloGreeting();

  setStatus('Bereit!');
  document.body.classList.remove('boot-loading');
  if (overlay) {
    overlay.classList.add('is-hidden');
    window.setTimeout(() => {
      overlay.remove();
    }, 400);
  }
}

export function getCachedAssetData(path) {
  return getCachedAsset(path);
}
