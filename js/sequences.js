import { linearNotes, pitchIndex } from './utils/notes.js';
import { SELECTION_VARIANT_TITLES } from './constants.js';

function pickUnique(array, count) {
  const source = [...array];
  const result = [];
  while (result.length < count && source.length) {
    const index = Math.floor(Math.random() * source.length);
    result.push(source.splice(index, 1)[0]);
  }
  return result;
}

function byPitch(a, b) {
  return pitchIndex(a) - pitchIndex(b);
}

export function makeChromatic(variant) {
  const up13 = linearNotes('C4', 'C5');
  if (variant === '12-up') return up13;
  if (variant === '12-down') return [...up13].reverse();
  if (variant === '5-any') {
    const pool = linearNotes('C2', 'C5');
    const choice = ['up', 'down', 'updown'][Math.floor(Math.random() * 3)];
    if (choice === 'up') {
      const start = Math.floor(Math.random() * (pool.length - 4));
      return pool.slice(start, start + 5);
    }
    if (choice === 'down') {
      const start = Math.floor(Math.random() * (pool.length - 4)) + 4;
      return pool.slice(start - 4, start + 1).reverse();
    }
    const start = Math.floor(Math.random() * (pool.length - 3));
    return [pool[start], pool[start + 1], pool[start + 2], pool[start + 1], pool[start]];
  }
  if (variant === '25-updown') {
    const down = [...up13].reverse().slice(1);
    return up13.concat(down);
  }
  return up13;
}

export function makeTonal(variant) {
  const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
  let targetLen = 7;
  if (variant === 'kids-5') targetLen = 5;
  if (variant === 'kids-12') targetLen = 12;
  else if (variant === 'kids-9') targetLen = 9;
  const sequence = [];
  while (sequence.length < targetLen) {
    const step = scale[Math.floor(Math.random() * scale.length)];
    sequence.push(step);
  }
  return sequence.slice(0, targetLen);
}

export function makeAtonal(variant) {
  const match = variant.match(/^atonal-(\d+)-(easy|hard)$/);
  if (!match) {
    const fallbackLength = parseInt(variant, 10) || 12;
    const fallbackPool = linearNotes('C2', 'C5');
    return Array.from({ length: fallbackLength }, () => fallbackPool[Math.floor(Math.random() * fallbackPool.length)]);
  }

  const length = parseInt(match[1], 10);
  const difficulty = match[2];
  const maxSpan = difficulty === 'easy' ? 7 : 14; // semitone distance between lowest and highest note

  const pool = linearNotes('C2', 'C5');
  const pitches = pool.map(pitchIndex);
  const maxPitch = pitches[pitches.length - 1];

  // choose a window that fits within the allowed span
  const startOptions = [];
  for (let i = 0; i < pitches.length; i += 1) {
    if (pitches[i] + maxSpan <= maxPitch) {
      startOptions.push(i);
    }
  }
  const lowIndex = startOptions[Math.floor(Math.random() * startOptions.length)];
  const lowPitch = pitches[lowIndex];
  const highPitch = lowPitch + maxSpan;
  const allowedNotes = pool.filter((note, idx) => pitches[idx] >= lowPitch && pitches[idx] <= highPitch);

  const sequence = [];
  while (sequence.length < length) {
    sequence.push(allowedNotes[Math.floor(Math.random() * allowedNotes.length)]);
  }
  return sequence;
}

export function generateBaseSequence(mode, variant, previous) {
  let generator = null;
  if (mode === 'chromatic') generator = makeChromatic;
  if (mode === 'tonal') generator = makeTonal;
  if (mode === 'atonal') generator = makeAtonal;
  if (!generator) return [];
  let sequence = generator(variant) || [];
  if (!previous || !isRandomVariant(mode, variant)) return sequence;
  let attempts = 0;
  while (sequencesEqual(sequence, previous) && attempts < 5) {
    sequence = generator(variant) || [];
    attempts += 1;
  }
  return sequence;
}

export function isRandomVariant(mode, variant) {
  if (mode === 'chromatic') return variant === '5-any';
  if (mode === 'tonal') return true;
  if (mode === 'atonal') return true;
  return false;
}

export function sequencesEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function variantLabel(variant) {
  return SELECTION_VARIANT_TITLES[variant] || variant;
}

export function labelForMode(mode) {
  if (!mode) return '—';
  if (mode === 'chromatic') return 'Chromatik';
  if (mode === 'tonal') return 'Tonal';
  if (mode === 'atonal') return 'Atonal';
  return mode;
}

export function selectionLabel(mode, variant) {
  if (!mode || !variant) return 'wählen';
  return variantLabel(variant);
}

export function sortByPitch(notes) {
  return [...notes].sort(byPitch);
}
