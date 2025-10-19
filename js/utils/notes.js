import { NOTE_ORDER } from '../constants.js';

export function splitNote(note) {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) throw new Error(`Invalid note ${note}`);
  return [match[1], parseInt(match[2], 10)];
}

export function linearNotes(from, to) {
  const [noteFrom, octaveFrom] = splitNote(from);
  const [noteTo, octaveTo] = splitNote(to);
  const startIdx = NOTE_ORDER.indexOf(noteFrom) + octaveFrom * 12;
  const endIdx = NOTE_ORDER.indexOf(noteTo) + octaveTo * 12;
  const result = [];
  for (let idx = startIdx; idx <= endIdx; idx += 1) {
    const octave = Math.floor(idx / 12);
    const name = NOTE_ORDER[idx % 12] + octave;
    result.push(name);
  }
  return result;
}

export function pitchIndex(note) {
  const [name, octave] = splitNote(note);
  return octave * 12 + NOTE_ORDER.indexOf(name);
}
