/* ========================================
   SESSIONS.JS - Halaman Sesi Backtest (Statistik + Radar Chart)
   ======================================== */

const Sessions = {
  radarCharts: {}, // map: sessionId → Chart instance

  init() {
    this.container = document.getElementById('sessions-page-list');
    this.initModal();
  },

  /** Setup singleton modal DOM — dipasang sekali di body */
  initModal() {
    if (document.getElementById('pfp-modal-overlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="pfp-modal-overlay" id="pfp-modal-overlay">
        <div class="pfp-modal" id="pfp-modal">
          <div class="pfp-modal__header">
            <div class="pfp-modal__header-left">
              <div class="pfp-modal__logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div class="pfp-modal__title">Analisis Funding Pips</div>
                <div class="pfp-modal__subtitle" id="pfp-modal-subtitle">2-Step Challenge</div>
              </div>
            </div>
            <button class="pfp-modal__close" id="pfp-modal-close" aria-label="Tutup">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="pfp-modal__body" id="pfp-modal-body"></div>
          <div class="pfp-modal__footer">
            <a href="https://app.fundingpips.com/register?ref=9F3EAD28"
               target="_blank" rel="noopener noreferrer"
               class="btn pfp-cta-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              🚀 Ikut Tantangan — Daftar Funding Pips
            </a>
            <button class="btn btn--secondary pfp-modal-cancel-btn">Tutup</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);

    document.getElementById('pfp-modal-close').addEventListener('click', () => this.closeModal());
    document.querySelector('.pfp-modal-cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('pfp-modal-overlay').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  openModal() {
    const ov = document.getElementById('pfp-modal-overlay');
    if (ov) { ov.classList.add('active'); document.body.style.overflow = 'hidden'; }
  },

  closeModal() {
    const ov = document.getElementById('pfp-modal-overlay');
    if (ov) { ov.classList.remove('active'); document.body.style.overflow = ''; }
  },

  showPropFirmModal(session, stats) {
    const body = document.getElementById('pfp-modal-body');
    const sub = document.getElementById('pfp-modal-subtitle');
    if (!body) return;
    sub.textContent = `${session.name} · ${session.pair} · R:R 1:${session.rr}`;
    body.innerHTML = this.buildModalContent(session, stats);
    this.openModal();
  },

  buildModalContent(session, stats) {
    const std = this.calcPropFirmScore(session, stats, 'standard');
    const pro = this.calcPropFirmScore(session, stats, 'pro');
    const SR = this.PROP_RULES.standard;
    const PR = this.PROP_RULES.pro;

    const gradeOf = score => {
      if (score >= 80) return { label: 'Sangat Layak', cls: 'grade--tp' };
      if (score >= 60) return { label: 'Layak', cls: 'grade--accent' };
      if (score >= 40) return { label: 'Perlu Perbaikan', cls: 'grade--warn' };
      return { label: 'Tidak Layak', cls: 'grade--sl' };
    };
    const check = ok => ok
      ? '<span class="pfp-check pfp-check--ok">✓</span>'
      : '<span class="pfp-check pfp-check--fail">✗</span>';
    const bar = (pct, color) =>
      `<div class="pfp-bar-track"><div class="pfp-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;

    const col = (rule, sc, checks) => {
      const g = gradeOf(sc.score);
      return `
        <div class="pfp-modal-col" style="--rc:${rule.color};">
          <div class="pfp-modal-col__badge">
            <span class="pfp-badge" style="background:${rule.glow};color:${rule.color};">${rule.name === '2-Step Standard' ? '⭐ Standard' : '🔥 Pro'}</span>
            <span class="pfp-rules-card__lev">Leverage ${rule.leverage}</span>
          </div>

          <div class="pfp-modal-score-hero">
            <span class="pfp-modal-score-big" style="color:${rule.color}">${sc.score}<small>%</small></span>
            <span class="pfp-grade ${g.cls}">${g.label}</span>
          </div>
          ${bar(sc.score, rule.color)}
          <p class="pfp-score-card__hint">Probabilitas lolos Phase 1</p>

          <table class="pfp-rules-table pfp-rules-table--modal">
            <tr><td>Phase 1 Target</td><td class="pfp-val pfp-val--ok">+${rule.p1Target}%</td></tr>
            <tr><td>Phase 2 Target</td><td class="pfp-val pfp-val--ok">+${rule.p2Target}%</td></tr>
            <tr><td>Max DD Harian</td><td class="pfp-val pfp-val--warn">${rule.maxDailyDD}%</td></tr>
            <tr><td>Max DD Total</td><td class="pfp-val pfp-val--warn">${rule.maxTotalDD}%</td></tr>
            <tr><td>Min Hari/Phase</td><td class="pfp-val">${rule.minDays} hari</td></tr>
            <tr><td>Batas Waktu</td><td class="pfp-val">♾️ Tidak ada</td></tr>
            ${rule.consistency ? `<tr><td>Konsistensi</td><td class="pfp-val pfp-val--warn">&le;${rule.consistency}%/hari</td></tr>` : '<tr><td>Konsistensi</td><td class="pfp-val">—</td></tr>'}
            <tr><td>Fee Refund</td><td class="pfp-val ${rule.feeRefundable ? 'pfp-val--ok">✓ Ya' : 'pfp-val--fail">✗ Tidak'}</td></tr>
            <tr><td>Profit Split</td><td class="pfp-val">${rule.profitSplit}</td></tr>
          </table>

          <div class="pfp-checklist pfp-checklist--modal">
            <div class="pfp-chk">${check(checks.ddSafe)} Max DD sesi ${stats.maxDd.toFixed(1)}% &lt; batas ${rule.maxTotalDD}%</div>
            <div class="pfp-chk">${check(checks.posEv)} EV per trade: ${sc.expPnlPerTrade > 0 ? '+' : ''}${sc.expPnlPerTrade.toFixed(2)}%</div>
            <div class="pfp-chk">${check(checks.wrAboveBreakeven)} Win Rate ${stats.wr.toFixed(1)}% > break-even ${sc.breakEvenWR.toFixed(1)}%</div>
            <div class="pfp-chk">${check(checks.minTrades)} Trade ${stats.total}x ≥ min ${rule.minDays}</div>
          </div>

          <div class="pfp-insight">
            💡 ${checks.posEv
          ? `Butuh &plusmn;${sc.tradesNeeded === Infinity ? '&infin;' : sc.tradesNeeded} trade untuk capai target <strong>+${rule.p1Target}%</strong> Phase 1.`
          : '<strong>EV negatif</strong> — strategi tidak menguntungkan secara statistik. Perbaiki Win Rate atau R:R.'}
          </div>
        </div>`;
    };

    return `
      <div class="pfp-modal-overview">
        <div class="pfp-modal-ov-item">
          <div class="pfp-modal-ov-score" style="color:${SR.color}">${std.score}%</div>
          <div class="pfp-modal-ov-lbl">Standard</div>
        </div>
        <div class="pfp-modal-ov-sep"></div>
        <div class="pfp-modal-ov-item">
          <div class="pfp-modal-ov-score" style="color:${PR.color}">${pro.score}%</div>
          <div class="pfp-modal-ov-lbl">Pro</div>
        </div>
      </div>
      <div class="pfp-modal-cols">
        ${col(SR, std, std.checks)}
        ${col(PR, pro, pro.checks)}
      </div>
      <div class="pfp-disclaimer">⚠️ Skor dihitung dari statistik sesi (WR, R:R, DD) — bukan jaminan lolos. Kondisi nyata dipengaruhi banyak faktor.</div>`;
  },


  /** Dipanggil setiap kali halaman Sesi dibuka */
  render() {
    // Destroy existing radar charts to avoid memory leak
    Object.values(this.radarCharts).forEach(c => c.destroy());
    this.radarCharts = {};

    const sessions = Storage.getSessions();
    this.container.innerHTML = '';

    // Update toolbar badge count
    const badge = document.getElementById('sessions-count-badge');
    if (badge) badge.textContent = `${sessions.length} sesi tersimpan`;

    if (sessions.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state" style="margin-top: var(--space-2xl);">
          <div class="empty-state__icon">📂</div>
          <div class="empty-state__text">Belum ada sesi tersimpan.<br>Selesaikan sesi backtest untuk melihat statistiknya di sini.</div>
        </div>`;
      return;
    }

    // Grid wrapper
    const grid = document.createElement('div');
    grid.className = 'sessions-grid';
    this.container.appendChild(grid);

    sessions.forEach(session => {
      const stats = this.calcStats(session);
      const card = this.buildCard(session, stats);
      grid.appendChild(card);

      // Draw radar chart after card is in DOM
      requestAnimationFrame(() => {
        this.drawRadar(session.id, stats);
      });
    });
  },


  calcStats(session) {
    const trades = session.trades || [];
    const total = trades.length;
    const wins = trades.filter(t => t.type === 'tp').length;
    const losses = total - wins;
    const wr = total > 0 ? (wins / total) * 100 : 0;
    const pnl = session.currentBalance - session.initialBalance;
    const pnlPct = session.initialBalance > 0 ? (pnl / session.initialBalance) * 100 : 0;

    // Max consecutive win / lose
    let maxWin = 0, maxLose = 0, cw = 0, cl = 0;
    trades.forEach(t => {
      if (t.type === 'tp') { cw++; cl = 0; if (cw > maxWin) maxWin = cw; }
      else { cl++; cw = 0; if (cl > maxLose) maxLose = cl; }
    });

    // Max drawdown
    let peak = session.initialBalance, maxDd = 0;
    [session.initialBalance, ...trades.map(t => t.balanceAfter)].forEach(b => {
      if (b > peak) peak = b;
      const dd = ((peak - b) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    });

    // Avg P&L per trade (R multiple)
    const avgR = total > 0 ? trades.reduce((s, t) => s + (t.pnl / (t.riskAmount || 1)), 0) / total : 0;

    return { total, wins, losses, wr, pnl, pnlPct, maxWin, maxLose, maxDd, avgR };
  },

  // ======================================================
  // FUNDING PIPS PROP FIRM ANALYSIS
  // ======================================================

  /**
   * Aturan resmi Funding Pips 2-Step (per 2025)
   * Standard: P1 +8%, P2 +5%, DD harian 5%, DD total 10%, min 3 hari/phase
   * Pro:      P1 +6%, P2 +6%, DD harian 3%, DD total  6%, min 1 hari/phase, konsistensi 45%
   */
  PROP_RULES: {
    standard: {
      name: '2-Step Standard',
      color: '#6366f1',
      glow: 'rgba(99,102,241,0.25)',
      p1Target: 8,   // %
      p2Target: 5,   // %
      maxDailyDD: 5, // %
      maxTotalDD: 10,// %
      minDays: 3,
      consistency: null,  // tidak ada
      leverage: '1:100',
      feeRefundable: true,
      profitSplit: '80%+',
    },
    pro: {
      name: '2-Step Pro',
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.25)',
      p1Target: 6,
      p2Target: 6,
      maxDailyDD: 3,
      maxTotalDD: 6,
      minDays: 1,
      consistency: 45, // max 45% profit dari 1 hari
      leverage: '1:50',
      feeRefundable: false,
      profitSplit: '80%+',
    },
  },

  /**
   * Hitung skor probabilitas lolos Phase 1 berdasarkan stats sesi.
   * Menggunakan Monte Carlo-style weighted scoring (0–100).
   *
   * Faktor:
   *  1. Win Rate  → kontrib 30%
   *  2. RR Ratio  → kontrib 20%
   *  3. Max DD vs batas → kontrib 25%
   *  4. Profit% trend → kontrib 15%
   *  5. Konsistensi (tidak ada 1 hari > 45% profit) → kontrib 10%
   */
  calcPropFirmScore(session, stats, ruleKey) {
    const rules = this.PROP_RULES[ruleKey];
    const rr = session.rr || 1;
    const risk = session.riskPct || 1;

    // ---- 1. Win Rate Score (0-30) ----
    // Break-even WR untuk RR = 1/(1+RR)
    // Seorang trader lulus jika WR > breakeven secara konsisten
    const breakEvenWR = 1 / (1 + rr) * 100;
    const wrMargin = stats.wr - breakEvenWR;
    // +15 per 10% margin di atas breakeven, max 30
    const wrScore = Math.min(30, Math.max(0, 15 + wrMargin * 1.5));

    // ---- 2. RR Score (0-20) ----
    // RR ≥ 1.5 sangat bagus; RR 1 = minimal; RR < 1 = merugi
    const rrScore = Math.min(20, Math.max(0, rr * 8));

    // ---- 3. Drawdown Safety Score (0-25) ----
    // Semakin jauh DD dari batas, semakin aman
    const ddLimit = rules.maxTotalDD;
    const ddRatio = stats.maxDd / ddLimit; // 0 = aman sempurna, 1 = tepat di batas, >1 = bust
    let ddScore;
    if (ddRatio >= 1) {
      ddScore = 0;  // Sudah bust, tidak bisa lulus
    } else if (ddRatio < 0.3) {
      ddScore = 25; // Sangat aman
    } else if (ddRatio < 0.6) {
      ddScore = 20;
    } else if (ddRatio < 0.8) {
      ddScore = 12;
    } else {
      ddScore = 5;  // Sangat dekat batas
    }

    // ---- 4. Profit Trend Score (0-15) ----
    // Seberapa realistis profit target bisa dicapai dengan risk/trade ini
    // Estimasi: untuk phase 1, perlu pnlPct ≥ target
    const p1Target = rules.p1Target;
    const profitPerWin = risk * rr;           // profit per winner (%)
    const profitPerLoss = -risk;              // loss per loser (%)
    const expPnlPerTrade = (stats.wr / 100) * profitPerWin + ((100 - stats.wr) / 100) * profitPerLoss;
    // Berapa trade untuk capai target (jika positif EV)
    const tradesNeeded = expPnlPerTrade > 0 ? Math.ceil(p1Target / expPnlPerTrade) : Infinity;
    let trendScore;
    if (expPnlPerTrade <= 0) {
      trendScore = 0;
    } else if (tradesNeeded <= 10) {
      trendScore = 15;
    } else if (tradesNeeded <= 20) {
      trendScore = 12;
    } else if (tradesNeeded <= 40) {
      trendScore = 8;
    } else {
      trendScore = 4;
    }

    // ---- 5. Consistency Score (0-10) ----
    // Hanya relevan untuk Pro (45% rule)
    // Untuk Standard, skor penuh jika tidak ada seri kalah > 5
    let consScore = 8;
    if (rules.consistency) {
      // Pro: cek tidak ada 1 trade consecutif > 45% total profit
      // (simplified: jika maxLose ≤ 3 = bagus)
      if (stats.maxLose <= 1) consScore = 10;
      else if (stats.maxLose <= 3) consScore = 7;
      else if (stats.maxLose <= 5) consScore = 4;
      else consScore = 1;
    } else {
      if (stats.maxLose <= 2) consScore = 10;
      else if (stats.maxLose <= 4) consScore = 8;
      else if (stats.maxLose <= 6) consScore = 5;
      else consScore = 2;
    }

    const raw = wrScore + rrScore + ddScore + trendScore + consScore;
    // Pastikan 0 jika DD sudah bust
    const total = stats.maxDd >= rules.maxTotalDD ? 0 : Math.round(Math.min(raw, 100));

    // Detil checklist
    const checks = {
      ddSafe: stats.maxDd < rules.maxTotalDD,
      ddDaily: true, // sulit dihitung tanpa data harian, asumsikan aman jika DD total < limit
      posEv: expPnlPerTrade > 0,
      wrAboveBreakeven: stats.wr > breakEvenWR,
      minTrades: stats.total >= rules.minDays,
    };

    return { score: total, wrScore, rrScore, ddScore, trendScore, consScore, checks, expPnlPerTrade, tradesNeeded, breakEvenWR };
  },

  /** Mini bar di session card \u2014 tampilkan ringkasan skor + btn Lihat Detail */
  buildPropFirmPanel(session, stats) {
    const std = this.calcPropFirmScore(session, stats, 'standard');
    const pro = this.calcPropFirmScore(session, stats, 'pro');
    const SR = this.PROP_RULES.standard;
    const PR = this.PROP_RULES.pro;

    const glabel = score => {
      if (score >= 80) return { label: 'Sangat Layak', cls: 'grade--tp' };
      if (score >= 60) return { label: 'Layak', cls: 'grade--accent' };
      if (score >= 40) return { label: 'Perlu Perbaikan', cls: 'grade--warn' };
      return { label: 'Tidak Layak', cls: 'grade--sl' };
    };
    const sg = glabel(std.score);
    const pg = glabel(pro.score);

    return `
      <div class="pfp-trigger-bar">
        <div class="pfp-trigger-bar__left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span class="pfp-trigger-label">Funding Pips</span>
          <div class="pfp-trigger-scores">
            <span class="pfp-tscore" style="color:${SR.color}">
              <span class="pfp-ttag" style="background:${SR.glow}">STD</span>${std.score}%
              <span class="pfp-grade pfp-grade--sm ${sg.cls}">${sg.label}</span>
            </span>
            <span class="pfp-tsep">&middot;</span>
            <span class="pfp-tscore" style="color:${PR.color}">
              <span class="pfp-ttag" style="background:${PR.glow}">PRO</span>${pro.score}%
              <span class="pfp-grade pfp-grade--sm ${pg.cls}">${pg.label}</span>
            </span>
          </div>
        </div>
        <button class="btn pfp-detail-btn ssc-btn-pfp" data-id="${session.id}" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Lihat Detail
        </button>
      </div>`;
  },


  buildCard(session, stats) {



  },


  buildCard(session, stats) {
    const card = document.createElement('div');
    card.className = 'session-stat-card';

    const isProfit = stats.pnl >= 0;
    const pnlColor = isProfit ? 'var(--clr-tp)' : 'var(--clr-sl)';
    const pnlSign = isProfit ? '+' : '';
    const pnlStr = pnlSign + '$' + Math.abs(stats.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pnlPctStr = pnlSign + stats.pnlPct.toFixed(2) + '%';
    const createdDate = new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    card.innerHTML = `
      <!-- Header -->
      <div class="ssc__header">
        <div>
          <div class="ssc__name">${this.esc(session.name)}</div>
          <div class="ssc__meta">
            <span>💱 ${session.pair}</span>
            <span>📋 ${this.esc(session.methodName)}</span>
            <span>📅 ${createdDate}</span>
          </div>
        </div>
        <div class="ssc__pnl" style="color:${pnlColor}">
          <div class="ssc__pnl-value">${pnlStr}</div>
          <div class="ssc__pnl-pct">${pnlPctStr}</div>
        </div>
      </div>

      <!-- Body: Stats + Radar -->
      <div class="ssc__body">

        <!-- Left: Circle stats + table -->
        <div class="ssc__left">
          <!-- Circle row -->
          <div class="ssc__circles">
            <div class="ssc__circle ssc__circle--accent">
              <div class="ssc__circle-value">${stats.total}</div>
              <div class="ssc__circle-label">Total Trade</div>
            </div>
            <div class="ssc__circle ssc__circle--tp">
              <div class="ssc__circle-value">${stats.wr.toFixed(1)}%</div>
              <div class="ssc__circle-label">Win Rate</div>
            </div>
            <div class="ssc__circle" style="border-color:var(--clr-warning)">
              <div class="ssc__circle-value">${stats.avgR > 0 ? '+' : ''}${stats.avgR.toFixed(2)}R</div>
              <div class="ssc__circle-label">Avg R</div>
            </div>
          </div>

          <!-- Data table -->
          <div class="ssc__table">
            <div class="ssc__row">
              <span class="ssc__row-label">Total Win</span>
              <span class="ssc__row-value" style="color:var(--clr-tp)">${stats.wins}</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Total Lose</span>
              <span class="ssc__row-value" style="color:var(--clr-sl)">${stats.losses}</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Win Beruntun Maks</span>
              <span class="ssc__row-value" style="color:var(--clr-tp)">${stats.maxWin}</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Lose Beruntun Maks</span>
              <span class="ssc__row-value" style="color:var(--clr-sl)">${stats.maxLose}</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Max Drawdown</span>
              <span class="ssc__row-value" style="color:var(--clr-sl)">${stats.maxDd.toFixed(2)}%</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Saldo Awal</span>
              <span class="ssc__row-value">$${session.initialBalance.toLocaleString('en-US')}</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Saldo Akhir</span>
              <span class="ssc__row-value" style="color:${pnlColor}">$${session.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">Risk / Trade</span>
              <span class="ssc__row-value">${session.riskPct}%</span>
            </div>
            <div class="ssc__row">
              <span class="ssc__row-label">R:R</span>
              <span class="ssc__row-value">1:${session.rr}</span>
            </div>
          </div>
        </div>

        <!-- Right: Radar chart -->
        <div class="ssc__right">
          <div class="ssc__radar-title">Profil Performa</div>
          <div class="ssc__radar-wrap">
            <canvas id="radar-${session.id}"></canvas>
          </div>
        </div>
      </div>

      ${this.buildPropFirmPanel(session, stats)}
      ${this.buildAIAnalysis(session, stats)}

      <!-- Footer: actions -->
      <div class="ssc__footer">
        <button class="btn btn--primary ssc-btn-continue" data-id="${session.id}">▶ Lanjutkan Backtest</button>
        <div class="ssc__footer-right">
          <button class="btn btn--icon ssc-btn-share" data-id="${session.id}" title="Bagikan hasil sesi" aria-label="Bagikan">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button class="btn btn--danger btn--sm ssc-btn-delete" data-id="${session.id}">🗑 Hapus Sesi</button>
        </div>
      </div>
    `;

    // Events
    card.querySelector('.ssc-btn-continue').addEventListener('click', () => {
      this.continueSession(session.id);
    });
    card.querySelector('.ssc-btn-delete').addEventListener('click', () => {
      this.deleteSession(session.id);
    });
    card.querySelector('.ssc-btn-pfp').addEventListener('click', () => {
      const fresh = Storage.getSessions().find(s => s.id === session.id) || session;
      this.showPropFirmModal(fresh, this.calcStats(fresh));
    });
    card.querySelector('.ssc-btn-share').addEventListener('click', () => {
      this.shareSession(card, session);
    });

    return card;
  },

  drawRadar(sessionId, stats) {
    const canvas = document.getElementById(`radar-${sessionId}`);
    if (!canvas) return;

    // Normalize values to 0–100 scale for radar
    const wrNorm = Math.min(stats.wr, 100);
    const rrNorm = Math.min(stats.avgR * 25, 100); // 4R = 100%
    const maxWinNorm = Math.min(stats.maxWin * 10, 100);
    const maxLoseNorm = Math.max(0, 100 - Math.min(stats.maxLose * 20, 100)); // inverse (less is better)
    const growthNorm = Math.min(Math.max(stats.pnlPct + 50, 0), 100); // center at 50

    const data = [wrNorm, rrNorm, maxWinNorm, maxLoseNorm, growthNorm];
    const labels = ['Win Rate', 'Avg R', 'Max Win Streak', 'Stability', 'Pertumbuhan'];

    const isProfit = stats.pnl >= 0;
    const lineColor = isProfit ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    const fillColor = isProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    const chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#0a0e17',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17,24,39,0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(148,163,184,0.2)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (item) => ` ${item.parsed.r.toFixed(1)}%`
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(148,163,184,0.1)' },
            angleLines: { color: 'rgba(148,163,184,0.15)' },
            ticks: {
              display: false,
              stepSize: 25,
            },
            pointLabels: {
              color: '#94a3b8',
              font: { size: 10, family: 'Inter', weight: '500' },
            }
          }
        },
        animation: { duration: 800, easing: 'easeInOutQuart' }
      }
    });

    this.radarCharts[sessionId] = chart;
  },

  continueSession(id) {
    const sessions = Storage.getSessions();
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    // Set as active and remove from saved
    Storage.setActiveSession(session);
    Storage.deleteSession(id);

    // Switch to backtest tab
    App.navigateTo('backtest');
    Backtest.session = session;
    Backtest.showExecutionPanel();
    App.showToast(`Sesi "${session.name}" dilanjutkan! ▶`, 'success');
  },

  deleteSession(id) {
    const session = Storage.getSessions().find(s => s.id === id);
    if (!confirm(`Hapus sesi "${session?.name}"?`)) return;
    Storage.deleteSession(id);
    this.render();
    App.showToast('Sesi dihapus.', 'error');
  },

  /** Capture card as PNG and download */
  async shareSession(card, session) {
    if (typeof html2canvas === 'undefined') {
      App.showToast('html2canvas belum tersedia. Coba reload halaman.', 'error');
      return;
    }

    const btn = card.querySelector('.ssc-btn-share');
    const footer = card.querySelector('.ssc__footer');

    // Give visual feedback
    btn.disabled = true;
    btn.style.opacity = '0.5';

    // Temporarily hide footer buttons for a clean screenshot
    footer.style.visibility = 'hidden';

    try {
      const canvas = await html2canvas(card, {
        backgroundColor: null,
        scale: 2,          // retina quality
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      // Restore footer visibility
      footer.style.visibility = '';

      // Trigger download
      const slug = (session.name || 'sesi').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.download = `backtest-${slug}-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      App.showToast('📸 Screenshot berhasil diunduh!', 'success');
    } catch (err) {
      footer.style.visibility = '';
      console.error('[shareSession]', err);
      App.showToast('Gagal mengambil screenshot.', 'error');
    } finally {
      btn.disabled = false;
      btn.style.opacity = '';
    }
  },

  // ======================================================
  // AI ANALISA JAM TRADING (Pro Only)
  // ======================================================

  calcTimeAnalysis(trades) {
    const hourMap = {}; // { hour: { total, wins, losses } }

    trades.forEach(t => {
      const timeParts = (t.time || '').split(':');
      if (timeParts.length < 2) return;
      const hour = parseInt(timeParts[0], 10);
      if (isNaN(hour)) return;

      if (!hourMap[hour]) hourMap[hour] = { total: 0, wins: 0, losses: 0 };
      hourMap[hour].total++;
      if (t.type === 'tp') hourMap[hour].wins++;
      else hourMap[hour].losses++;
    });

    // Convert to sorted array
    const hours = Object.entries(hourMap).map(([h, d]) => ({
      hour: parseInt(h),
      ...d,
      wr: d.total > 0 ? (d.wins / d.total) * 100 : 0
    })).sort((a, b) => a.hour - b.hour);

    // Best & worst (min 2 trades to qualify)
    const qualified = hours.filter(h => h.total >= 2);
    const best = qualified.length > 0
      ? qualified.reduce((a, b) => a.wr > b.wr ? a : b)
      : null;
    const worst = qualified.length > 0
      ? qualified.reduce((a, b) => a.wr < b.wr ? a : b)
      : null;

    return { hours, best, worst, totalHours: hours.length };
  },

  buildAIAnalysis(session, stats) {
    // Check if Pro plan
    const check = PlanLimits.check('aiAnalysis');

    if (!check.allowed) {
      return `
        <div class="ai-panel ai-panel--locked">
          <div class="ai-panel__header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>AI Analisa Jam Trading</span>
            <span class="ai-panel__pro-badge">PRO</span>
          </div>
          <div class="ai-panel__lock-msg">
            Upgrade ke <strong>Pro</strong> untuk melihat analisa jam trading yang efektif dan tidak efektif.
            <button class="btn btn--sm btn--primary" onclick="App.navigateTo('account')" style="margin-top:8px;">Upgrade ke Pro</button>
          </div>
        </div>`;
    }

    const trades = session.trades || [];
    if (trades.length < 3) {
      return `
        <div class="ai-panel">
          <div class="ai-panel__header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>AI Analisa Jam Trading</span>
          </div>
          <div class="ai-panel__empty">Minimal 3 trade diperlukan untuk analisa jam.</div>
        </div>`;
    }

    const analysis = this.calcTimeAnalysis(trades);

    if (analysis.totalHours === 0) {
      return `
        <div class="ai-panel">
          <div class="ai-panel__header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>AI Analisa Jam Trading</span>
          </div>
          <div class="ai-panel__empty">Data waktu tidak tersedia untuk analisa.</div>
        </div>`;
    }

    // Build vertical bar chart
    const maxTrades = Math.max(...analysis.hours.map(h => h.total), 1);
    const barsHtml = analysis.hours.map(h => {
      const winPct = (h.wins / maxTrades) * 100;
      const lossPct = (h.losses / maxTrades) * 100;
      const label = `${String(h.hour).padStart(2, '0')}`;
      const wrColor = h.wr >= 60 ? 'var(--clr-tp)' : h.wr >= 40 ? 'var(--clr-warning)' : 'var(--clr-sl)';
      return `
        <div class="ai-col" title="${label}:00 — WR ${h.wr.toFixed(0)}% (${h.wins}W/${h.losses}L, ${h.total}x)">
          <span class="ai-col-wr" style="color:${wrColor}">${h.wr.toFixed(0)}%</span>
          <div class="ai-col-track">
            <div class="ai-col-fill ai-col-fill--loss" style="height:${lossPct}%"></div>
            <div class="ai-col-fill ai-col-fill--win" style="height:${winPct}%"></div>
          </div>
          <span class="ai-col-label">${label}</span>
        </div>`;
    }).join('');

    // Insight text
    let insightHtml = '';
    if (analysis.best && analysis.worst && analysis.best.hour !== analysis.worst.hour) {
      insightHtml = `
        <div class="ai-insight">
          <div class="ai-insight__item ai-insight__item--good">
            <span class="ai-insight__icon">✅</span>
            <span>Jam paling efektif: <strong>${String(analysis.best.hour).padStart(2, '0')}:00</strong> — Win Rate ${analysis.best.wr.toFixed(0)}% (${analysis.best.wins}W/${analysis.best.losses}L dari ${analysis.best.total} trade)</span>
          </div>
          <div class="ai-insight__item ai-insight__item--bad">
            <span class="ai-insight__icon">⚠️</span>
            <span>Jam kurang efektif: <strong>${String(analysis.worst.hour).padStart(2, '0')}:00</strong> — Win Rate ${analysis.worst.wr.toFixed(0)}% (${analysis.worst.wins}W/${analysis.worst.losses}L dari ${analysis.worst.total} trade)</span>
          </div>
          <div class="ai-insight__conclusion">
            💡 Fokus trading di jam <strong>${String(analysis.best.hour).padStart(2, '0')}:00</strong> dan kurangi eksposur di jam <strong>${String(analysis.worst.hour).padStart(2, '0')}:00</strong> untuk meningkatkan performa.
          </div>
        </div>`;
    } else if (analysis.best) {
      insightHtml = `
        <div class="ai-insight">
          <div class="ai-insight__item ai-insight__item--good">
            <span class="ai-insight__icon">✅</span>
            <span>Jam paling efektif: <strong>${String(analysis.best.hour).padStart(2, '0')}:00</strong> — Win Rate ${analysis.best.wr.toFixed(0)}%</span>
          </div>
        </div>`;
    }

    return `
      <div class="ai-panel">
        <div class="ai-panel__header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>AI Analisa Jam Trading</span>
          <span class="ai-panel__pro-badge">PRO</span>
        </div>
        <div class="ai-bar-legend">
          <span class="ai-legend ai-legend--win">● TP</span>
          <span class="ai-legend ai-legend--loss">● SL</span>
        </div>
        <div class="ai-bar-chart">${barsHtml}</div>
        ${insightHtml}
      </div>`;
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
};
