const ASSET_VERSION = 'v1';
const STORAGE_NAMESPACE = 'goblin-notes';
const VERSION_KEY = `${STORAGE_NAMESPACE}:assetVersion`;
const ASSET_KEY_PREFIX = `${STORAGE_NAMESPACE}:${ASSET_VERSION}:asset:`;

const GOBLIN_AUDIO = [
  { path: 'assets/audio/goblin/hello.mp3' },
  { path: 'assets/audio/goblin/waiting.mp3' },
  { path: 'assets/audio/goblin/win.mp3' },
  { path: 'assets/audio/goblin/lose.mp3' }
];

const SCORE_AUDIO = [
  { path: 'assets/audio/pre-win.mp3', cache: false },
  { path: 'assets/audio/lose.mp3', cache: false },
  { path: 'assets/audio/win.mp3', cache: false }
];

const WHITE_NOTES = ['a2', 'a3', 'a4', 'b2', 'b3', 'b4', 'c2', 'c3', 'c4', 'c5', 'd2', 'd3', 'd4', 'e2', 'e3', 'e4', 'f2', 'f3', 'f4', 'g2', 'g3', 'g4'];
const SHARP_NOTES = ['a#2', 'a#3', 'a#4', 'c#2', 'c#3', 'c#4', 'd#2', 'd#3', 'd#4', 'f#2', 'f#3', 'f#4', 'g#2', 'g#3', 'g#4'];
const PIANO_NOTES = [...WHITE_NOTES, ...SHARP_NOTES].map(note => ({
  path: `assets/audio/piano/${note.toLowerCase().replace('#', '%23')}.mp3`,
  cache: false
}));

const IMAGE_ASSETS = [
  { path: 'assets/images/logo-black.png' },
  { path: 'assets/images/logo-wheat.png' },
  { path: 'assets/images/goblin/hello.png' },
  { path: 'assets/images/goblin/waiting.png' },
  { path: 'assets/images/goblin/win.png' },
  { path: 'assets/images/goblin/lose.png' }
];

export const ASSET_MANIFEST = [
  ...GOBLIN_AUDIO.map(asset => ({ type: 'audio', group: 'goblin', cache: true, ...asset })),
  ...SCORE_AUDIO.map(asset => ({ type: 'audio', group: 'score', cache: true, ...asset })),
  ...PIANO_NOTES.map(asset => ({ type: 'audio', group: 'piano', ...asset })),
  ...IMAGE_ASSETS.map(asset => ({ type: 'image', group: 'images', cache: true, ...asset }))
];

const hasWindow = typeof window !== 'undefined';
const localStorageRef = hasWindow ? window.localStorage : null;

let storageAvailable = false;

if (localStorageRef) {
  try {
    const testKey = `${STORAGE_NAMESPACE}:__test__`;
    localStorageRef.setItem(testKey, '1');
    localStorageRef.removeItem(testKey);
    storageAvailable = true;
  } catch (err) {
    storageAvailable = false;
  }
}

if (storageAvailable && localStorageRef) {
  const currentVersion = localStorageRef.getItem(VERSION_KEY);
  if (currentVersion !== ASSET_VERSION) {
    const prefixRoot = `${STORAGE_NAMESPACE}:`;
    const keysToRemove = [];
    for (let i = 0; i < localStorageRef.length; i += 1) {
      const key = localStorageRef.key(i);
      if (key && key.startsWith(prefixRoot)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorageRef.removeItem(key));
    localStorageRef.setItem(VERSION_KEY, ASSET_VERSION);
  }
}

function storageKey(path) {
  return `${ASSET_KEY_PREFIX}${path}`;
}

function normalisePath(path) {
  if (path.startsWith('./')) return path.slice(2);
  if (path.startsWith('/')) return path.slice(1);
  return path;
}

function toAbsolutePath(path) {
  return path.startsWith('./') || path.startsWith('http') ? path : `./${path}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchAsset(path) {
  const absolute = toAbsolutePath(path);
  const response = await fetch(absolute);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${path}: ${response.status}`);
  }
  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);
  return dataUrl;
}

async function primeAsset(path) {
  const absolute = toAbsolutePath(path);
  try {
    const response = await fetch(absolute, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Failed to fetch asset ${path}: ${response.status}`);
    }
    await response.arrayBuffer();
  } catch (err) {
    console.error(err);
  }
}

export function getCachedAsset(path) {
  if (!storageAvailable) return null;
  const key = storageKey(normalisePath(path));
  try {
    return localStorageRef.getItem(key);
  } catch (err) {
    console.warn('Unable to read cached asset', path, err);
    return null;
  }
}

export function setCachedAsset(path, dataUrl) {
  if (!storageAvailable) return;
  const key = storageKey(normalisePath(path));
  try {
    localStorageRef.setItem(key, dataUrl);
  } catch (err) {
    console.warn('Unable to store asset in localStorage', path, err);
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      storageAvailable = false;
      try {
        localStorageRef.removeItem(key);
      } catch (removalErr) {
        console.warn('Unable to remove over-sized asset from cache', removalErr);
      }
    }
  }
}

export async function ensureAssetCached(input) {
  const asset = typeof input === 'string' ? { path: input } : input || {};
  const { path, cache = true } = asset;
  if (!path) return null;
  const normalised = normalisePath(path);

  if (!cache || !storageAvailable) {
    await primeAsset(normalised);
    return null;
  }

  const existing = getCachedAsset(normalised);
  if (existing) return existing;
  try {
    const dataUrl = await fetchAsset(normalised);
    setCachedAsset(normalised, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function ensureAssetsCached(manifest = ASSET_MANIFEST, onProgress = null) {
  const total = manifest.length;
  let completed = 0;
  for (const asset of manifest) {
    await ensureAssetCached(asset);
    completed += 1;
    if (typeof onProgress === 'function') {
      try {
        onProgress({ completed, total, asset });
      } catch (err) {
        console.error(err);
      }
    }
  }
}

export function isStorageAvailable() {
  return storageAvailable;
}
