import { KEY_RANGE } from "./constants.js";
import { state } from "./state.js";
import { playNote, preloadNotes, unlockPianoContext } from "./audio/piano.js";
import {
  showGoblin,
  waitForGoblinAudio,
  hasHelloGreetingPlayed,
  preloadGoblinAudio,
} from "./audio/goblin.js";
import {
  handleScoreAnimationStart,
  handleScoreAnimationEnd,
  markWinTransfer,
  resetScoreAudio,
} from "./audio/scoreboard.js";
import {
  buildKeyboard,
  highlightPlaybackKey,
  clearPlaybackHighlights,
} from "./keyboard.js";
import {
  generateBaseSequence,
  variantLabel,
  labelForMode,
} from "./sequences.js";
import { linearNotes } from "./utils/notes.js";
import {
  tempoRange,
  playCorrectBtn,
  playGoblinBtn,
  resetRoundBtn,
  totalScoreEl,
  potentialScoreEl,
  seqInfoEl,
  keyboardEl,
  optionButtons,
  orientationHint,
} from "./ui/dom.js";
import {
  setTempoDisplay,
  setActiveOption,
  setReplayReady,
  setResetReady,
  updatePanelTitle,
  closeTasksMenu,
  collapseAccordions,
  suppressTaskHover,
  initTaskPanelInteractions,
} from "./ui/controls.js";
import { runPreloadSequence } from "./preload.js";

const KEYBOARD_NOTES = linearNotes(KEY_RANGE.min, KEY_RANGE.max);
let helloFallbackRegistered = false;
const scoreAnimations = new Map();
const SCORE_SETTLE_DELAY_MS = 800;
let orientationListenersBound = false;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function scoreRole(el) {
  if (el === potentialScoreEl) return "potential";
  if (el === totalScoreEl) return "total";
  return "other";
}

function isTouchLayout() {
  return (
    window.matchMedia("(hover: none)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function shouldShowOrientationHint() {
  if (!orientationHint) return false;
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  const narrow = window.innerWidth <= 900;
  return isTouchLayout() && narrow && isPortrait;
}

function updateOrientationHint() {
  if (!orientationHint) return;
  orientationHint.classList.toggle("is-visible", shouldShowOrientationHint());
}

function stopScoreAnimation(el, finalValue = null) {
  const active = scoreAnimations.get(el);
  if (!active) return;
  if (active.timer) window.clearTimeout(active.timer);
  active.cancelled = true;
  if (typeof active.onCancel === "function") {
    active.onCancel({ value: finalValue, completed: false });
  }
  scoreAnimations.delete(el);
}

function triggerScoreFlash(el, direction) {
  if (!el) return;
  const className = direction > 0 ? "score-flash-up" : "score-flash-down";
  el.classList.remove("score-flash-up", "score-flash-down");
  // force reflow to restart animation
  void el.offsetWidth;
  el.classList.add(className);
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove(className);
    },
    { once: true }
  );
}

function updateScoreDisplay(el, value, { animate = true } = {}) {
  if (!el) return Promise.resolve();
  const target = Number.isFinite(value) ? Math.round(value) : 0;
  const stored = el.dataset.scoreValue;
  const fallback = el.textContent ? parseInt(el.textContent, 10) : 0;
  let current = stored !== undefined ? parseInt(stored, 10) : fallback;
  if (!Number.isFinite(current)) current = 0;
  if (!animate) {
    stopScoreAnimation(el, target);
    el.textContent = target;
    el.dataset.scoreValue = target;
    return Promise.resolve();
  }
  if (current === target) {
    el.textContent = target;
    el.dataset.scoreValue = target;
    return Promise.resolve();
  }

  stopScoreAnimation(el, target);

  const direction = target > current ? 1 : -1;
  const steps = Math.abs(target - current);
  const duration = Math.max(220, Math.min(steps * 28, 1200));
  const stepDelay = duration / steps;
  triggerScoreFlash(el, direction);

  const role = scoreRole(el);
  const animation = {
    cancelled: false,
    timer: null,
    current,
    target,
    direction,
    role,
    resolve: null,
    promise: null,
  };
  animation.promise = new Promise((resolve) => {
    animation.resolve = resolve;
  });
  animation.onCancel = (meta) => {
    const value =
      meta && Number.isFinite(meta.value) ? meta.value : animation.current;
    const completed = !!(meta && meta.completed);
    const valueToSet = value;
    el.textContent = valueToSet;
    el.dataset.scoreValue = valueToSet;
    handleScoreAnimationEnd(role, direction, { completed });
    if (animation.resolve) animation.resolve();
  };
  scoreAnimations.set(el, animation);
  handleScoreAnimationStart(role, direction);

  const tick = () => {
    if (animation.cancelled) return;
    if (animation.current === target) {
      el.textContent = target;
      el.dataset.scoreValue = target;
      scoreAnimations.delete(el);
      handleScoreAnimationEnd(role, direction, { completed: true });
      if (animation.resolve) animation.resolve();
      return;
    }
    animation.current += direction;
    el.textContent = animation.current;
    el.dataset.scoreValue = animation.current;
    animation.timer = window.setTimeout(tick, stepDelay);
  };

  // kick off first step without delay for snappy feedback
  tick();
  return animation.promise;
}

