/* ========================================
   CALCULATOR.JS – Trade Calculator Page Logic
   ======================================== */

const Calculator = {

    /* Pip values in USD per 1.0 lot */
    PIP_VALUES: {
        XAUUSD: 10.00,  // Gold: $10/pip per lot
        GBPUSD: 10.00,
        EURUSD: 10.00,
        AUDUSD: 10.00,
        NZDUSD: 10.00,
        USDCAD: 7.69,  // approx
        USDCHF: 10.00,  // approx
        USDJPY: 9.09,  // approx at 110 USD/JPY
        GBPJPY: 9.09,
        EURJPY: 9.09,
        BTCUSD: 1.00,  // treat 1 pip = $1 for simplicity
        ETHUSD: 1.00,
        US30: 1.00,
        NAS100: 1.00,
    },

    /* Minimum lot step */
    MIN_LOT: 0.01,

    init() {
        this.cacheDOM();
        this.setDefaultTime();
        this.populateMethods();
        this.bindEvents();
        this.calculate();
    },

    cacheDOM() {
        this.balanceInput = document.getElementById('calc-balance');
        this.riskInput = document.getElementById('calc-risk');
        this.timeInput = document.getElementById('calc-time');
        this.pairSelect = document.getElementById('calc-pair');
        this.slInput = document.getElementById('calc-sl-pips');
        this.tpInput = document.getElementById('calc-tp-pips');
        this.methodSelect = document.getElementById('calc-method');

        this.outLot = document.getElementById('calc-out-lot');
        this.outLoss = document.getElementById('calc-out-loss');
        this.outProfit = document.getElementById('calc-out-profit');
        this.outLotSub = document.getElementById('calc-out-lot-sub');

        this.continueBtn = document.getElementById('calc-continue-btn');

        // Popup
        this.popupOverlay = document.getElementById('calc-popup-overlay');
        this.popupClose = document.getElementById('calc-popup-close');
        this.popupEntryList = document.getElementById('calc-popup-entry-list');
        this.popupExitList = document.getElementById('calc-popup-exit-list');
        this.popupNotes = document.getElementById('calc-popup-notes');
        this.saveJournalBtn = document.getElementById('calc-save-journal-btn');
        this.emotionBtns = document.querySelectorAll('.emotion-btn');
        this.popupSummary = document.getElementById('calc-popup-summary');
    },

    setDefaultTime() {
        if (!this.timeInput) return;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        this.timeInput.value = `${hh}:${mm}`;
    },

    populateMethods() {
        if (!this.methodSelect) return;
        const methods = Storage.getMethods();
        // Keep placeholder option
        this.methodSelect.innerHTML = '<option value="">— Pilih Strategi —</option>';
        methods.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            this.methodSelect.appendChild(opt);
        });
    },

    bindEvents() {
        // Live calculate on any input change
        const inputs = [
            this.balanceInput, this.riskInput, this.pairSelect,
            this.slInput, this.tpInput,
        ];
        inputs.forEach(el => {
            if (el) el.addEventListener('input', () => this.calculate());
        });

        // Continue button
        if (this.continueBtn) {
            this.continueBtn.addEventListener('click', () => this.openPopup());
        }

        // Popup close
        if (this.popupClose) {
            this.popupClose.addEventListener('click', () => this.closePopup());
        }
        if (this.popupOverlay) {
            this.popupOverlay.addEventListener('click', (e) => {
                if (e.target === this.popupOverlay) this.closePopup();
            });
        }

        // Emotion buttons
        this.emotionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.emotionBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Save to journal
        if (this.saveJournalBtn) {
            this.saveJournalBtn.addEventListener('click', () => this.saveToJournal());
        }
    },

    getValues() {
        const balance = parseFloat(this.balanceInput?.value) || 0;
        const risk = parseFloat(this.riskInput?.value) || 1;
        const slPips = parseFloat(this.slInput?.value) || 0;
        const tpPips = parseFloat(this.tpInput?.value) || 0;
        const pair = this.pairSelect?.value || 'XAUUSD';
        return { balance, risk, slPips, tpPips, pair };
    },

    calculate() {
        const { balance, risk, slPips, tpPips, pair } = this.getValues();
        const riskAmount = balance * (risk / 100);
        const pipValue = this.PIP_VALUES[pair] || 10;

        let lotSize = 0;
        let potentialLoss = 0;
        let potentialProfit = 0;

        if (slPips > 0) {
            lotSize = riskAmount / (slPips * pipValue);
            lotSize = Math.floor(lotSize / this.MIN_LOT) * this.MIN_LOT;
            lotSize = Math.max(lotSize, 0);
            potentialLoss = -(lotSize * slPips * pipValue);
        }

        if (tpPips > 0 && lotSize > 0) {
            potentialProfit = lotSize * tpPips * pipValue;
        }

        // Update UI
        if (this.outLot) {
            this.outLot.textContent = lotSize > 0 ? lotSize.toFixed(2) : '—';
            if (this.outLotSub) {
                const rr = slPips > 0 && tpPips > 0 ? (tpPips / slPips).toFixed(2) : '—';
                this.outLotSub.textContent = `R:R = 1:${rr}`;
            }
        }
        if (this.outLoss) {
            this.outLoss.textContent = potentialLoss !== 0
                ? `$${potentialLoss.toFixed(2)}`
                : '—';
        }
        if (this.outProfit) {
            this.outProfit.textContent = potentialProfit > 0
                ? `+$${potentialProfit.toFixed(2)}`
                : '—';
        }

        // Store for later use
        this._calc = { balance, risk, slPips, tpPips, pair, lotSize, potentialLoss, potentialProfit };
    },

    openPopup() {
        if (!this.popupOverlay) return;

        const methodId = this.methodSelect?.value;
        const methods = Storage.getMethods();
        const method = methods.find(m => m.id === methodId) || null;

        // Render SOP checklists
        this._renderSopList(this.popupEntryList, method?.sopEntry, 'Entry');
        this._renderSopList(this.popupExitList, method?.sopExit, 'Exit');

        // Summary chips
        if (this.popupSummary && this._calc) {
            const c = this._calc;
            const pair = this.pairSelect?.value || '';
            const time = this.timeInput?.value || '—';
            const lot = c.lotSize > 0 ? c.lotSize.toFixed(2) : '—';
            this.popupSummary.innerHTML = `
        <div class="trade-chip"><strong>${pair}</strong></div>
        <div class="trade-chip">🕐 ${time}</div>
        <div class="trade-chip">📦 Lot: <strong>${lot}</strong></div>
        <div class="trade-chip">🎯 TP: <strong>${c.tpPips} pips</strong></div>
        <div class="trade-chip">🛑 SL: <strong>${c.slPips} pips</strong></div>
        <div class="trade-chip" style="color:var(--clr-sl);">Loss: <strong>${c.potentialLoss !== 0 ? '$' + c.potentialLoss.toFixed(2) : '—'}</strong></div>
        <div class="trade-chip" style="color:var(--clr-tp);">Profit: <strong>${c.potentialProfit > 0 ? '+$' + c.potentialProfit.toFixed(2) : '—'}</strong></div>
      `;
        }

        // Reset emotion
        this.emotionBtns.forEach(b => b.classList.remove('selected'));
        if (this.popupNotes) this.popupNotes.value = '';

        this.popupOverlay.classList.add('active');
    },

    closePopup() {
        if (this.popupOverlay) this.popupOverlay.classList.remove('active');
    },

    _renderSopList(container, sopText, label) {
        if (!container) return;
        if (!sopText || !sopText.trim()) {
            container.innerHTML = `<span class="sop-empty">Tidak ada SOP ${label} tersedia.</span>`;
            return;
        }
        const lines = sopText.split('\n').map(l => l.trim()).filter(Boolean);
        container.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'sop-checklist';
        lines.forEach((line, idx) => {
            const li = document.createElement('li');
            li.className = 'sop-checklist__item';
            const cbId = `sop-${label.toLowerCase()}-${idx}`;
            li.innerHTML = `
        <input type="checkbox" id="${cbId}">
        <label for="${cbId}" class="sop-checklist__text">${this._escHtml(line)}</label>
      `;
            const cb = li.querySelector('input');
            cb.addEventListener('change', () => {
                li.classList.toggle('checked', cb.checked);
            });
            ul.appendChild(li);
        });
        container.appendChild(ul);
    },

    saveToJournal() {
        if (!this._calc) return;

        const c = this._calc;
        const pair = this.pairSelect?.value || 'Unknown';
        const time = this.timeInput?.value || '—';
        const methodId = this.methodSelect?.value || '';
        const methods = Storage.getMethods();
        const method = methods.find(m => m.id === methodId) || null;
        const methodName = method ? method.name : 'Tanpa Strategi';

        // Collect emotion
        let emotion = '—';
        this.emotionBtns.forEach(b => {
            if (b.classList.contains('selected')) emotion = b.textContent.trim();
        });

        // Collect SOP checked items
        const getSopChecked = (container) => {
            if (!container) return [];
            return [...container.querySelectorAll('input[type="checkbox"]:checked')]
                .map(cb => cb.nextElementSibling?.textContent?.trim() || '');
        };

        const entry = {
            id: Storage.generateId(),
            pair,
            methodName,
            methodId,
            openTime: time,
            closeTime: null,
            balance: c.balance,
            risk: c.risk,
            lotSize: parseFloat(c.lotSize.toFixed(2)),
            slPips: c.slPips,
            tpPips: c.tpPips,
            potentialLoss: parseFloat(c.potentialLoss.toFixed(2)),
            potentialProfit: parseFloat(c.potentialProfit.toFixed(2)),
            emotion,
            notes: this.popupNotes?.value?.trim() || '',
            sopEntryChecked: getSopChecked(this.popupEntryList),
            sopExitChecked: getSopChecked(this.popupExitList),
            status: 'open',   // 'open' | 'tp' | 'sl'
            createdAt: new Date().toISOString(),
        };

        // Check plan limit
        const limitCheck = PlanLimits.check('journal');
        if (!limitCheck.allowed) {
            App.showToast(limitCheck.message, 'error');
            return;
        }

        Storage.saveJournalEntry(entry);
        this.closePopup();
        App.showToast('✅ Trade disimpan ke Jurnal!', 'success');

        // Navigate to journal
        App.navigateTo('journal');
    },

    _escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },

    /* Called by app.js when navigating to calculator page */
    refresh() {
        this.populateMethods();
    },
};
