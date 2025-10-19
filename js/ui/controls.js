import {
  tempoOut,
  playCorrectBtn,
  resetRoundBtn,
  sequencePanel,
  tasksTrigger,
  taskOverlay,
  panelTitleEl,
  accordionEls
} from './dom.js';
import { selectionLabel } from '../sequences.js';

let activeOptionBtn = null;
const panelTitleDefault = panelTitleEl?.dataset.default || panelTitleEl?.textContent || 'wählen';

export function setTempoDisplay(value) {
  tempoOut.textContent = value;
}

export function setActiveOption(button) {
  if (activeOptionBtn === button) return;
  if (activeOptionBtn) activeOptionBtn.classList.remove('is-active');
  activeOptionBtn = button || null;
  if (activeOptionBtn) activeOptionBtn.classList.add('is-active');
}

export function setReplayReady(enabled) {
  if (!playCorrectBtn) return;
  playCorrectBtn.classList.toggle('active', !!enabled);
}

export function setResetReady(enabled) {
  if (!resetRoundBtn) return;
  resetRoundBtn.classList.toggle('active', !!enabled);
}

export function updatePanelTitle(mode = null, variant = null) {
  if (!panelTitleEl) return;
  if (!mode || !variant) {
    panelTitleEl.textContent = panelTitleDefault;
    return;
  }
  panelTitleEl.textContent = selectionLabel(mode, variant);
}

export function collapseAccordions() {
  accordionEls.forEach(acc => acc.classList.remove('expanded'));
}

export function closeTasksMenu() {
  if (!sequencePanel) return;
  sequencePanel.classList.remove('open');
  sequencePanel.classList.add('closing');
  setTimeout(() => {
    sequencePanel.classList.remove('closing');
  }, 200);
  collapseAccordions();
}

export function initTaskPanelInteractions() {
  if (!sequencePanel) return;
  if (tasksTrigger) {
    tasksTrigger.addEventListener('click', event => {
      if (window.matchMedia('(hover: none)').matches) {
        event.preventDefault();
        sequencePanel.classList.toggle('open');
      }
    });
  }

  if (taskOverlay) {
    taskOverlay.addEventListener('click', event => event.stopPropagation());
  }

  sequencePanel.addEventListener('mouseleave', () => {
    if (!window.matchMedia('(hover: none)').matches) {
      collapseAccordions();
    }
  });

  document.addEventListener('click', event => {
    if (!window.matchMedia('(hover: none)').matches) return;
    if (sequencePanel.classList.contains('open') && !sequencePanel.contains(event.target)) {
      closeTasksMenu();
    }
  });

  accordionEls.forEach(acc => {
    const labelBtn = acc.querySelector('.accordion-label');
    if (labelBtn) {
      labelBtn.addEventListener('click', event => {
        if (!window.matchMedia('(hover: none)').matches) return;
        event.preventDefault();
        const alreadyOpen = acc.classList.contains('expanded');
        collapseAccordions();
        if (!alreadyOpen) acc.classList.add('expanded');
      });
    }
    const list = acc.querySelector('.option-list');
    if (list) list.addEventListener('click', event => event.stopPropagation());
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeTasksMenu();
  });
}
