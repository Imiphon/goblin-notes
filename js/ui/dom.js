// DOM element lookup helpers
export const tempoRange = document.getElementById('tempoRange');
export const tempoOut = document.getElementById('tempoOut');
export const playCorrectBtn = document.getElementById('playCorrect');
export const playGoblinBtn = document.getElementById('playGoblin');
export const resetRoundBtn = document.getElementById('resetRound');
export const totalScoreEl = document.getElementById('totalScore');
export const potentialScoreEl = document.getElementById('potentialScore');
export const seqInfoEl = document.getElementById('seqInfo');
export const goblinImg = document.getElementById('goblinImg');
export const keyboardEl = document.getElementById('keyboard');
export const sequencePanel = document.getElementById('sequencePanel');
export const tasksTrigger = document.getElementById('tasksTrigger');
export const taskOverlay = document.getElementById('taskOverlay');
export const panelTitleEl = document.getElementById('panelTitle');
export const accordionEls = Array.from(document.querySelectorAll('.accordion'));

export function optionButtons() {
  return Array.from(document.querySelectorAll('.opt'));
}
