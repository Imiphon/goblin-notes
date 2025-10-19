import { KEY_RANGE } from './constants.js';
import { state } from './state.js';
import { playNote, preloadNotes } from './audio/piano.js';
import { showGoblin, waitForGoblinAudio } from './audio/goblin.js';
import { buildKeyboard, highlightPlaybackKey, clearPlaybackHighlights } from './keyboard.js';
import { generateBaseSequence, variantLabel, labelForMode } from './sequences.js';
import { linearNotes } from './utils/notes.js';
import {
  tempoRange,
  playCorrectBtn,
  playGoblinBtn,
  resetRoundBtn,
  totalScoreEl,
  potentialScoreEl,
  seqInfoEl,
  keyboardEl,
  optionButtons
} from './ui/dom.js';
import {
  setTempoDisplay,
  setActiveOption,
  setReplayReady,
  setResetReady,
  updatePanelTitle,
  closeTasksMenu,
  initTaskPanelInteractions
} from './ui/controls.js';

function resetState() {
  state.mode = null;
  state.variant = null;
  state.baseSeq = [];
  state.goblinSeq = [];
  state.missingNote = null;
  state.replacedAt = null;
  state.replacedWas = null;
  state.correctPlays = 0;
  state.potential = 0;
  state.totalScore = 0;
  state.locked = false;
  state.solved = false;
}

function resetUI() {
  clearPlaybackHighlights();
  setActiveOption(null);
  closeTasksMenu();
  setReplayReady(false);
  setResetReady(false);
  updatePanelTitle();
  resetState();
  seqInfoEl.textContent = '—';
  potentialScoreEl.textContent = state.potential;
  totalScoreEl.textContent = state.totalScore;
}

function updateSeqInfo() {
  const length = state.baseSeq.length || 0;
  seqInfoEl.textContent = `${labelForMode(state.mode)} • ${variantLabel(state.variant)} • ${length} Töne`;
}

function updatePotential() {
  state.tempo = parseInt(tempoRange.value, 10);
  const base = (state.baseSeq?.length || 0) * state.tempo;
  if (state.solved) {
    state.potential = 0;
  } else {
    const penaltyFactor = Math.pow(0.95, state.correctPlays);
    state.potential = Math.round(base * penaltyFactor);
  }
  potentialScoreEl.textContent = state.potential;
  totalScoreEl.textContent = state.totalScore;
}

async function playSequence(sequence, bpm, withHighlight = false) {
  if (!sequence || !sequence.length) return;
  state.locked = true;
  try {
    await waitForGoblinAudio();
    const msPerBeat = 60000 / bpm;
    await preloadNotes(sequence);
    if (withHighlight) clearPlaybackHighlights();
    for (const note of sequence) {
      if (withHighlight) highlightPlaybackKey(note, msPerBeat);
      await playNote(note, 0.95);
      await new Promise(resolve => setTimeout(resolve, msPerBeat));
    }
  } finally {
    state.locked = false;
  }
}

function makeGoblinVariant() {
  if (state.mode === 'chromatic' || state.mode === 'atonal') {
    const index = Math.floor(Math.random() * state.baseSeq.length);
    state.missingNote = state.baseSeq[index];
    state.goblinSeq = state.baseSeq.slice(0, index).concat(state.baseSeq.slice(index + 1));
    state.replacedAt = null;
    state.replacedWas = null;
  } else if (state.mode === 'tonal') {
    const index = Math.floor(Math.random() * state.baseSeq.length);
    const pool = linearNotes('C2', 'C5');
    let wrong = state.baseSeq[index];
    while (wrong === state.baseSeq[index]) {
      wrong = pool[Math.floor(Math.random() * pool.length)];
    }
    state.replacedAt = index;
    state.replacedWas = state.baseSeq[index];
    state.goblinSeq = [...state.baseSeq];
    state.goblinSeq[index] = wrong;
    state.missingNote = null;
  }
}

