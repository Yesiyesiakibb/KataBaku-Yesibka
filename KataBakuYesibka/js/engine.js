/**
 * Application State & Quiz Session Engine
 */
(function (global) {
  'use strict';

  const KB = (global.KataBaku = global.KataBaku || {});
  const { KEYS, read, readJSON, write } = KB.storage;

  /* --------------------------------------------------------------------------
     Helpers
     -------------------------------------------------------------------------- */
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatDecimalID(num) {
    return num.toFixed(1).replace('.', ',');
  }

  /* --------------------------------------------------------------------------
     State Store
     -------------------------------------------------------------------------- */
  const state = {
    mode: 'drill', // 'drill' | 'survival' | 'speedrun' | 'mistakes' | 'dictionary'
    theme: read(KEYS.THEME, 'dark'),
    soundEnabled: read(KEYS.SOUND, 'true') !== 'false',
    autoNext: read(KEYS.AUTO_NEXT, 'true') !== 'false',

    bestStreak: Number(read(KEYS.BEST_STREAK, '0')) || 0,
    bestSurvival: Number(read(KEYS.BEST_SURVIVAL, '0')) || 0,
    bestSpeedrun: Number(read(KEYS.BEST_SPEEDRUN, '0')) || 0,
    mistakes: readJSON(KEYS.MISTAKES, {}),

    drillCategory: 'Semua',
    drillTarget: 20, // 20 | 50 | Infinity
    drillRetryIds: null,

    dictSearch: '',
    dictCategory: 'Semua',
    confirmClearMistakes: false,

    session: createEmptySession(),
    autoNextTimer: null,
    speedrunInterval: null,
  };

  function createEmptySession() {
    return {
      status: 'active', // 'ready' | 'active' | 'summary' | 'list'
      queue: [],
      currentItem: null,
      leftIsBaku: Math.random() < 0.5,
      answered: false,
      isFreshQuestion: true,
      selectedSide: null,
      lastCorrect: null,
      totalAnswered: 0,
      correctCount: 0,
      streak: 0,
      maxSessionStreak: 0,
      wrongItems: [],
      lives: 3,
      justLostLife: false,
      timeLeft: 60.0,
    };
  }

  /* --------------------------------------------------------------------------
     Timer Lifecycle
     -------------------------------------------------------------------------- */
  function clearAutoNext() {
    if (state.autoNextTimer) {
      clearTimeout(state.autoNextTimer);
      state.autoNextTimer = null;
    }
  }

  function clearAllTimers() {
    clearAutoNext();
    if (state.speedrunInterval) {
      clearInterval(state.speedrunInterval);
      state.speedrunInterval = null;
    }
  }

  /* --------------------------------------------------------------------------
     Mistake Bank Operations
     -------------------------------------------------------------------------- */
  function getMistakeIds() {
    return Object.keys(state.mistakes)
      .map(Number)
      .filter((id) => KB.VOCAB_BY_ID.has(id));
  }

  function persistMistakes() {
    write(KEYS.MISTAKES, state.mistakes);
    if (KB.render) KB.render.updateMistakesBadge();
  }

  function addMistake(id) {
    const cur = state.mistakes[id];
    state.mistakes[id] = {
      wrongCount: cur ? cur.wrongCount + 1 : 1,
      consecutiveCorrect: 0,
      updatedAt: Date.now(),
    };
    persistMistakes();
  }

  function markMistakeCorrect(id) {
    const entry = state.mistakes[id];
    if (!entry) return false;
    entry.consecutiveCorrect = (entry.consecutiveCorrect || 0) + 1;
    entry.updatedAt = Date.now();
    if (entry.consecutiveCorrect >= 2) {
      delete state.mistakes[id];
      persistMistakes();
      return true;
    }
    persistMistakes();
    return false;
  }

  function deleteMistake(id) {
    delete state.mistakes[id];
    persistMistakes();
  }

  function clearAllMistakes() {
    state.mistakes = {};
    state.confirmClearMistakes = false;
    persistMistakes();
  }

  /* --------------------------------------------------------------------------
     Pool & Queue Management
     -------------------------------------------------------------------------- */
  function getPoolForCategory(category) {
    if (!category || category === 'Semua') return KB.VOCABULARY;
    return KB.VOCABULARY.filter((item) => item.kategori === category);
  }

  function getDrillTargetCount() {
    if (state.mode !== 'drill') return Infinity;
    if (state.drillRetryIds && state.drillRetryIds.length > 0) {
      return state.drillRetryIds.length;
    }
    return state.drillTarget;
  }

  function refillQueue(avoidId) {
    let pool = [];
    if (state.mode === 'drill') {
      if (state.drillRetryIds && state.drillRetryIds.length > 0) {
        pool = state.drillRetryIds.map((id) => KB.VOCAB_BY_ID.get(id)).filter(Boolean);
      } else {
        pool = getPoolForCategory(state.drillCategory);
      }
    } else if (state.mode === 'survival' || state.mode === 'speedrun') {
      pool = KB.VOCABULARY;
    } else if (state.mode === 'mistakes') {
      pool = getMistakeIds().map((id) => KB.VOCAB_BY_ID.get(id)).filter(Boolean);
    }

    const list = shuffle(pool);
    if (avoidId != null && list.length > 1 && list[0].id === avoidId) {
      const swapIndex = 1 + Math.floor(Math.random() * (list.length - 1));
      [list[0], list[swapIndex]] = [list[swapIndex], list[0]];
    }
    return list;
  }

  function resetSession() {
    clearAllTimers();
    state.session = createEmptySession();
  }

  /* --------------------------------------------------------------------------
     Mode Transitions & Question Flow
     -------------------------------------------------------------------------- */
  function startDrill(retryIds) {
    state.drillRetryIds = retryIds || null;
    resetSession();
    state.session.queue = refillQueue(null);
    nextQuestion(true);
    KB.render.renderAll();
  }

  function startSurvival() {
    resetSession();
    state.session.lives = 3;
    state.session.queue = refillQueue(null);
    nextQuestion(true);
    KB.render.renderAll();
  }

  function prepareSpeedrun() {
    resetSession();
    state.session.status = 'ready';
    state.session.timeLeft = 60.0;
    KB.render.renderAll();
  }

  function beginSpeedrun() {
    resetSession();
    state.session.status = 'active';
    state.session.timeLeft = 60.0;
    state.session.queue = refillQueue(null);
    nextQuestion(true);
    KB.render.renderAll();

    const startAt = performance.now();
    const totalMs = 60000;

    state.speedrunInterval = setInterval(() => {
      const elapsed = performance.now() - startAt;
      const left = Math.max(0, (totalMs - elapsed) / 1000);
      state.session.timeLeft = left;

      KB.render.updateSpeedrunTick(left);

      if (left <= 0) {
        finishSpeedrun();
      }
    }, 100);
  }

  function finishSpeedrun() {
    clearAllTimers();
    state.session.timeLeft = 0;
    state.session.status = 'summary';
    if (state.session.correctCount > state.bestSpeedrun) {
      state.bestSpeedrun = state.session.correctCount;
      write(KEYS.BEST_SPEEDRUN, String(state.bestSpeedrun));
    }
    KB.render.renderAll();
  }

  function openMistakesList() {
    clearAllTimers();
    state.confirmClearMistakes = false;
    resetSession();
    state.session.status = 'list';
    KB.render.renderAll();
  }

  function startMistakesDrill() {
    if (getMistakeIds().length === 0) {
      openMistakesList();
      return;
    }
    resetSession();
    state.session.status = 'active';
    state.session.queue = refillQueue(null);
    nextQuestion(true);
    KB.render.renderAll();
  }

  function nextQuestion(isFirst) {
    clearAutoNext();
    const prevId = state.session.currentItem ? state.session.currentItem.id : null;

    if (!isFirst) {
      if (state.mode === 'drill') {
        const target = getDrillTargetCount();
        if (Number.isFinite(target) && state.session.totalAnswered >= target) {
          state.session.status = 'summary';
          return;
        }
      } else if (state.mode === 'survival') {
        if (state.session.lives <= 0) {
          state.session.status = 'summary';
          return;
        }
      } else if (state.mode === 'mistakes') {
        if (getMistakeIds().length === 0) {
          state.session.status = 'summary';
          return;
        }
        state.session.queue = state.session.queue.filter((item) => Boolean(state.mistakes[item.id]));
      }
    }

    if (state.session.queue.length === 0) {
      state.session.queue = refillQueue(prevId);
    }

    if (state.session.queue.length === 0) {
      state.session.status = 'summary';
      return;
    }

    state.session.currentItem = state.session.queue.shift();
    state.session.leftIsBaku = Math.random() < 0.5;
    state.session.answered = false;
    state.session.isFreshQuestion = true;
    state.session.selectedSide = null;
    state.session.lastCorrect = null;
    state.session.justLostLife = false;
  }

  function submitAnswer(side) {
    const s = state.session;
    if (s.status !== 'active' || s.answered || !s.currentItem) return;

    const item = s.currentItem;
    const isCorrect = (side === 'left' && s.leftIsBaku) || (side === 'right' && !s.leftIsBaku);

    s.answered = true;
    s.isFreshQuestion = false;
    s.selectedSide = side;
    s.lastCorrect = isCorrect;
    s.totalAnswered += 1;
    s.justLostLife = false;

    if (isCorrect) {
      s.correctCount += 1;
      s.streak += 1;

      if (s.streak > s.maxSessionStreak) {
        s.maxSessionStreak = s.streak;
      }
      if (s.streak > state.bestStreak) {
        state.bestStreak = s.streak;
        write(KEYS.BEST_STREAK, String(state.bestStreak));
      }
      if (state.mode === 'survival' && s.streak > state.bestSurvival) {
        state.bestSurvival = s.streak;
        write(KEYS.BEST_SURVIVAL, String(state.bestSurvival));
      }

      if (state.mode === 'mistakes') {
        const graduated = markMistakeCorrect(item.id);
        if (graduated) {
          KB.audio.playTone('mastered', state.soundEnabled);
          KB.render.showToast(`Kata "${item.baku}" lulus dari Bank salah.`, 'correct');
        } else {
          KB.audio.playTone('correct', state.soundEnabled);
        }
      } else {
        KB.audio.playTone('correct', state.soundEnabled);
        if (state.mode !== 'speedrun' && s.streak > 0 && s.streak % 10 === 0) {
          KB.render.showToast(`Streak ${s.streak} berturut-turut!`, 'correct');
        }
      }
    } else {
      s.streak = 0;
      KB.audio.playTone('wrong', state.soundEnabled);
      if (!s.wrongItems.some((w) => w.id === item.id)) {
        s.wrongItems.push(item);
      }
      addMistake(item.id);

      if (state.mode === 'survival') {
        s.lives = Math.max(0, s.lives - 1);
        s.justLostLife = true;
      }
    }

    KB.render.renderMainStage();

    if (state.mode === 'speedrun') {
      state.autoNextTimer = setTimeout(() => {
        if (state.mode === 'speedrun' && state.session.status === 'active') {
          advance();
        }
      }, 350);
    } else if (state.autoNext) {
      const delay = isCorrect ? 1250 : 2300;
      state.autoNextTimer = setTimeout(() => {
        advance();
      }, delay);
    }
  }

  function advance() {
    clearAutoNext();
    nextQuestion(false);
    KB.render.renderAll();
  }

  function switchMode(newMode) {
    if (state.mode === newMode && newMode !== 'mistakes') return;
    clearAllTimers();
    state.mode = newMode;
    state.drillRetryIds = null;

    if (newMode === 'drill') startDrill(null);
    else if (newMode === 'survival') startSurvival();
    else if (newMode === 'speedrun') prepareSpeedrun();
    else if (newMode === 'mistakes') openMistakesList();
    else if (newMode === 'dictionary') KB.render.renderAll();
  }

  KB.utils = {
    escapeHTML,
    shuffle,
    formatDecimalID,
  };

  KB.state = state;

  KB.engine = {
    clearAllTimers,
    clearAutoNext,
    getMistakeIds,
    deleteMistake,
    clearAllMistakes,
    getPoolForCategory,
    getDrillTargetCount,
    startDrill,
    startSurvival,
    prepareSpeedrun,
    beginSpeedrun,
    openMistakesList,
    startMistakesDrill,
    submitAnswer,
    advance,
    switchMode,
  };
})(window);
