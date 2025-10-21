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
  '12-up': '13 Töne chrom ↑',
  '12-down': '13 Töne chrom ↓',
  '25-updown': '25 Töne chrom',
  'kids-5': '5 Töne tonal',
  'kids-7': '7 Töne tonal',
  'kids-9': '9 Töne tonal',
  'kids-12': '12 Töne tonal',
  'atonal-5-easy': '5 Töne atonal leicht',
  'atonal-5-hard': '5 Töne atonal schwer',
  'atonal-7-easy': '7 Töne atonal leicht',
  'atonal-7-hard': '7 Töne atonal schwer',
  'atonal-12-easy': '12 Töne atonal leicht',
  'atonal-12-hard': '12 Töne atonal schwer'
};

export const GOBLIN_STATES = {
  hello: { img: 'hello', audio: 'hello', alt: 'Goblin waves hello' },
  waiting: { img: 'waiting', audio: 'waiting', alt: 'Goblin waits impatiently' },
  win: { img: 'win', audio: 'win', alt: 'Goblin celebrates the mishap' },
  lose: { img: 'lose', audio: 'lose', alt: 'Goblin sighs at the success' }
};