async function selectSequence(mode, variant, triggerButton = null) {
  const sameSelection = state.mode === mode && state.variant === variant;
  const previousSequence = sameSelection ? [...state.baseSeq] : null;

  clearPlaybackHighlights();
  setActiveOption(triggerButton);
  state.mode = mode;
  state.variant = variant;
  state.correctPlays = 0;
  state.solved = false;
  const waitingAudio = showGoblin('waiting');

  state.baseSeq = generateBaseSequence(mode, variant, previousSequence);
  state.goblinSeq = [];
  state.missingNote = null;
  state.replacedAt = null;
  state.replacedWas = null;

  updatePotential();
  updateSeqInfo();
  updatePanelTitle(state.mode, state.variant);
  setReplayReady(true);
  setResetReady(false);
  closeTasksMenu();

  if (!state.locked && state.baseSeq.length) {
    waitingAudio
      .catch(() => {})
      .then(() => playSequence(state.baseSeq, state.tempo, true))
      .catch(() => {});
  }
}

async function handlePlayCorrect() {
  if (state.locked || !state.baseSeq.length || state.solved) return;
  await playSequence(state.baseSeq, state.tempo, true);
  state.correctPlays += 1;
  updatePotential();
}

async function handlePlayGoblin() {
  if (state.locked || !state.baseSeq.length || state.solved) return;
  if (!state.goblinSeq.length) makeGoblinVariant();
  await showGoblin('waiting', false);
  clearPlaybackHighlights();
  await playSequence(state.goblinSeq, state.tempo, false);
}

async function resetRound() {
  clearPlaybackHighlights();
  const hasSelection = !!(state.mode && state.variant);
  const previous = hasSelection ? [...state.baseSeq] : [];
  state.correctPlays = 0;
  state.goblinSeq = [];
  state.missingNote = null;
  state.replacedAt = null;
  state.replacedWas = null;
  state.solved = false;

  if (hasSelection) {
    state.baseSeq = generateBaseSequence(state.mode, state.variant, previous);
    updateSeqInfo();
    updatePanelTitle(state.mode, state.variant);
    setReplayReady(!!state.baseSeq.length);
    setResetReady(false);
    const waitingAudio = showGoblin('waiting');
    updatePotential();
    closeTasksMenu();
    if (state.baseSeq.length) {
      waitingAudio
        .catch(() => {})
        .then(() => playSequence(state.baseSeq, state.tempo, true))
        .catch(() => {});
    }
    return;
  } else {
    state.baseSeq = [];
    seqInfoEl.textContent = '—';
    updatePanelTitle();
    setReplayReady(false);
    setResetReady(false);
    await showGoblin('hello', false);
  }

  updatePotential();
  closeTasksMenu();
}

function handleGuess(note) {
  if (!state.baseSeq.length || !state.goblinSeq.length) return;

  let isCorrect = false;
  if (state.mode === 'chromatic' || state.mode === 'atonal') {
    isCorrect = note === state.missingNote;
  } else if (state.mode === 'tonal') {
    isCorrect = note === state.replacedWas;
  }

  if (isCorrect) {
    state.totalScore += Math.max(0, state.potential);
    totalScoreEl.textContent = state.totalScore;
    state.solved = true;
    state.goblinSeq = [];
    state.missingNote = null;
    state.replacedAt = null;
    state.replacedWas = null;
    state.correctPlays = 0;
    updatePotential();
    setReplayReady(false);
    setResetReady(true);
    showGoblin('lose');
  } else {
    state.totalScore = Math.round(state.totalScore * 0.9);
    totalScoreEl.textContent = state.totalScore;
    setReplayReady(true);
    setResetReady(true);
    showGoblin('win');
  }
}

function registerOptionButtons() {
  optionButtons().forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      void selectSequence(button.dataset.mode, button.dataset.variant, button);
    });
  });
}

function initKeyboard() {
  buildKeyboard(keyboardEl, KEY_RANGE, {
    onNote: note => handleGuess(note)
  });
}

function initControls() {
  tempoRange.addEventListener('input', () => {
    setTempoDisplay(tempoRange.value);
    updatePotential();
  });

  playCorrectBtn.addEventListener('click', handlePlayCorrect);
  playGoblinBtn.addEventListener('click', handlePlayGoblin);
  resetRoundBtn.addEventListener('click', resetRound);
}

async function init() {
  initTaskPanelInteractions();
  registerOptionButtons();
  initKeyboard();
  initControls();

  setTempoDisplay(tempoRange.value);
  resetUI();
  updatePotential();
  await showGoblin('hello');
}

document.addEventListener('DOMContentLoaded', init);
