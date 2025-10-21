import {
  tempoOut,
  playCorrectBtn,
  resetRoundBtn,
  sequencePanel,
  tasksTrigger,
  taskOverlay,
  panelTitleEl,
  accordionEls,
  taskPanel,
  tasksInfoBtn,
  tasksInfoPopup,
  tasksInfoClose
} from './dom.js';
import { selectionLabel } from '../sequences.js';

let activeOptionBtn = null;
const panelTitleDefault = panelTitleEl?.dataset.default || panelTitleEl?.textContent || 'wählen';
const HOVER_SUPPRESS_CLASS = 'suppress-hover';
let infoOverlayOpen = false;

function setInfoOverlayVisibility(isOpen) {
  if (!tasksInfoPopup || !tasksInfoBtn) {
    infoOverlayOpen = false;
    return;
  }
  infoOverlayOpen = !!isOpen;
  tasksInfoBtn.setAttribute('aria-expanded', infoOverlayOpen ? 'true' : 'false');
  tasksInfoPopup.classList.toggle('is-visible', infoOverlayOpen);
  tasksInfoPopup.setAttribute('aria-hidden', infoOverlayOpen ? 'false' : 'true');
  if (infoOverlayOpen) {
    tasksInfoPopup.removeAttribute('hidden');
  } else {
    tasksInfoPopup.setAttribute('hidden', '');
  }
}

function openInfoOverlay() {
  if (infoOverlayOpen) return false;
  setInfoOverlayVisibility(true);
  return infoOverlayOpen;
}

function closeInfoOverlay({ restoreFocus = false } = {}) {
  if (!infoOverlayOpen) return false;
  setInfoOverlayVisibility(false);
  if (restoreFocus && tasksInfoBtn) tasksInfoBtn.focus();
  return true;
}

function toggleInfoOverlay() {
  if (infoOverlayOpen) {
    return closeInfoOverlay();
  }
  openInfoOverlay();
  return true;
}

function updateTaskOverlayPosition(isOpen) {
  if (!taskOverlay) return;
  if (window.matchMedia('(hover: none)').matches) {
    taskOverlay.style.left = '50%';
    taskOverlay.style.right = 'auto';
    const translateY = isOpen ? '0' : '12px';
    taskOverlay.style.transform = `translate(-50%, ${translateY})`;
  } else {
    taskOverlay.style.left = '';
    taskOverlay.style.right = '';
    taskOverlay.style.transform = '';
  }
}

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

export function closeTasksMenu(force = false) {
  if (!sequencePanel) return;
  closeInfoOverlay();
  sequencePanel.classList.remove('open');
  if (!force) {
    sequencePanel.classList.add('closing');
    setTimeout(() => {
      sequencePanel.classList.remove('closing');
    }, 200);
  } else {
    sequencePanel.classList.remove('closing');
  }
  if (taskPanel) taskPanel.classList.remove('open');
  collapseAccordions();
  updateTaskOverlayPosition(false);
}

export function suppressTaskHover(duration = 320) {
  if (!sequencePanel) return;
  if (window.matchMedia('(hover: none)').matches) return;
  sequencePanel.classList.add(HOVER_SUPPRESS_CLASS);
  if (taskPanel) taskPanel.classList.add(HOVER_SUPPRESS_CLASS);
  window.setTimeout(() => {
    sequencePanel.classList.remove(HOVER_SUPPRESS_CLASS);
    if (taskPanel) taskPanel.classList.remove(HOVER_SUPPRESS_CLASS);
  }, duration);
}

export function initTaskPanelInteractions() {
  if (!sequencePanel) return;
  if (tasksTrigger) {
    tasksTrigger.addEventListener('click', event => {
      if (window.matchMedia('(hover: none)').matches) {
        event.preventDefault();
        const isOpen = sequencePanel.classList.toggle('open');
        if (taskPanel) {
          taskPanel.classList.toggle('open', isOpen);
        }
        updateTaskOverlayPosition(isOpen);
      }
    });
  }

  if (tasksInfoBtn) {
    tasksInfoBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleInfoOverlay();
    });
  }

  if (tasksInfoClose) {
    tasksInfoClose.addEventListener('click', event => {
      event.preventDefault();
      closeInfoOverlay({ restoreFocus: true });
    });
  }

  if (taskOverlay) {
    taskOverlay.addEventListener('click', event => event.stopPropagation());
  }

  if (tasksInfoPopup) {
    tasksInfoPopup.addEventListener('click', event => event.stopPropagation());
  }

  sequencePanel.addEventListener('mouseleave', () => {
    if (!window.matchMedia('(hover: none)').matches) {
      collapseAccordions();
    }
  });

  document.addEventListener('click', event => {
    if (
      infoOverlayOpen &&
      tasksInfoPopup &&
      !tasksInfoPopup.contains(event.target) &&
      event.target !== tasksInfoBtn
    ) {
      closeInfoOverlay();
    }
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
    if (event.key !== 'Escape') return;
    if (closeInfoOverlay({ restoreFocus: true })) return;
    closeTasksMenu();
  });

  setInfoOverlayVisibility(false);
  updateTaskOverlayPosition(false);
}
