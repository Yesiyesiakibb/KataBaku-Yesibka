/**
 * Pure View Renderers — Collector's Study Deck UI
 * - 3-Theme Swatch Switcher & sliding tab indicator (Cult UI)
 * - Stacked Deck Arena + 3D Foil Spotlight Specimen Choice Cards (UI Layouts + Aceternity)
 * - Bento Summary Scorecard & 2-Column Collector Index Card Grids
 * - Dynamic Status Pill toasts
 */
(function (global) {
  'use strict';

  const KB = (global.KataBaku = global.KataBaku || {});

  const VALID_THEMES = new Set(['dark', 'forest', 'light']);

  let dom = null;

  function bindDOM(refs) {
    dom = refs;
  }

  function formatSerial(id) {
    return `#${String(id).padStart(3, '0')}`;
  }

  /* --------------------------------------------------------------------------
     Toast Notifications (Dynamic Status Pill)
     -------------------------------------------------------------------------- */
  function showToast(text, tone) {
    if (!dom) return;
    const el = document.createElement('div');
    el.className = 'toast-item' + (tone === 'correct' ? ' is-correct' : '');

    const dot = document.createElement('span');
    dot.className = 'toast-dot';
    dot.setAttribute('aria-hidden', 'true');

    const msg = document.createElement('span');
    msg.textContent = text;

    el.appendChild(dot);
    el.appendChild(msg);
    dom.toastRegion.appendChild(el);

    setTimeout(() => {
      el.style.transition = 'opacity 180ms ease, transform 180ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px) scale(0.96)';
      setTimeout(() => el.remove(), 200);
    }, 2200);
  }

  /* --------------------------------------------------------------------------
     Header Controls & Sliding Mode Nav Indicator
     -------------------------------------------------------------------------- */
  function renderHeaderControls() {
    const { state, storage, ICONS } = KB;
    if (!VALID_THEMES.has(state.theme)) {
      state.theme = 'dark';
    }

    document.documentElement.setAttribute('data-theme', state.theme);
    storage.write(storage.KEYS.THEME, state.theme);

    if (dom.themeButtons) {
      dom.themeButtons.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === state.theme));
      });
    }

    storage.write(storage.KEYS.SOUND, String(state.soundEnabled));
    dom.btnSound.innerHTML = state.soundEnabled ? ICONS.soundOn : ICONS.soundOff;
    dom.btnSound.classList.toggle('is-active', state.soundEnabled);

    storage.write(storage.KEYS.AUTO_NEXT, String(state.autoNext));
    dom.btnAutoNext.setAttribute('aria-checked', String(state.autoNext));
  }

  function updateMistakesBadge() {
    const count = KB.engine.getMistakeIds().length;
    dom.mistakesBadge.textContent = String(count);
    dom.mistakesBadge.classList.toggle('is-hidden', count === 0);
    syncNavIndicator();
  }

  function syncNavIndicator() {
    if (!dom || !dom.modeNav || !dom.modeIndicator) return;
    const activeTab = dom.modeNav.querySelector('.mode-tab[aria-selected="true"]');
    if (!activeTab) return;

    const x = activeTab.offsetLeft;
    const w = activeTab.offsetWidth;
    if (w <= 0) return;

    dom.modeNav.classList.add('has-indicator');
    dom.modeIndicator.style.width = `${w}px`;
    dom.modeIndicator.style.transform = `translateX(${x}px)`;
    dom.modeIndicator.classList.add('is-ready');
  }

  function renderNav() {
    let activeTab = null;
    dom.modeTabs.forEach((tab) => {
      const isActive = tab.dataset.mode === KB.state.mode;
      tab.setAttribute('aria-selected', String(isActive));
      if (isActive) activeTab = tab;
    });
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    requestAnimationFrame(syncNavIndicator);
  }

  /* --------------------------------------------------------------------------
     Inline Drill Filter Controls
     -------------------------------------------------------------------------- */
  function renderControls() {
    const { state, engine, utils, ICONS, CATEGORIES } = KB;
    if (state.mode !== 'drill') {
      dom.controlsRegion.innerHTML = '';
      return;
    }

    const isRetry = Boolean(state.drillRetryIds && state.drillRetryIds.length > 0);
    const optionsHTML = CATEGORIES.map((cat) => {
      const count = engine.getPoolForCategory(cat).length;
      const selected = cat === state.drillCategory ? 'selected' : '';
      return `<option value="${utils.escapeHTML(cat)}" ${selected}>${utils.escapeHTML(cat)} (${count})</option>`;
    }).join('');

    const lengthBtn = (val, label) => {
      const pressed = !isRetry && state.drillTarget === val;
      return `<button type="button" class="length-btn tabular" data-target="${val}" aria-pressed="${pressed}">${label}</button>`;
    };

    dom.controlsRegion.innerHTML = `
      <div class="filter-bar">
        <div class="select-wrap">
          <select id="drill-category" class="filter-select" aria-label="Filter kategori kartu">
            ${optionsHTML}
          </select>
          <span class="select-chevron">${ICONS.chevronDown}</span>
        </div>
        <div class="length-group" role="group" aria-label="Jumlah kartu per sesi">
          ${lengthBtn(20, '20')}
          ${lengthBtn(50, '50')}
          ${lengthBtn(Infinity, 'Tanpa batas')}
        </div>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Speedrun Live Tick Update
     -------------------------------------------------------------------------- */
  function updateSpeedrunTick(secondsLeft) {
    const timerText = document.getElementById('speedrun-timer-val');
    const fillBar = document.getElementById('arena-hairline-fill');
    if (timerText) {
      timerText.textContent = `${KB.utils.formatDecimalID(secondsLeft)} d`;
      timerText.classList.toggle('is-urgent', secondsLeft <= 10);
    }
    if (fillBar) {
      fillBar.style.width = `${(secondsLeft / 60) * 100}%`;
      fillBar.classList.toggle('is-urgent', secondsLeft <= 10);
    }
  }

  /* --------------------------------------------------------------------------
     Shared Mini Collector Index Card Builder
     -------------------------------------------------------------------------- */
  function buildIndexCard(vocab, options) {
    const { utils, ICONS } = KB;
    const opts = options || {};

    let toolsHTML = `<span class="category-pill">${utils.escapeHTML(vocab.kategori)}</span>`;

    if (opts.showMistakeMeta) {
      const prog = opts.consecutiveCorrect || 0;
      toolsHTML = `
        <span class="mastery-dots" title="Penguasaan ${prog} dari 2" aria-label="Penguasaan ${prog} dari 2">
          <span class="mastery-dot ${prog >= 1 ? 'is-filled' : ''}"></span>
          <span class="mastery-dot ${prog >= 2 ? 'is-filled' : ''}"></span>
        </span>
        <button
          type="button"
          class="row-remove-btn"
          data-remove-mistake="${vocab.id}"
          aria-label="Hapus ${utils.escapeHTML(vocab.baku)} dari Bank salah"
        >
          ${ICONS.close}
        </button>
      `;
    }

    const extraCatLine = opts.showMistakeMeta
      ? `<div><span class="category-pill">${utils.escapeHTML(vocab.kategori)}</span></div>`
      : '';

    return `
      <article class="index-card">
        <div class="index-card-head">
          <span class="index-card-id">${formatSerial(vocab.id)}</span>
          <div class="index-card-tools">${toolsHTML}</div>
        </div>
        <div class="index-card-body">
          <div class="word-pair-line">
            <span class="dict-baku">${utils.escapeHTML(vocab.baku)}</span>
            <span class="dict-nonbaku">${utils.escapeHTML(vocab.tidakBaku)}</span>
          </div>
          ${extraCatLine}
          <p class="dict-note">${utils.escapeHTML(vocab.catatan)}</p>
        </div>
      </article>
    `;
  }

  /* --------------------------------------------------------------------------
     Main Stage Dispatcher
     -------------------------------------------------------------------------- */
  function renderMainStage() {
    const { state } = KB;
    if (state.mode === 'dictionary') {
      renderDictionary();
      return;
    }
    if (state.mode === 'speedrun' && state.session.status === 'ready') {
      renderSpeedrunReady();
      return;
    }
    if (state.mode === 'mistakes' && state.session.status === 'list') {
      renderMistakesList();
      return;
    }
    if (state.session.status === 'summary') {
      renderSummary();
      return;
    }
    renderArena();
  }

  /* --------------------------------------------------------------------------
     Arena View — Stacked Study Deck + Collector Specimen Choice Cards
     -------------------------------------------------------------------------- */
  function renderArena() {
    const { state, engine, utils, ICONS } = KB;
    const s = state.session;
    const item = s.currentItem;
    if (!item) return;

    const leftWord = s.leftIsBaku ? item.baku : item.tidakBaku;
    const rightWord = s.leftIsBaku ? item.tidakBaku : item.baku;
    const leftIsStandard = s.leftIsBaku;
    const rightIsStandard = !s.leftIsBaku;
    const cardSerial = formatSerial(item.id);

    let fillPct = 0;
    let isUrgent = false;

    if (state.mode === 'drill') {
      const target = engine.getDrillTargetCount();
      fillPct = Number.isFinite(target)
        ? Math.min(100, (s.totalAnswered / target) * 100)
        : ((s.totalAnswered % 20) / 20) * 100;
    } else if (state.mode === 'speedrun') {
      fillPct = (s.timeLeft / 60) * 100;
      isUrgent = s.timeLeft <= 10;
    } else if (state.mode === 'survival') {
      fillPct = (s.lives / 3) * 100;
      isUrgent = s.lives <= 1;
    } else if (state.mode === 'mistakes') {
      const rem = engine.getMistakeIds().length;
      fillPct = rem > 0 ? Math.max(8, 100 - rem * 5) : 100;
    }

    let statusLeft = '';
    let statusRight = '';
    const streakHotClass = s.streak >= 3 ? 'is-hot' : '';

    if (state.mode === 'drill') {
      const target = engine.getDrillTargetCount();
      const currentNum = s.totalAnswered + (s.answered ? 0 : 1);
      const progressText = Number.isFinite(target)
        ? `${Math.min(currentNum, target)} / ${target}`
        : `Kartu ${currentNum}`;
      const retryTag = state.drillRetryIds
        ? '<span class="category-pill">Ulangi yang salah</span>'
        : '';

      statusLeft = `
        <span class="deck-kicker">DEK KBBI V</span>
        <span class="metric-item tabular">
          <span class="metric-value">${progressText}</span>
        </span>
        ${retryTag}
      `;
      statusRight = `
        <span class="metric-streak tabular ${streakHotClass}" title="Streak berturut-turut">
          ${ICONS.flame}
          <span>${s.streak}</span>
        </span>
      `;
    } else if (state.mode === 'survival') {
      const hearts = [0, 1, 2]
        .map((idx) => (idx < s.lives ? ICONS.heartFull : ICONS.heartLost))
        .join('');
      statusLeft = `
        <div class="hearts-row ${s.justLostLife ? 'animate-shake' : ''}" aria-label="Sisa ${s.lives} nyawa">
          ${hearts}
        </div>
      `;
      statusRight = `
        <span class="metric-streak tabular ${streakHotClass}">
          ${ICONS.flame}
          <span>${s.streak}</span>
        </span>
        <span class="metric-item tabular">
          <span>Rekor</span>
          <span class="metric-value">${state.bestSurvival}</span>
        </span>
      `;
    } else if (state.mode === 'speedrun') {
      statusLeft = `
        <span class="deck-kicker">60 DETIK</span>
        <span id="speedrun-timer-val" class="metric-timer tabular ${isUrgent ? 'is-urgent' : ''}">
          ${utils.formatDecimalID(s.timeLeft)} d
        </span>
      `;
      statusRight = `
        <span class="metric-item tabular">
          <span>Benar</span>
          <span class="metric-value">${s.correctCount}</span>
        </span>
        <span class="metric-item tabular">
          <span>Rekor</span>
          <span class="metric-value">${state.bestSpeedrun}</span>
        </span>
      `;
    } else if (state.mode === 'mistakes') {
      const rem = engine.getMistakeIds().length;
      const entry = state.mistakes[item.id];
      const prog = entry ? entry.consecutiveCorrect : 2;
      const dots = `
        <span class="mastery-dots" aria-label="Penguasaan ${prog} dari 2">
          <span class="mastery-dot ${prog >= 1 ? 'is-filled' : ''}"></span>
          <span class="mastery-dot ${prog >= 2 ? 'is-filled' : ''}"></span>
        </span>
      `;
      statusLeft = `
        <button type="button" id="btn-back-mistakes" class="quiet-link-btn">
          ${ICONS.arrowLeft}
          <span>Kembali ke daftar</span>
        </button>
      `;
      statusRight = `
        <span class="metric-item tabular">
          <span>Sisa</span>
          <span class="metric-value">${rem}</span>
        </span>
        <span class="metric-item">
          <span>Lulus</span>
          ${dots}
        </span>
      `;
    }

    function buildSpecimenCard(side, word, isStandard) {
      const classes = ['choice-card'];
      let tagHTML = '<span class="verdict-tag is-placeholder" aria-hidden="true">Baku</span>';

      if (s.answered) {
        if (isStandard) {
          classes.push('is-standard');
          tagHTML = `<span class="verdict-tag is-baku">${ICONS.check}<span>Baku</span></span>`;
        } else {
          classes.push('is-nonstandard');
          if (s.selectedSide === side) {
            classes.push('is-wrong-picked', 'animate-shake');
          }
          tagHTML = `<span class="verdict-tag is-tidak-baku">${ICONS.cross}<span>Tidak baku</span></span>`;
        }
      }

      const slotLabel = side === 'left' ? 'Kartu A' : 'Kartu B';
      const kbdClass = side === 'left' ? 'is-left' : 'is-right';
      const kbdSymbol = side === 'left' ? '←' : '→';

      return `
        <button
          type="button"
          class="${classes.join(' ')}"
          data-choice="${side}"
          ${s.answered ? 'disabled' : ''}
        >
          <span class="specimen-header" aria-hidden="true">
            <span class="specimen-slot">
              <span class="specimen-dot"></span>
              <span>${slotLabel}</span>
            </span>
            <span class="specimen-code">${cardSerial}</span>
          </span>
          <span class="specimen-body">
            <span class="choice-word">${utils.escapeHTML(word)}</span>
            ${tagHTML}
          </span>
          <span class="keycap-hint ${kbdClass}" aria-hidden="true">${kbdSymbol}</span>
        </button>
      `;
    }

    let drawerClass = 'note-drawer is-idle';
    let drawerInner = '<p class="drawer-idle-text">Catatan KBBI V dan EYD V terbuka setelah memilih kartu.</p>';

    if (s.answered) {
      drawerClass = `note-drawer ${s.lastCorrect ? 'is-correct' : 'is-wrong'}`;
      const verdictText = s.lastCorrect ? 'Tepat' : 'Perlu diingat';
      const verdictClass = s.lastCorrect ? 'is-correct' : 'is-wrong';

      let nextLabel = 'Kartu berikutnya';
      if (state.mode === 'survival' && s.lives <= 0) {
        nextLabel = 'Lihat hasil';
      } else if (
        state.mode === 'drill' &&
        Number.isFinite(engine.getDrillTargetCount()) &&
        s.totalAnswered >= engine.getDrillTargetCount()
      ) {
        nextLabel = 'Lihat ringkasan';
      }

      let autoDuration = 0;
      if (state.mode === 'speedrun') {
        autoDuration = 350;
      } else if (state.autoNext) {
        autoDuration = s.lastCorrect ? 1250 : 2300;
      }

      const progressFillHTML =
        autoDuration > 0
          ? `<span class="btn-progress-bar" style="animation-duration:${autoDuration}ms" aria-hidden="true"></span>`
          : '';

      drawerInner = `
        <div class="drawer-content">
          <div class="drawer-copy">
            <div class="drawer-meta">
              <span class="drawer-verdict-label ${verdictClass}">${verdictText}</span>
              <span class="category-pill">${utils.escapeHTML(item.kategori)}</span>
            </div>
            <p class="drawer-note">${utils.escapeHTML(item.catatan)}</p>
          </div>
          ${
            state.mode !== 'speedrun'
              ? `<button type="button" id="btn-next" class="btn-primary">
                   <span>${nextLabel}</span>
                   <span class="desktop-kbd" aria-hidden="true">Spasi</span>
                   ${progressFillHTML}
                 </button>`
              : ''
          }
        </div>
      `;
    }

    const enterClass = s.isFreshQuestion ? 'animate-card-deal' : '';
    s.isFreshQuestion = false;

    dom.mainStage.innerHTML = `
      <div class="deck-stack">
        <article class="texture-card">
          <div class="texture-card-inner">
            <div class="hairline-track" aria-hidden="true">
              <div id="arena-hairline-fill" class="hairline-fill ${isUrgent ? 'is-urgent' : ''}" style="width: ${fillPct}%"></div>
            </div>
            <div class="arena-body">
              <div class="status-strip">
                <div class="status-group">${statusLeft}</div>
                <div class="status-group">${statusRight}</div>
              </div>

              <p class="prompt-line">Pilih kartu dengan bentuk kata yang baku sesuai KBBI V &amp; EYD V</p>

              <div class="choices-grid ${enterClass}">
                ${buildSpecimenCard('left', leftWord, leftIsStandard)}
                ${buildSpecimenCard('right', rightWord, rightIsStandard)}
              </div>

              <div class="${drawerClass}" aria-live="polite">
                ${drawerInner}
              </div>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Speedrun Ready Screen
     -------------------------------------------------------------------------- */
  function renderSpeedrunReady() {
    const { state, ICONS } = KB;
    dom.mainStage.innerHTML = `
      <div class="deck-stack">
        <section class="texture-card animate-card-deal">
          <div class="texture-card-inner panel-inner center-panel">
            <div class="panel-icon-wrap">${ICONS.timer}</div>
            <h2 class="panel-heading">Speedrun 60 detik</h2>
            <p class="panel-subtitle">
              Uji refleks membaca kartu kata baku secepat mungkin dalam satu menit. Setiap pilihan langsung menarik kartu berikutnya.
            </p>
            <div class="record-chip tabular">
              <span>Rekor speedrun</span>
              <strong>${state.bestSpeedrun} benar</strong>
            </div>
            <div>
              <button type="button" id="btn-start-speedrun" class="btn-primary">
                <span>Mulai 60 detik</span>
                <span class="desktop-kbd" aria-hidden="true">Spasi</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Summary Scorecard (UI Layouts Bento Grid + Missed Collector Cards)
     -------------------------------------------------------------------------- */
  function renderSummary() {
    const { state, ICONS } = KB;
    const s = state.session;
    const acc = s.totalAnswered > 0 ? Math.round((s.correctCount / s.totalAnswered) * 100) : 0;

    let heading = 'Sesi latihan selesai';
    let subtitle = 'Tinjau kembali kartu yang keliru agar tidak tertukar saat ujian.';
    let tilesHTML = '';

    if (state.mode === 'survival') {
      heading = 'Sesi survival berakhir';
      subtitle = 'Tiga kesempatan telah terpakai. Kartu yang keliru tersimpan di Bank salah.';
      tilesHTML = `
        <div class="score-tile is-featured">
          <span class="score-label">Streak sesi</span>
          <span class="score-number is-accent tabular">${s.maxSessionStreak}</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Rekor terbaik</span>
          <span class="score-number tabular">${state.bestSurvival}</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Akurasi</span>
          <span class="score-number is-correct tabular">${acc}%</span>
        </div>
      `;
    } else if (state.mode === 'speedrun') {
      heading = 'Waktu 60 detik selesai';
      subtitle = 'Ringkasan kecepatan dan ketepatan selama satu menit penuh.';
      tilesHTML = `
        <div class="score-tile is-featured">
          <span class="score-label">Total benar</span>
          <span class="score-number is-correct tabular">${s.correctCount}</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Kecepatan</span>
          <span class="score-number is-accent tabular">${s.totalAnswered} / mnt</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Akurasi</span>
          <span class="score-number tabular">${acc}%</span>
        </div>
      `;
    } else if (state.mode === 'mistakes') {
      heading = 'Bank salah tuntas';
      subtitle = 'Seluruh kartu kosakata yang pernah keliru sudah lulus dua kali berturut-turut.';
      tilesHTML = `
        <div class="score-tile is-featured">
          <span class="score-label">Akurasi</span>
          <span class="score-number is-correct tabular">${acc}%</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Total dijawab</span>
          <span class="score-number tabular">${s.totalAnswered}</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Benar</span>
          <span class="score-number is-accent tabular">${s.correctCount}</span>
        </div>
      `;
    } else {
      tilesHTML = `
        <div class="score-tile is-featured">
          <span class="score-label">Akurasi</span>
          <span class="score-number is-correct tabular">${acc}%</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Benar</span>
          <span class="score-number tabular">${s.correctCount} / ${s.totalAnswered}</span>
        </div>
        <div class="score-tile">
          <span class="score-label">Streak terbaik</span>
          <span class="score-number is-accent tabular">${s.maxSessionStreak}</span>
        </div>
      `;
    }

    const speedrunRecordRow =
      state.mode === 'speedrun'
        ? `<div class="record-chip tabular"><span>Rekor speedrun</span><strong>${state.bestSpeedrun} benar</strong></div>`
        : '';

    const missedSection =
      s.wrongItems.length > 0
        ? `
          <div class="word-list">
            <div class="word-list-header">
              <span class="word-list-title">Kartu yang keliru (${s.wrongItems.length})</span>
              <span class="word-list-hint">Tersimpan di Bank salah</span>
            </div>
            <div class="index-card-grid word-list-scroll">
              ${s.wrongItems.map((w) => buildIndexCard(w)).join('')}
            </div>
          </div>
        `
        : '<p class="summary-perfect-note">Sempurna — tidak ada jawaban keliru pada sesi ini.</p>';

    const showRetry = s.wrongItems.length > 0 && state.mode === 'drill';
    const restartBtnClass = showRetry ? 'btn-secondary' : 'btn-primary';
    const restartBtnLabel = state.mode === 'mistakes' ? 'Mulai latihan' : 'Mulai sesi baru';

    dom.mainStage.innerHTML = `
      <div class="deck-stack">
        <section class="texture-card animate-card-deal">
          <div class="texture-card-inner panel-inner center-panel">
            <div class="panel-icon-wrap">${ICONS.award}</div>
            <h2 class="panel-heading">${heading}</h2>
            <p class="panel-subtitle">${subtitle}</p>
            ${speedrunRecordRow}
            <div class="bento-scorecard">${tilesHTML}</div>
            ${missedSection}
            <div class="summary-actions">
              ${
                showRetry
                  ? `<button type="button" id="btn-retry-wrong" class="btn-primary">Ulangi yang salah (${s.wrongItems.length})</button>`
                  : ''
              }
              <button type="button" id="btn-new-session" class="${restartBtnClass}">${restartBtnLabel}</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  /* --------------------------------------------------------------------------
     Bank Salah List View (2-Column Collector Card Grid)
     -------------------------------------------------------------------------- */
  function renderMistakesList() {
    const { state, engine, ICONS, VOCAB_BY_ID } = KB;
    const ids = engine.getMistakeIds();

    if (ids.length === 0) {
      dom.mainStage.innerHTML = `
        <div class="deck-stack">
          <section class="texture-card animate-card-deal">
            <div class="texture-card-inner panel-inner center-panel">
              <div class="panel-icon-wrap">${ICONS.book}</div>
              <h2 class="panel-heading">Bank salah masih kosong</h2>
              <p class="panel-subtitle">
                Setiap kartu yang keliru dijawab di mode mana pun akan tercatat otomatis di sini untuk dilatih ulang hingga lulus dua kali berturut-turut.
              </p>
              <button type="button" id="btn-go-drill" class="btn-primary">Mulai latihan</button>
            </div>
          </section>
        </div>
      `;
      return;
    }

    const entries = ids
      .map((id) => ({ vocab: VOCAB_BY_ID.get(id), meta: state.mistakes[id] }))
      .sort((a, b) => (b.meta.updatedAt || 0) - (a.meta.updatedAt || 0));

    dom.mainStage.innerHTML = `
      <section class="texture-card animate-card-deal">
        <div class="texture-card-inner panel-inner">
          <div class="section-header-row">
            <div class="section-title-block">
              <h2 class="section-title tabular">Bank salah (${entries.length})</h2>
              <p class="section-desc">Jawab benar dua kali berturut-turut agar kartu lulus dari daftar.</p>
            </div>
            <button type="button" id="btn-drill-mistakes" class="btn-primary">Latih bank salah</button>
          </div>

          <div class="index-card-grid kamus-scroll">
            ${entries
              .map(({ vocab, meta }) =>
                buildIndexCard(vocab, {
                  showMistakeMeta: true,
                  consecutiveCorrect: meta.consecutiveCorrect || 0,
                })
              )
              .join('')}
          </div>

          <div class="clear-bar">
            ${
              state.confirmClearMistakes
                ? `<span class="clear-warning">Hapus semua catatan?</span>
                   <button type="button" id="btn-clear-yes" class="btn-danger">Ya, hapus semua</button>
                   <button type="button" id="btn-clear-no" class="btn-secondary">Batal</button>`
                : '<button type="button" id="btn-clear-ask" class="quiet-link-btn">Bersihkan daftar</button>'
            }
          </div>
        </div>
      </section>
    `;
  }

  /* --------------------------------------------------------------------------
     Kamus SNBT View (2-Column Collector Index Cards)
     -------------------------------------------------------------------------- */
  function renderDictionary() {
    const { state, utils, ICONS, VOCABULARY, CATEGORIES } = KB;
    const query = state.dictSearch.trim().toLowerCase();

    const filtered = VOCABULARY.filter((item) => {
      const catOk = state.dictCategory === 'Semua' || item.kategori === state.dictCategory;
      if (!catOk) return false;
      if (!query) return true;
      return (
        item.baku.toLowerCase().includes(query) ||
        item.tidakBaku.toLowerCase().includes(query) ||
        item.kategori.toLowerCase().includes(query) ||
        item.catatan.toLowerCase().includes(query)
      );
    });

    if (!document.getElementById('kamus-search-input')) {
      dom.mainStage.innerHTML = `
        <section class="texture-card animate-card-deal">
          <div class="texture-card-inner panel-inner">
            <div class="search-field">
              ${ICONS.search}
              <input
                id="kamus-search-input"
                type="search"
                class="search-input"
                value="${utils.escapeHTML(state.dictSearch)}"
                placeholder="Cari kartu kata baku, tidak baku, atau catatan..."
                aria-label="Cari kosakata KBBI V dan EYD V"
              />
              <span class="kbd-cap search-kbd desktop-kbd" aria-hidden="true">/</span>
            </div>

            <div id="kamus-pills" class="pill-strip" role="group" aria-label="Filter kategori kamus"></div>
            <div id="kamus-count" class="kamus-count tabular"></div>
            <div id="kamus-list" class="index-card-grid kamus-scroll"></div>
          </div>
        </section>
      `;
    }

    const pillsEl = document.getElementById('kamus-pills');
    if (pillsEl) {
      pillsEl.innerHTML = CATEGORIES.map(
        (cat) => `
          <button
            type="button"
            class="cat-filter-pill"
            data-dict-cat="${utils.escapeHTML(cat)}"
            aria-pressed="${cat === state.dictCategory}"
          >
            ${utils.escapeHTML(cat)}
          </button>
        `
      ).join('');
    }

    const countEl = document.getElementById('kamus-count');
    if (countEl) {
      countEl.textContent = `MENAMPILKAN ${filtered.length} DARI ${VOCABULARY.length} KARTU KOSAKATA`;
    }

    const listEl = document.getElementById('kamus-list');
    if (listEl) {
      if (filtered.length === 0) {
        listEl.innerHTML = '<p class="empty-search-note">Tidak ada kartu kosakata yang cocok dengan pencarian.</p>';
      } else {
        listEl.innerHTML = filtered.map((item) => buildIndexCard(item)).join('');
      }
    }
  }

  function renderAll() {
    renderNav();
    renderControls();
    renderMainStage();
    updateMistakesBadge();
  }

  KB.render = {
    bindDOM,
    showToast,
    renderHeaderControls,
    updateMistakesBadge,
    syncNavIndicator,
    renderNav,
    renderControls,
    updateSpeedrunTick,
    renderMainStage,
    renderMistakesList,
    renderDictionary,
    renderAll,
  };
})(window);
