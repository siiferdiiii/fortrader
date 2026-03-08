/* ========================================
   BACKTEST.JS - Session Management & Trade Execution
   ======================================== */

const Backtest = {
    session: null, // Active session object

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.populateMethodDropdown();
        this.renderSavedSessions();

        // Restore active session if exists
        const active = Storage.getActiveSession();
        if (active) {
            this.session = active;
            this.showExecutionPanel();
        }
    },

    cacheDOM() {
        // Config
        this.configSection = document.getElementById('session-config');
        this.executionPanel = document.getElementById('execution-panel');
        this.sessionForm = document.getElementById('session-form');
        this.sessionName = document.getElementById('session-name');
        this.sessionPair = document.getElementById('session-pair');
        this.sessionMethod = document.getElementById('session-method');
        this.sessionBalance = document.getElementById('session-balance');
        this.sessionRisk = document.getElementById('session-risk');
        this.sessionRR = document.getElementById('session-rr');

        // Execution
        this.barName = document.getElementById('bar-session-name');
        this.barPair = document.getElementById('bar-session-pair');
        this.barMethod = document.getElementById('bar-session-method');
        this.btnEndSession = document.getElementById('btn-end-session');
        this.btnBackConfig = document.getElementById('btn-back-config');
        this.currentBalanceEl = document.getElementById('current-balance');
        this.balanceChangeEl = document.getElementById('balance-change');
        this.infoRiskAmount = document.getElementById('info-risk-amount');
        this.infoTpAmount = document.getElementById('info-tp-amount');
        this.infoSlAmount = document.getElementById('info-sl-amount');

        // Clock widget elements
        this.tradeTimeInput = document.getElementById('trade-time');       // hidden native input
        this.clockHour = document.getElementById('clock-hour');
        this.clockMin = document.getElementById('clock-min');
        this.clockScrollArea = document.getElementById('clock-scroll-area');
        this.clockUp = document.getElementById('clock-up');
        this.clockDown = document.getElementById('clock-down');
        this.clockDisplay = document.querySelector('.clock-widget__display');

        // Fixed bottom bar & TP/SL buttons
        this.fixedActionBar = document.getElementById('fixed-action-bar');
        this.btnTP = document.getElementById('btn-tp');
        this.btnSL = document.getElementById('btn-sl');

        // Analytics
        this.statWinrate = document.getElementById('stat-winrate');
        this.statTotal = document.getElementById('stat-total');
        this.statMaxWin = document.getElementById('stat-max-win');
        this.statMaxLose = document.getElementById('stat-max-lose');
        this.statPnl = document.getElementById('stat-pnl');
        this.statPnlPct = document.getElementById('stat-pnl-pct');
        this.statMaxDd = document.getElementById('stat-max-dd');
        this.logCount = document.getElementById('log-count');
        this.tradeLog = document.getElementById('trade-log');
        this.savedSessionsList = document.getElementById('saved-sessions-list');
    },

    bindEvents() {
        this.sessionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.startSession();
        });

        this.btnTP.addEventListener('click', () => this.executeTrade('tp'));
        this.btnSL.addEventListener('click', () => this.executeTrade('sl'));

        this.btnEndSession.addEventListener('click', () => this.endSession());
        this.btnBackConfig.addEventListener('click', () => this.backToConfig());

        // ---- Clock Widget interactions ----

        // Arrow up: +1 hour
        this.clockUp.addEventListener('click', () => this.adjustHour(+1, 'up'));

        // Arrow down: -1 hour
        this.clockDown.addEventListener('click', () => this.adjustHour(-1, 'down'));

        // Mouse wheel scroll on clock area (scroll up = +1, scroll down = -1)
        this.clockScrollArea.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.adjustHour(+1, 'up');    // Scroll up → +1 jam
            } else {
                this.adjustHour(-1, 'down');  // Scroll down → -1 jam
            }
        }, { passive: false });

        // Touch swipe on clock display (swipe up → +1, swipe down → -1)
        let touchStartY = 0;
        this.clockScrollArea.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        this.clockScrollArea.addEventListener('touchend', (e) => {
            const diff = touchStartY - e.changedTouches[0].clientY;
            if (Math.abs(diff) > 10) {
                this.adjustHour(diff > 0 ? +1 : -1, diff > 0 ? 'up' : 'down');
            }
        }, { passive: true });

        // Click on display → open native time picker for manual edit
        this.clockDisplay.addEventListener('click', () => {
            this.tradeTimeInput.style.position = 'fixed';
            this.tradeTimeInput.style.opacity = '0';
            this.tradeTimeInput.style.pointerEvents = 'all';
            this.tradeTimeInput.style.width = '1px';
            this.tradeTimeInput.style.height = '1px';
            this.tradeTimeInput.style.top = '50%';
            this.tradeTimeInput.style.left = '50%';
            this.tradeTimeInput.showPicker ? this.tradeTimeInput.showPicker() : this.tradeTimeInput.click();
        });

        // When native picker changes, sync clock display
        this.tradeTimeInput.addEventListener('change', () => {
            const val = this.tradeTimeInput.value;
            if (val) {
                const [hh, mm] = val.split(':');
                this.setClockDisplay(parseInt(hh, 10), parseInt(mm, 10), null);
            }
        });
    },

    populateMethodDropdown() {
        const methods = Storage.getMethods();
        this.sessionMethod.innerHTML = '<option value="">— Pilih Metode —</option>';
        methods.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            this.sessionMethod.appendChild(opt);
        });
    },

    // ====== SESSION LIFECYCLE ======

    startSession() {
        // Check plan limit
        const limitCheck = PlanLimits.check('session');
        if (!limitCheck.allowed) {
            App.showToast(limitCheck.message, 'error');
            return;
        }

        const name = this.sessionName.value.trim();
        const pair = this.sessionPair.value;
        const methodId = this.sessionMethod.value;
        const balance = parseFloat(this.sessionBalance.value) || 10000;
        const riskPct = parseFloat(this.sessionRisk.value) || 1;
        const rr = parseFloat(this.sessionRR.value) || 2;

        if (!name) {
            App.showToast('Silakan isi nama sesi!', 'error');
            return;
        }

        const methodObj = Storage.getMethods().find(m => m.id === methodId);

        this.session = {
            id: Storage.generateId(),
            name,
            pair,
            methodId,
            methodName: methodObj ? methodObj.name : 'Tidak dipilih',
            initialBalance: balance,
            currentBalance: balance,
            riskPct,
            rr,
            trades: [],
            createdAt: new Date().toISOString(),
        };

        Storage.setActiveSession(this.session);
        this.showExecutionPanel();
        App.showToast(`Sesi "${name}" dimulai! 🚀`, 'success');
    },

    showExecutionPanel() {
        this.configSection.style.display = 'none';
        this.executionPanel.classList.add('active');
        // Show fixed TP/SL bar
        this.fixedActionBar.style.display = 'grid';

        // Update UI
        this.barName.textContent = this.session.name;
        this.barPair.textContent = this.session.pair;
        this.barMethod.textContent = this.session.methodName;

        this.updateBalanceDisplay();
        this.updateRiskInfo();
        this.updateStats();
        this.renderTradeLog();

        // Init chart
        Charts.reset(this.session.initialBalance);
        if (this.session.trades.length > 0) {
            Charts.updateEquityChart(this.session.initialBalance, this.session.trades);
        }

        // Set clock to current time
        const now = new Date();
        this.setClockDisplay(now.getHours(), now.getMinutes(), null);
    },

    backToConfig() {
        this.executionPanel.classList.remove('active');
        this.configSection.style.display = 'block';
        // Hide fixed TP/SL bar
        this.fixedActionBar.style.display = 'none';
    },

    endSession() {
        if (!this.session) return;
        if (!confirm('Akhiri dan simpan sesi ini?')) return;

        // Save session permanently
        Storage.saveSession(this.session);
        Storage.clearActiveSession();

        const savedName = this.session.name;
        App.showToast(`Sesi "${savedName}" disimpan! 💾`, 'success');
        this.session = null;
        this.executionPanel.classList.remove('active');
        this.configSection.style.display = 'block';
        // Hide fixed TP/SL bar
        this.fixedActionBar.style.display = 'none';
        this.renderSavedSessions();

        // Navigasi ke halaman Sesi untuk lihat hasil
        setTimeout(() => App.navigateTo('sessions'), 500);
    },

    // ====== TRADE EXECUTION ======

    executeTrade(type) {
        if (!this.session) return;

        const balance = this.session.currentBalance;
        const riskPct = this.session.riskPct;
        const rr = this.session.rr;
        const riskAmount = balance * (riskPct / 100);
        const time = this.tradeTimeInput.value || '--:--';

        let pnl;
        if (type === 'tp') {
            pnl = riskAmount * rr;
        } else {
            pnl = -riskAmount;
        }

        const newBalance = balance + pnl;

        const trade = {
            id: Storage.generateId(),
            type, // 'tp' or 'sl'
            time,
            riskAmount: riskAmount,
            pnl: pnl,
            balanceBefore: balance,
            balanceAfter: newBalance,
            timestamp: new Date().toISOString(),
        };

        this.session.trades.push(trade);
        this.session.currentBalance = newBalance;

        // Save to localStorage
        Storage.setActiveSession(this.session);

        // UI Updates
        this.updateBalanceDisplay(pnl);
        this.updateRiskInfo();
        this.updateStats();
        this.renderTradeLog();
        Charts.updateEquityChart(this.session.initialBalance, this.session.trades);

        // Auto advance clock +1 hour after each trade
        this.adjustHour(+1, 'up');

        // Visual feedback
        this.flashButton(type);
    },

    flashButton(type) {
        const btn = type === 'tp' ? this.btnTP : this.btnSL;
        btn.style.transform = 'scale(0.93)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    },

    // ====== CLOCK WIDGET LOGIC ======

    /**
     * Parse current clock value → { h, m }
     * Falls back to current time if display shows '--'
     */
    _getClockTime() {
        const val = this.tradeTimeInput.value;
        if (val && val !== '--:--') {
            const [hh, mm] = val.split(':');
            return { h: parseInt(hh, 10), m: parseInt(mm, 10) };
        }
        // Fallback: current time
        const now = new Date();
        return { h: now.getHours(), m: now.getMinutes() };
    },

    /**
     * Adjust hour by delta (+1 / -1) with infinity loop 00-23
     * @param {number} delta  +1 or -1
     * @param {'up'|'down'} dir  for animation direction
     */
    adjustHour(delta, dir) {
        let { h, m } = this._getClockTime();
        h = ((h + delta) % 24 + 24) % 24;   // loop 0-23
        this.setClockDisplay(h, m, dir);
    },

    /**
     * Set clock display and sync hidden native input
     * @param {number} h   hour (0-23)
     * @param {number} m   minute (0-59)
     * @param {'up'|'down'|null} animDir  animation direction (null = no anim)
     */
    setClockDisplay(h, m, animDir) {
        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');

        // Animate hour digits
        if (animDir && this.clockHour) {
            const cls = `animate-${animDir}`;
            this.clockHour.classList.remove('animate-up', 'animate-down');
            // Force reflow to restart animation
            void this.clockHour.offsetWidth;
            this.clockHour.classList.add(cls);
            setTimeout(() => this.clockHour.classList.remove(cls), 300);
        }

        if (this.clockHour) this.clockHour.textContent = hStr;
        if (this.clockMin) this.clockMin.textContent = mStr;

        // Sync native hidden input (used as source of truth for trade time)
        this.tradeTimeInput.value = `${hStr}:${mStr}`;
    },


    // ====== UI UPDATERS ======

    updateBalanceDisplay(lastPnl = null) {
        if (!this.session) return;
        const bal = this.session.currentBalance;
        this.currentBalanceEl.textContent = '$' + bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (lastPnl !== null) {
            const isPositive = lastPnl >= 0;
            this.balanceChangeEl.textContent = (isPositive ? '+' : '') + '$' + lastPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            this.balanceChangeEl.className = 'balance-display__change ' + (isPositive ? 'balance-display__change--positive' : 'balance-display__change--negative');
        } else {
            const totalPnl = bal - this.session.initialBalance;
            if (totalPnl !== 0) {
                const isPositive = totalPnl >= 0;
                this.balanceChangeEl.textContent = (isPositive ? '+' : '') + '$' + totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                this.balanceChangeEl.className = 'balance-display__change ' + (isPositive ? 'balance-display__change--positive' : 'balance-display__change--negative');
            } else {
                this.balanceChangeEl.textContent = '';
            }
        }
    },

    updateRiskInfo() {
        if (!this.session) return;
        const bal = this.session.currentBalance;
        const riskAmount = bal * (this.session.riskPct / 100);
        const tpAmount = riskAmount * this.session.rr;

        this.infoRiskAmount.textContent = '$' + riskAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.infoTpAmount.textContent = '+$' + tpAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.infoSlAmount.textContent = '-$' + riskAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    updateStats() {
        if (!this.session) return;
        const trades = this.session.trades;
        const total = trades.length;
        const wins = trades.filter(t => t.type === 'tp').length;
        const losses = total - wins;
        const winrate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;

        // Max consecutive wins / losses
        let maxWinStreak = 0, maxLoseStreak = 0;
        let currentWinStreak = 0, currentLoseStreak = 0;
        trades.forEach(t => {
            if (t.type === 'tp') {
                currentWinStreak++;
                currentLoseStreak = 0;
                if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
            } else {
                currentLoseStreak++;
                currentWinStreak = 0;
                if (currentLoseStreak > maxLoseStreak) maxLoseStreak = currentLoseStreak;
            }
        });

        // P&L
        const pnl = this.session.currentBalance - this.session.initialBalance;
        const pnlPct = ((pnl / this.session.initialBalance) * 100).toFixed(2);

        // Max Drawdown
        let peak = this.session.initialBalance;
        let maxDd = 0;
        let balances = [this.session.initialBalance];
        trades.forEach(t => balances.push(t.balanceAfter));
        balances.forEach(b => {
            if (b > peak) peak = b;
            const dd = ((peak - b) / peak) * 100;
            if (dd > maxDd) maxDd = dd;
        });

        // Update DOM
        this.statWinrate.textContent = winrate + '%';
        this.statTotal.textContent = total;
        this.statMaxWin.textContent = maxWinStreak;
        this.statMaxLose.textContent = maxLoseStreak;

        const pnlFormatted = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.statPnl.textContent = pnlFormatted;
        this.statPnl.style.color = pnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';
        this.statPnlPct.textContent = (pnl >= 0 ? '+' : '') + pnlPct + '%';

        this.statMaxDd.textContent = maxDd.toFixed(2) + '%';
        this.logCount.textContent = total + ' trade';
    },

    renderTradeLog() {
        if (!this.session) return;
        const trades = this.session.trades;

        if (trades.length === 0) {
            this.tradeLog.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📊</div>
          <div class="empty-state__text">Belum ada trade. Klik TP atau SL untuk memulai.</div>
        </div>
      `;
            return;
        }

        this.tradeLog.innerHTML = '';
        // Show newest first (reversed for display, but keep original index for operations)
        const totalTrades = trades.length;
        [...trades].reverse().forEach((trade, reversedIdx) => {
            const originalIndex = totalTrades - 1 - reversedIdx;
            const div = document.createElement('div');
            div.className = `trade-log__item trade-log__item--${trade.type}`;
            div.dataset.tradeId = trade.id;

            const pnlStr = trade.pnl >= 0
                ? `+$${trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `-$${Math.abs(trade.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const pnlColor = trade.type === 'tp' ? 'var(--clr-tp)' : 'var(--clr-sl)';

            div.innerHTML = `
        <div style="display:flex; align-items:center; gap:var(--space-sm); flex:1; min-width:0;">
          <span class="badge badge--${trade.type}">${trade.type === 'tp' ? '✅ TP' : '❌ SL'}</span>
          <input class="trade-log__time-input" type="time" value="${trade.time !== '--:--' ? trade.time : ''}"
            style="background:transparent; border:none; border-bottom:1px dashed var(--clr-border);
                   color:var(--clr-text-muted); font-size:var(--fs-xs); font-family:var(--font-family);
                   cursor:pointer; padding:2px 4px; border-radius:0; width:80px;"
            title="Klik untuk edit jam">
        </div>
        <div style="display:flex; align-items:center; gap:var(--space-sm);">
          <span class="trade-log__item-result" style="color:${pnlColor}">${pnlStr}</span>
          <span style="color:var(--clr-text-muted); font-size:var(--fs-xs);">
            → $${trade.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button class="btn btn--secondary btn--sm btn-delete-trade"
            title="Hapus trade ini"
            style="padding:2px 6px; font-size:10px; border-radius:4px; line-height:1;">🗑</button>
        </div>
      `;

            // Edit time: blur event saves new time
            const timeInput = div.querySelector('.trade-log__time-input');
            timeInput.addEventListener('change', () => {
                const newTime = timeInput.value || '--:--';
                this.session.trades[originalIndex].time = newTime;
                Storage.setActiveSession(this.session);
                App.showToast('Jam diperbarui ✅', 'success');
                // Re-render log (no calc change needed – time is just metadata)
                this.renderTradeLog();
            });

            // Delete trade
            div.querySelector('.btn-delete-trade').addEventListener('click', () => {
                this.deleteTrade(originalIndex);
            });

            this.tradeLog.appendChild(div);
        });
    },

    /**
     * Hapus trade dan recalculate semua saldo setelahnya
     */
    deleteTrade(index) {
        if (!confirm('Hapus trade ini dari sesi?')) return;
        const trades = this.session.trades;

        // Remove the trade
        trades.splice(index, 1);

        // Recalculate all balances from scratch
        let runningBalance = this.session.initialBalance;
        trades.forEach(t => {
            const riskAmount = runningBalance * (this.session.riskPct / 100);
            const pnl = t.type === 'tp' ? riskAmount * this.session.rr : -riskAmount;
            t.riskAmount = riskAmount;
            t.pnl = pnl;
            t.balanceBefore = runningBalance;
            runningBalance += pnl;
            t.balanceAfter = runningBalance;
        });
        this.session.currentBalance = runningBalance;

        Storage.setActiveSession(this.session);
        this.updateBalanceDisplay();
        this.updateRiskInfo();
        this.updateStats();
        this.renderTradeLog();
        Charts.updateEquityChart(this.session.initialBalance, this.session.trades);
        App.showToast('Trade dihapus & saldo diperbarui 🗑', 'error');
    },

    // ====== SAVED SESSIONS ======

    renderSavedSessions() {
        const sessions = Storage.getSessions();
        if (sessions.length === 0) {
            this.savedSessionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📂</div>
          <div class="empty-state__text">Belum ada sesi tersimpan.</div>
        </div>
      `;
            return;
        }

        this.savedSessionsList.innerHTML = '';
        sessions.forEach(session => {
            const totalTrades = session.trades.length;
            const wins = session.trades.filter(t => t.type === 'tp').length;
            const winrate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
            const pnl = session.currentBalance - session.initialBalance;
            const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 });
            const pnlColor = pnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';

            const div = document.createElement('div');
            div.className = 'method-card';
            div.style.marginBottom = 'var(--space-md)';
            div.innerHTML = `
        <div class="method-card__name">
          📊 ${this.escapeHtml(session.name)}
          <span class="badge badge--${pnl >= 0 ? 'tp' : 'sl'}">${pnlStr}</span>
        </div>
        <div style="display:flex; gap:var(--space-lg); flex-wrap:wrap; font-size:var(--fs-sm); color:var(--clr-text-secondary); margin-bottom:var(--space-sm);">
          <span>💱 ${session.pair}</span>
          <span>📋 ${this.escapeHtml(session.methodName)}</span>
          <span>📈 ${totalTrades} trade</span>
          <span>🎯 WR: ${winrate}%</span>
        </div>
        <div class="method-card__actions">
          <button class="btn btn--primary btn--sm btn-resume-session" data-id="${session.id}">▶ Lanjutkan</button>
          <button class="btn btn--danger btn--sm btn-delete-session" data-id="${session.id}">🗑 Hapus</button>
        </div>
      `;

            div.querySelector('.btn-resume-session').addEventListener('click', () => {
                this.resumeSession(session.id);
            });
            div.querySelector('.btn-delete-session').addEventListener('click', () => {
                this.deleteSavedSession(session.id);
            });

            this.savedSessionsList.appendChild(div);
        });
    },

    resumeSession(id) {
        const sessions = Storage.getSessions();
        const session = sessions.find(s => s.id === id);
        if (!session) return;

        this.session = session;
        Storage.setActiveSession(this.session);
        // Remove from saved (it's now active)
        Storage.deleteSession(id);
        this.renderSavedSessions();
        this.showExecutionPanel();
        App.showToast(`Sesi "${session.name}" dilanjutkan! ▶`, 'success');
    },

    deleteSavedSession(id) {
        if (!confirm('Yakin ingin menghapus sesi ini?')) return;
        Storage.deleteSession(id);
        this.renderSavedSessions();
        App.showToast('Sesi dihapus.', 'error');
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
