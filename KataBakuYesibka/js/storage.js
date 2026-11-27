/**
 * Safe localStorage persistence wrapper (preserves katabaku_v2_* keys)
 */
(function (global) {
  'use strict';

  const KB = (global.KataBaku = global.KataBaku || {});

  const KEYS = {
    THEME: 'katabaku_v2_theme',
    SOUND: 'katabaku_v2_sound',
    AUTO_NEXT: 'katabaku_v2_autonext',
    BEST_STREAK: 'katabaku_v2_best_streak',
    BEST_SURVIVAL: 'katabaku_v2_best_survival',
    BEST_SPEEDRUN: 'katabaku_v2_best_speedrun',
    MISTAKES: 'katabaku_v2_mistakes',
  };

  function read(key, fallback) {
    try {
      const value = global.localStorage.getItem(key);
      return value !== null ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      global.localStorage.setItem(key, serialized);
    } catch (_) {
      // Ignore quota / private browsing errors
    }
  }

  KB.storage = {
    KEYS,
    read,
    readJSON,
    write,
  };
})(window);
