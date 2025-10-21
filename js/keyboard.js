import { playNote, unlockPianoContext } from './audio/piano.js';
import { linearNotes } from './utils/notes.js';

let keyboardContainer = null;
const playbackTimers = new Map();

function findPrevWhiteIndex(allNotes, idx) {
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (!allNotes[i].includes('#')) {
      const whitesBefore =
        allNotes.slice(0, i + 1).filter(note => !note.includes('#')).length - 1;
      return Math.max(0, whitesBefore);
    }
  }
  return 0;
}

function flashKey(element) {
  element.classList.add('active');
  setTimeout(() => element.classList.remove('active'), 160);
}

export function buildKeyboard(container, range, { onNote } = {}) {
  const { min, max } = range;
  const notes = linearNotes(min, max);
  container.innerHTML = '';
  notes.forEach(note => {
    if (!note.includes('#')) {
      const white = document.createElement('div');
      white.className = 'key white';
      white.dataset.note = note;
      white.innerHTML = '';
      white.setAttribute('aria-label', note);
      container.appendChild(white);
    }
  });
  const whites = Array.from(container.querySelectorAll('.key.white'));
  container.style.setProperty('--white-key-count', whites.length.toString());
  notes.forEach((note, idx) => {
    if (note.includes('#')) {
      const parentIndex = findPrevWhiteIndex(notes, idx);
      const parent = whites[parentIndex];
      if (!parent) return;
      const black = document.createElement('div');
      black.className = 'key black';
      black.dataset.note = note;
      black.innerHTML = '';
      black.setAttribute('aria-label', note);
      parent.appendChild(black);
    }
  });

  const handler = event => {
    const target = event.target.closest('.key');
    if (!target) return;
    const note = target.dataset.note;
    flashKey(target);
    void unlockPianoContext(true).catch(() => {});
    playNote(note, 0.95);
    if (typeof onNote === 'function') onNote(note);
  };

  container.addEventListener('mousedown', handler);
  container.addEventListener('touchstart', handler, { passive: true });
  keyboardContainer = container;
}

export function highlightPlaybackKey(note, duration) {
  if (!keyboardContainer) return;
  const key = keyboardContainer.querySelector(`.key[data-note="${note}"]`);
  if (!key) return;
  if (playbackTimers.has(note)) clearTimeout(playbackTimers.get(note));
  key.classList.add('playback-active');
  const timeout = setTimeout(() => {
    key.classList.remove('playback-active');
    playbackTimers.delete(note);
  }, duration);
  playbackTimers.set(note, timeout);
}

export function clearPlaybackHighlights() {
  playbackTimers.forEach(id => clearTimeout(id));
  playbackTimers.clear();
  if (!keyboardContainer) return;
  keyboardContainer
    .querySelectorAll('.key.playback-active')
    .forEach(key => key.classList.remove('playback-active'));
}
