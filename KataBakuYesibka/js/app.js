/**
 * Application Bootstrap, Event Delegation, 3D Foil Tilt & Keyboard Shortcuts
 */
(function (global) {
  'use strict';

  const KB = (global.KataBaku = global.KataBaku || {});

  const THEME_LABELS = {
    dark: 'Obsidian & Kuningan',
    forest: 'Botani & Matcha',
    light: 'Kertas Arsip',
  };

  function prefersReducedMotion() {
    return (
      typeof global.matchMedia === 'function' &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function init() {
    const { state, engine, render, audio } = KB;

    const dom = {
      btnAutoNext: document.getElementById('btn-autonext'),
      btnSound: document.getElementById('btn-sound'),
      themeSwitcher: document.getElementById('theme-switcher'),
      themeButtons: document.querySelectorAll('[data-theme-choice]'),
      modeNav: document.getElementById('mode-nav'),
      modeIndicator: document.getElementById('mode-nav-indicator'),
      modeTabs: document.querySelectorAll('.mode-tab'),
      mistakesBadge: document.getElementById('mistakes-badge'),
      controlsRegion: document.getElementById('controls-region'),
      mainStage: document.getElementById('main-stage'),
      toastRegion: document.getElementById('toast-region'),
    };

    render.bindDOM(dom);

    /* ----------------------------------------------------------------------
       Header Controls (3-Theme Swatch Switcher, Sound, Auto-next)
       ---------------------------------------------------------------------- */
    if (dom.themeSwitcher) {
      dom.themeSwitcher.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-theme-choice]');
        if (!btn) return;
        const chosen = btn.dataset.themeChoice;
        if (state.theme === chosen) return;
        state.theme = chosen;
        render.renderHeaderControls();
        audio.playTone('press', state.soundEnabled);
        render.showToast(`Tema: ${THEME_LABELS[chosen] || chosen}`);
      });
    }

    dom.btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      render.renderHeaderControls();
      if (state.soundEnabled) audio.playTone('press', true);
    });

    dom.btnAutoNext.addEventListener('click', () => {
      state.autoNext = !state.autoNext;
      render.renderHeaderControls();
      audio.playTone('press', state.soundEnabled);
    });

    /* ----------------------------------------------------------------------
       Mode Tabs + Responsive Sliding Indicator
       ---------------------------------------------------------------------- */
    dom.modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        engine.switchMode(tab.dataset.mode);
      });
    });

    global.addEventListener('resize', () => {
      render.syncNavIndicator();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => render.syncNavIndicator());
    }

    /* ----------------------------------------------------------------------
       Inline Drill Controls Delegation
       ---------------------------------------------------------------------- */
    dom.controlsRegion.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('[data-target]');
      if (targetBtn) {
        const val = targetBtn.dataset.target;
        state.drillTarget = val === 'Infinity' ? Infinity : Number(val);
        audio.playTone('press', state.soundEnabled);
        engine.startDrill(null);
      }
    });

    dom.controlsRegion.addEventListener('change', (e) => {
      if (e.target.id === 'drill-category') {
        state.drillCategory = e.target.value;
        engine.startDrill(null);
      }
    });

    /* ----------------------------------------------------------------------
       Aceternity 3D Card Tilt + Cursor-Tracking Foil Spotlight
       ---------------------------------------------------------------------- */
    const MAX_TILT = 4.2;

    dom.mainStage.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.choice-card');
      if (!card || card.disabled) return;
      const rect = card.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      card.style.setProperty('--spot-x', `${px}px`);
      card.style.setProperty('--spot-y', `${py}px`);

      if (!prefersReducedMotion() && e.pointerType !== 'touch') {
        const nx = (px / rect.width) * 2 - 1;
        const ny = (py / rect.height) * 2 - 1;
        card.style.setProperty('--rx', `${(-ny * MAX_TILT).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(nx * MAX_TILT).toFixed(2)}deg`);
      }
    });

    dom.mainStage.addEventListener('pointerout', (e) => {
      const card = e.target.closest('.choice-card');
      if (!card || card.contains(e.relatedTarget)) return;
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });

    /* ----------------------------------------------------------------------
       Main Stage Click & Input Delegation
       ---------------------------------------------------------------------- */
    dom.mainStage.addEventListener('click', (e) => {
      const choiceBtn = e.target.closest('[data-choice]');
      if (choiceBtn && !choiceBtn.disabled) {
        engine.submitAnswer(choiceBtn.dataset.choice);
        return;
      }

      if (e.target.closest('#btn-next')) {
        audio.playTone('press', state.soundEnabled);
        engine.advance();
        return;
      }

      if (e.target.closest('#btn-start-speedrun')) {
        audio.playTone('press', state.soundEnabled);
        engine.beginSpeedrun();
        return;
      }

      if (e.target.closest('#btn-retry-wrong')) {
        audio.playTone('press', state.soundEnabled);
        const ids = state.session.wrongItems.map((w) => w.id);
        engine.startDrill(ids);
        return;
      }

      if (e.target.closest('#btn-new-session')) {
        audio.playTone('press', state.soundEnabled);
        if (state.mode === 'drill') engine.startDrill(null);
        else if (state.mode === 'survival') engine.startSurvival();
        else if (state.mode === 'speedrun') engine.beginSpeedrun();
        else if (state.mode === 'mistakes') engine.switchMode('drill');
        return;
      }

      if (e.target.closest('#btn-go-drill')) {
        engine.switchMode('drill');
        return;
      }

      if (e.target.closest('#btn-drill-mistakes')) {
        audio.playTone('press', state.soundEnabled);
        engine.startMistakesDrill();
        return;
      }

      if (e.target.closest('#btn-back-mistakes')) {
        engine.openMistakesList();
        return;
      }

      const removeBtn = e.target.closest('[data-remove-mistake]');
      if (removeBtn) {
        engine.deleteMistake(Number(removeBtn.dataset.removeMistake));
        render.renderMistakesList();
        render.showToast('Kartu dihapus dari Bank salah.');
        return;
      }

      if (e.target.closest('#btn-clear-ask')) {
        state.confirmClearMistakes = true;
        render.renderMistakesList();
        return;
      }

      if (e.target.closest('#btn-clear-no')) {
        state.confirmClearMistakes = false;
        render.renderMistakesList();
        return;
      }

      if (e.target.closest('#btn-clear-yes')) {
        engine.clearAllMistakes();
        render.renderMistakesList();
        render.showToast('Bank salah dibersihkan.');
        return;
      }

      const dictCatBtn = e.target.closest('[data-dict-cat]');
      if (dictCatBtn) {
        state.dictCategory = dictCatBtn.dataset.dictCat;
        render.renderDictionary();
      }
    });

    dom.mainStage.addEventListener('input', (e) => {
      if (e.target.id === 'kamus-search-input') {
        state.dictSearch = e.target.value;
        render.renderDictionary();
      }
    });

    /* ----------------------------------------------------------------------
       Keyboard-First Navigation (Devigner UI standard)
       ---------------------------------------------------------------------- */
    function triggerKeyboardChoice(side) {
      const card = dom.mainStage.querySelector(`[data-choice="${side}"]`);
      if (!card || card.disabled) return;
      card.classList.add('is-pressed');
      setTimeout(() => {
        engine.submitAnswer(side);
      }, 65);
    }

    document.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const activeTag = activeEl ? activeEl.tagName : '';

      if (e.key === 'Escape') {
        if (activeTag === 'INPUT' || activeTag === 'SELECT') {
          activeEl.blur();
          return;
        }
        if (state.mode === 'mistakes' && state.confirmClearMistakes) {
          state.confirmClearMistakes = false;
          render.renderMistakesList();
          return;
        }
      }

      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (state.mode === 'dictionary' && e.key === '/') {
        const searchInput = document.getElementById('kamus-search-input');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
        return;
      }

      if (state.mode === 'speedrun' && state.session.status === 'ready') {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          audio.playTone('press', state.soundEnabled);
          engine.beginSpeedrun();
        }
        return;
      }

      const isQuizMode =
        state.mode === 'drill' ||
        state.mode === 'survival' ||
        state.mode === 'speedrun' ||
        state.mode === 'mistakes';

      if (!isQuizMode || state.session.status !== 'active') return;

      if (!state.session.answered) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Digit1') {
          e.preventDefault();
          triggerKeyboardChoice('left');
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Digit2') {
          e.preventDefault();
          triggerKeyboardChoice('right');
        }
      } else if (state.mode !== 'speedrun') {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          audio.playTone('press', state.soundEnabled);
          engine.advance();
        }
      }
    });

    /* ----------------------------------------------------------------------
       Initial Render
       ---------------------------------------------------------------------- */
    render.renderHeaderControls();
    render.updateMistakesBadge();
    engine.startDrill(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