function waitForScoreAnimations() {
  if (!scoreAnimations.size) return Promise.resolve(false);
  const pending = Array.from(scoreAnimations.values())
    .map((animation) => animation?.promise)
    .filter(Boolean);
  if (!pending.length) return Promise.resolve(false);
  return Promise.all(pending).then(() => true);
}

function scheduleAudioWarmup() {
  const run = () => {
    void preloadGoblinAudio().catch(() => {});
    void preloadNotes(KEYBOARD_NOTES).catch(() => {});
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    window.setTimeout(run, 150);
  }
}

function ensureHelloFallback() {
  if (hasHelloGreetingPlayed() || helloFallbackRegistered) return;
  helloFallbackRegistered = true;
  const events = ["pointerup", "click", "touchend", "keydown"];
  const options = { once: true, capture: true };
  const handler = () => {
    events.forEach((event) =>
      document.removeEventListener(event, handler, options)
    );
    helloFallbackRegistered = false;
    if (!hasHelloGreetingPlayed()) {
      void unlockPianoContext(true).catch(() => {});
      showGoblin("hello").catch(() => {});
      ensureHelloFallback();
    }
  };
  events.forEach((event) => document.addEventListener(event, handler, options));
}

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
  state.maxPotential = 0;
  state.potentialDebt = 0;
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
  resetScoreAudio();
  if (seqInfoEl) seqInfoEl.textContent = "—";
  updateScoreDisplay(potentialScoreEl, state.potential, { animate: false });
  updateScoreDisplay(totalScoreEl, state.totalScore, { animate: false });
}

function updateSeqInfo() {
  const length = state.baseSeq.length || 0;
  if (seqInfoEl) {
    seqInfoEl.textContent = `${labelForMode(state.mode)} • ${variantLabel(
      state.variant
    )} • ${length} Töne`;
  }
}

function updatePotential() {
  state.tempo = parseInt(tempoRange.value, 10);
  const base = (state.baseSeq?.length || 0) * state.tempo;
  if (state.solved) {
    state.potential = 0;
    state.maxPotential = 0;
    state.potentialDebt = 0;
  } else {
    const penaltyFactor = Math.pow(0.95, state.correctPlays);
    const rawPotential = Math.round(base * penaltyFactor);
    state.maxPotential = rawPotential;
    const debt = Math.min(state.potentialDebt, rawPotential);
    state.potential = Math.max(0, rawPotential - debt);
  }
  updateScoreDisplay(potentialScoreEl, state.potential);
  updateScoreDisplay(totalScoreEl, state.totalScore);
}

async function playSequence(sequence, bpm, withHighlight = false) {
  if (!sequence || !sequence.length) return;
  state.locked = true;
  try {
    const hadAnimations = await waitForScoreAnimations();
    if (hadAnimations) {
      await delay(SCORE_SETTLE_DELAY_MS);
    }
    await waitForGoblinAudio();
    const msPerBeat = 60000 / bpm;
    await preloadNotes(sequence);
    if (withHighlight) clearPlaybackHighlights();
    for (const note of sequence) {
      if (withHighlight) highlightPlaybackKey(note, msPerBeat);
      await playNote(note, 0.95);
      await new Promise((resolve) => setTimeout(resolve, msPerBeat));
    }
  } finally {
    state.locked = false;
  }
}

