// Global constants shared across modules
export const ENHARMONIC = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#'
};

export const NOTE_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const KEY_RANGE = { min: 'C2', max: 'C5' };

export const SELECTION_VARIANT_TITLES = {
  '5-any': '5 Töne chrom',
  '12-up': '12 Töne chrom ↑',
  '12-down': '12 Töne chrom ↓',
  '25-updown': '25 Töne chrom',
  'kids-8': '8 Töne tonal',
  'kids-12': '12 Töne tonal',
  'kids-16': '16 Töne tonal',
  '7': '7 Töne atonal',
  '12': '12 Töne atonal',
  '16': '16 Töne atonal'
};

export const GOBLIN_STATES = {
  hello: { img: 'hello', audio: 'hello', alt: 'Goblin waves hello' },
  waiting: { img: 'waiting', audio: 'waiting', alt: 'Goblin waits impatiently' },
  win: { img: 'win', audio: 'win', alt: 'Goblin celebrates the mishap' },
  lose: { img: 'lose', audio: 'lose', alt: 'Goblin sighs at the success' }
};
