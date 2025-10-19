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
  const up12 = linearNotes('C4', 'B4');
  if (variant === '12-up') return up12;
  if (variant === '12-down') return [...up12].reverse();
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
    const up = linearNotes('C4', 'C5');
    const down = [...up].reverse().slice(1);
    return up.concat(down);
  }
  return up12;
}

export function makeTonal(variant) {
  const motifs = [
    ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'],
    ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4'],
    ['G4', 'E4', 'E4', 'F4', 'D4', 'D4', 'C4']
  ];
  let targetLength = 8;
  if (variant === 'kids-12') targetLength = 12;
  if (variant === 'kids-16') targetLength = 16;
  const sequence = [];
  while (sequence.length < targetLength) {
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    sequence.push(...motif);
  }
  return sequence.slice(0, targetLength);
}

export function makeAtonal(variant) {
  const pool = linearNotes('C2', 'C5');
  const length = parseInt(variant, 10) || 12;
  const result = [];
  for (let i = 0; i < length; i += 1) {
    result.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return result;
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