function makeGoblinVariant() {
  if (state.mode === "chromatic" || state.mode === "atonal") {
    const index = Math.floor(Math.random() * state.baseSeq.length);
    state.missingNote = state.baseSeq[index];
    state.goblinSeq = state.baseSeq
      .slice(0, index)
      .concat(state.baseSeq.slice(index + 1));
    state.replacedAt = null;
    state.replacedWas = null;
  } else if (state.mode === "tonal") {
    const index = Math.floor(Math.random() * state.baseSeq.length);
    const pool = linearNotes("C2", "C5");
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

  closeTasksMenu(true);

  clearPlaybackHighlights();
  setActiveOption(triggerButton);
  state.mode = mode;
  state.variant = variant;
  state.correctPlays = 0;
  state.solved = false;
  state.potentialDebt = 0;
  state.maxPotential = 0;
  const waitingAudio = showGoblin("waiting");

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

  if (!state.locked && state.baseSeq.length) {
    waitingAudio
      .catch(() => {})
      .then(() => playSequence(state.baseSeq, state.tempo, true))
      .catch(() => {});
  }

  const overlay = document.querySelector('.task-overlay');
  if (overlay) {
    overlay.style.opacity = '0'; 
  }
}

async function handlePlayCorrect() {
  if (state.locked || !state.baseSeq.length || state.solved) return;
  await unlockPianoContext(true).catch(() => {});
  await playSequence(state.baseSeq, state.tempo, true);
  state.correctPlays += 1;
  updatePotential();
}

async function handlePlayGoblin() {
  if (state.locked || !state.baseSeq.length || state.solved) return;
  await unlockPianoContext(true).catch(() => {});
  if (!state.goblinSeq.length) makeGoblinVariant();
  await showGoblin("waiting", false);
  clearPlaybackHighlights();
  await playSequence(state.goblinSeq, state.tempo, false);
}

async function resetRound() {
  clearPlaybackHighlights();
  await unlockPianoContext(true).catch(() => {});
  const hasSelection = !!(state.mode && state.variant);
  const previous = hasSelection ? [...state.baseSeq] : [];
  state.correctPlays = 0;
  state.goblinSeq = [];
  state.missingNote = null;
  state.replacedAt = null;
  state.replacedWas = null;
  state.solved = false;
  state.potentialDebt = 0;
  state.maxPotential = 0;

  if (hasSelection) {
    state.baseSeq = generateBaseSequence(state.mode, state.variant, previous);
    updateSeqInfo();
    updatePanelTitle(state.mode, state.variant);
    setReplayReady(!!state.baseSeq.length);
    setResetReady(false);
    collapseAccordions();
    const waitingAudio = showGoblin("waiting");
    updatePotential();
    closeTasksMenu();
    suppressTaskHover();
    if (state.baseSeq.length) {
      waitingAudio
        .catch(() => {})
        .then(() => playSequence(state.baseSeq, state.tempo, true))
        .catch(() => {});
    }
    return;
  } else {
    state.baseSeq = [];
    if (seqInfoEl) seqInfoEl.textContent = "—";
    updatePanelTitle();
    setReplayReady(false);
    setResetReady(false);
    await showGoblin("hello", false);
  }

  updatePotential();
  closeTasksMenu();
  suppressTaskHover();
}

function handleGuess(note) {
  if (!state.baseSeq.length || !state.goblinSeq.length) return;

  let isCorrect = false;
  if (state.mode === "chromatic" || state.mode === "atonal") {
    isCorrect = note === state.missingNote;
  } else if (state.mode === "tonal") {
    isCorrect = note === state.replacedWas;
  }

  if (isCorrect) {
    if (state.potential > 0) markWinTransfer();
    state.totalScore += Math.max(0, state.potential);
    state.solved = true;
    state.goblinSeq = [];
    state.missingNote = null;
    state.replacedAt = null;
    state.replacedWas = null;
    state.correctPlays = 0;
    updatePotential();
    setReplayReady(false);
    setResetReady(true);
    showGoblin("lose");
  } else {
    const penaltyBase = state.maxPotential || state.totalScore;
    const penalty = Math.max(1, Math.round(penaltyBase * 0.1));
    let remainingPenalty = penalty;
    if (state.potential > 0) {
      const potentialDeduction = Math.min(state.potential, remainingPenalty);
      state.potentialDebt = Math.min(
        state.maxPotential,
        state.potentialDebt + potentialDeduction
      );
      remainingPenalty -= potentialDeduction;
    }
    if (remainingPenalty > 0 && state.totalScore > 0) {
      state.totalScore = Math.max(0, state.totalScore - remainingPenalty);
    }
    updatePotential();
    setReplayReady(true);
    setResetReady(true);
    showGoblin("win");
  }
}

function registerOptionButtons() {
  optionButtons().forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void unlockPianoContext(true).catch(() => {});
      void selectSequence(button.dataset.mode, button.dataset.variant, button);
    });
  });
}

function initKeyboard() {
  buildKeyboard(keyboardEl, KEY_RANGE, {
    onNote: (note) => handleGuess(note),
  });
}

function initControls() {
  tempoRange.addEventListener("input", () => {
    setTempoDisplay(tempoRange.value);
    updatePotential();
  });

  playCorrectBtn.addEventListener("click", handlePlayCorrect);
  playGoblinBtn.addEventListener("click", handlePlayGoblin);
  resetRoundBtn.addEventListener("click", resetRound);
}

async function startApp() {
  initTaskPanelInteractions();
  registerOptionButtons();
  initKeyboard();
  initControls();

  setTempoDisplay(tempoRange.value);
  resetUI();
  updatePotential();
  scheduleAudioWarmup();
  ensureHelloFallback();
  updateOrientationHint();
  if (!orientationListenersBound) {
    window.addEventListener("resize", updateOrientationHint);
    window.addEventListener("orientationchange", updateOrientationHint);
    orientationListenersBound = true;
  }
}

async function bootstrap() {
  updateOrientationHint();
  await runPreloadSequence();
  await startApp();
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
