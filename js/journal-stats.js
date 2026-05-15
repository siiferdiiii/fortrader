/* ========================================
   JOURNAL-STATS.JS — Analisis Statistik Jurnal
   Filter: periode, pair, metode, emosi
   Charts: Win Rate, P&L, Streak, Distribusi
   ======================================== */

const JournalStats = {

    _charts: {},
    _currentFilter: {
        period: 'all',   // 'today' | '7d' | '30d' | '90d' | 'year' | 'all'
        pair:   'all',
        method: 'all',
        emotion:'all',
    },

    /* ─── Init ───────────────────────────── */
    async init() {
        this._cacheDOM();
        this._bindFilterEvents();
        await this.render();
    },

    _cacheDOM() {
        this.container      = document.getElementById('journal-stats-container');
        this.filterPeriod   = document.getElementById('stat-filter-period');
        this.filterPair     = document.getElementById('stat-filter-pair');
        this.filterMethod   = document.getElementById('stat-filter-method');
        this.filterEmotion  = document.getElementById('stat-filter-emotion');
        this.btnApply       = document.getElementById('stat-filter-apply');
    },

    _bindFilterEvents() {
        if (this.btnApply) {
            this.btnApply.addEventListener('click', () => {
                this._currentFilter = {
                    period:  this.filterPeriod?.value  || 'all',
                    pair:    this.filterPair?.value    || 'all',
                    method:  this.filterMethod?.value  || 'all',
                    emotion: this.filterEmotion?.value || 'all',
                };
                this.render();
            });
        }
        // Auto-populate dropdowns
        ['stat-filter-pair', 'stat-filter-method', 'stat-filter-emotion'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => {
                this._currentFilter[id.replace('stat-filter-', '')] = el.value;
                this.render();
            });
        });
        if (this.filterPeriod) {
            this.filterPeriod.addEventListener('change', () => {
                this._currentFilter.period = this.filterPeriod.value;
                this.render();
            });
        }
    },

    /* ─── Apply Filters ──────────────────── */
    _applyFilters(entries) {
        let filtered = [...entries];
        const f = this._currentFilter;

        // Period filter
        if (f.period !== 'all') {
            const now   = new Date();
            const cutoff = new Date();
            if (f.period === 'today') cutoff.setHours(0, 0, 0, 0);
            if (f.period === '7d')    cutoff.setDate(now.getDate() - 7);
            if (f.period === '30d')   cutoff.setDate(now.getDate() - 30);
            if (f.period === '90d')   cutoff.setDate(now.getDate() - 90);
            if (f.period === 'year')  cutoff.setFullYear(now.getFullYear(), 0, 1);
            filtered = filtered.filter(e => new Date(e.createdAt) >= cutoff);
        }

        // Pair filter
        if (f.pair !== 'all')    filtered = filtered.filter(e => e.pair === f.pair);
        // Method filter
        if (f.method !== 'all')  filtered = filtered.filter(e => e.methodName === f.method);
        // Emotion filter
        if (f.emotion !== 'all') filtered = filtered.filter(e => e.emotion === f.emotion);

        return filtered;
    },

    /* ─── Render semua statistik ─────────── */
    async render() {
        if (!this.container) return;

        const allEntries = await Storage.getJournal();
        const closed     = allEntries.filter(e => e.status === 'tp' || e.status === 'sl');
        const filtered   = this._applyFilters(closed);

        // Populate dropdowns dengan data real
        this._populateFilterDropdowns(allEntries);

        if (filtered.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state" style="padding: var(--space-3xl) 0;">
                    <div class="empty-state__icon">📊</div>
                    <div class="empty-state__text">
                        Belum ada data trade yang selesai sesuai filter ini.<br>
                        <small style="color:var(--clr-text-muted);margin-top:4px;display:block;">
                            Coba ubah filter atau tutup beberapa trade terlebih dahulu.
                        </small>
                    </div>
                </div>`;
            return;
        }

        const stats = this._compute(filtered);
        this._renderStatCards(stats);
        this._renderWinRateByPair(filtered);
        this._renderWinRateByMethod(filtered);
        this._renderWinRateByEmotion(filtered);
        this._renderPnlLine(filtered);
        this._renderHourHeatmap(filtered);
        this._renderCalendarHeatmap(filtered);
    },

    /* ─── Compute Core Stats ─────────────── */
    _compute(entries) {
        const tp = entries.filter(e => e.status === 'tp');
        const sl = entries.filter(e => e.status === 'sl');
        const wr = entries.length > 0 ? (tp.length / entries.length * 100).toFixed(1) : 0;

        // P&L total
        const totalProfit = tp.reduce((s, e) => s + (e.potentialProfit || 0), 0);
        const totalLoss   = sl.reduce((s, e) => s + (e.potentialLoss  || 0), 0);
        const netPnl      = totalProfit - totalLoss;

        // Streak
        let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
        entries.forEach(e => {
            if (e.status === 'tp') { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
            else                   { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
        });

        // Profit Factor
        const pf = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : '∞';

        // Best/Worst pair
        const pairMap = {};
        entries.forEach(e => {
            if (!pairMap[e.pair]) pairMap[e.pair] = { tp: 0, sl: 0 };
            pairMap[e.pair][e.status]++;
        });
        let bestPair = '—', worstPair = '—';
        let bestWR = -1, worstWR = 101;
        Object.entries(pairMap).forEach(([pair, d]) => {
            const total = d.tp + d.sl;
            const rate  = total > 0 ? d.tp / total * 100 : 0;
            if (rate > bestWR  && total >= 2) { bestWR  = rate; bestPair  = pair; }
            if (rate < worstWR && total >= 2) { worstWR = rate; worstPair = pair; }
        });

        return { tp: tp.length, sl: sl.length, total: entries.length, wr, netPnl, totalProfit, totalLoss, pf, maxWin, maxLoss, bestPair, worstPair, bestWR: bestWR.toFixed(0), worstWR: worstWR.toFixed(0) };
    },

    /* ─── Render Stat Cards ──────────────── */
    _renderStatCards(s) {
        const pnlColor = s.netPnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';
        const pnlSign  = s.netPnl >= 0 ? '+' : '';
        document.getElementById('stat-wr-val')?.setAttribute('data-val', s.wr);
        const els = {
            'stat-wr-val':      `${s.wr}%`,
            'stat-total-val':   s.total,
            'stat-pf-val':      s.pf,
            'stat-pnl-val':     `${pnlSign}$${Math.abs(s.netPnl).toFixed(2)}`,
            'stat-maxwin-val':  `${s.maxWin} 🔥`,
            'stat-maxloss-val': `${s.maxLoss} 💔`,
            'stat-best-pair':   `${s.bestPair} (${s.bestWR}% WR)`,
            'stat-worst-pair':  `${s.worstPair} (${s.worstWR}% WR)`,
        };
        Object.entries(els).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = val;
                if (id === 'stat-pnl-val') el.style.color = pnlColor;
            }
        });
    },

    /* ─── Win Rate per Pair (Horizontal Bar) ── */
    _renderWinRateByPair(entries) {
        const canvas = document.getElementById('chart-wr-pair');
        if (!canvas) return;
        if (this._charts.wrPair) this._charts.wrPair.destroy();

        const pairMap = {};
        entries.forEach(e => {
            if (!pairMap[e.pair]) pairMap[e.pair] = { tp: 0, sl: 0 };
            pairMap[e.pair][e.status]++;
        });

        const labels = Object.keys(pairMap);
        const data   = labels.map(p => {
            const d = pairMap[p];
            return d.tp + d.sl > 0 ? +(d.tp / (d.tp + d.sl) * 100).toFixed(1) : 0;
        });

        this._charts.wrPair = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Win Rate (%)',
                    data,
                    backgroundColor: data.map(v => v >= 50 ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)'),
                    borderRadius: 6,
                }],
            },
            options: this._baseBarOpts('Win Rate per Pair (%)', true),
        });
    },

    /* ─── Win Rate per Metode ─────────────── */
    _renderWinRateByMethod(entries) {
        const canvas = document.getElementById('chart-wr-method');
        if (!canvas) return;
        if (this._charts.wrMethod) this._charts.wrMethod.destroy();

        const map = {};
        entries.forEach(e => {
            const key = e.methodName || 'Tanpa Metode';
            if (!map[key]) map[key] = { tp: 0, sl: 0 };
            map[key][e.status]++;
        });

        const labels = Object.keys(map);
        const data   = labels.map(k => {
            const d = map[k];
            return d.tp + d.sl > 0 ? +(d.tp / (d.tp + d.sl) * 100).toFixed(1) : 0;
        });

        this._charts.wrMethod = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Win Rate (%)',
                    data,
                    backgroundColor: 'rgba(99,102,241,0.7)',
                    borderRadius: 6,
                }],
            },
            options: this._baseBarOpts('Win Rate per Metode (%)'),
        });
    },

    /* ─── Win Rate per Emosi (Doughnut) ──── */
    _renderWinRateByEmotion(entries) {
        const canvas = document.getElementById('chart-wr-emotion');
        if (!canvas) return;
        if (this._charts.wrEmotion) this._charts.wrEmotion.destroy();

        const map = {};
        entries.forEach(e => {
            const key = e.emotion || '—';
            if (!map[key]) map[key] = { tp: 0, sl: 0 };
            map[key][e.status]++;
        });

        const labels = Object.keys(map);
        const tp     = labels.map(k => map[k].tp);
        const sl     = labels.map(k => map[k].sl);

        this._charts.wrEmotion = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [
                    { label: 'TP', data: tp,  backgroundColor: labels.map(() => 'rgba(38,166,154,0.7)') },
                    { label: 'SL', data: sl,  backgroundColor: labels.map(() => 'rgba(239,83,80,0.5)') },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#d1d4dc', font: { family: "'Inter', sans-serif" } } },
                    title: { display: true, text: 'Distribusi per Emosi', color: '#d1d4dc' },
                },
            },
        });
    },

    /* ─── P&L Kumulatif (Line) ───────────── */
    _renderPnlLine(entries) {
        const canvas = document.getElementById('chart-pnl-line');
        if (!canvas) return;
        if (this._charts.pnlLine) this._charts.pnlLine.destroy();

        // Sort by createdAt
        const sorted = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        let cumulative = 0;
        const labels = [];
        const data   = [];

        sorted.forEach((e, i) => {
            const pnl = e.status === 'tp' ? (e.potentialProfit || 0) : -(e.potentialLoss || 0);
            cumulative += pnl;
            labels.push(`#${i + 1}`);
            data.push(+cumulative.toFixed(2));
        });

        const color = cumulative >= 0 ? 'rgba(38,166,154,1)' : 'rgba(239,83,80,1)';
        const fillColor = cumulative >= 0 ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)';

        this._charts.pnlLine = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Kumulatif P&L ($)',
                    data,
                    borderColor: color,
                    backgroundColor: fillColor,
                    fill: true,
                    tension: 0.35,
                    pointRadius: data.length <= 30 ? 3 : 0,
                    pointHoverRadius: 5,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Kumulatif P&L ($)', color: '#d1d4dc' },
                },
                scales: {
                    x: { ticks: { color: '#787b86' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { ticks: { color: '#787b86', callback: v => `$${v}` }, grid: { color: 'rgba(255,255,255,0.06)' } },
                },
            },
        });
    },

    /* ─── Calendar Heatmap (52 minggu terakhir) ── */
    _renderCalendarHeatmap(entries) {
        const container = document.getElementById('chart-calendar-heatmap');
        if (!container) return;

        // Build day map: { 'YYYY-MM-DD': { pnl, count, wins, losses } }
        const dayMap = {};
        entries.forEach(e => {
            const date = e.closeDate || (e.createdAt || '').slice(0, 10);
            if (!date || date.length < 10) return;
            if (!dayMap[date]) dayMap[date] = { pnl: 0, count: 0, wins: 0, losses: 0 };
            const pnl = e.status === 'tp' ? (e.potentialProfit || 0) : -(e.potentialLoss || 0);
            dayMap[date].pnl += pnl;
            dayMap[date].count++;
            if (e.status === 'tp') dayMap[date].wins++;
            else dayMap[date].losses++;
        });

        // Build 52 weeks back from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Align start to Monday
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 363);
        const startDow = startDate.getDay();
        startDate.setDate(startDate.getDate() - (startDow === 0 ? 6 : startDow - 1));

        // Find max absolute P&L for color scaling
        const allPnl = Object.values(dayMap).map(d => Math.abs(d.pnl));
        const maxPnl = allPnl.length > 0 ? Math.max(...allPnl, 1) : 1;

        const getColor = (data) => {
            if (!data || data.count === 0) return 'rgba(255,255,255,0.06)';
            const intensity = Math.min(Math.abs(data.pnl) / maxPnl, 1);
            if (data.pnl >= 0) return `rgba(38,166,154,${(0.25 + intensity * 0.75).toFixed(2)})`;
            return `rgba(239,83,80,${(0.25 + intensity * 0.75).toFixed(2)})`;
        };

        // Build weeks
        const weeks = [];
        const monthLabels = []; // { col, label }
        const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
        let lastMonth = -1;
        let currentDate = new Date(startDate);

        while (currentDate <= today) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                if (currentDate > today) {
                    week.push(null);
                } else {
                    const ds = currentDate.toISOString().slice(0, 10);
                    week.push({ date: ds, data: dayMap[ds] || null });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            const firstValid = week.find(c => c);
            if (firstValid) {
                const mo = new Date(firstValid.date).getMonth();
                if (mo !== lastMonth) {
                    monthLabels.push({ col: weeks.length, label: monthNames[mo] });
                    lastMonth = mo;
                }
            }
            weeks.push(week);
        }

        // Month label row
        const totalCols = weeks.length;
        const monthHtml = (() => {
            let html = '';
            monthLabels.forEach((m, i) => {
                const nextCol = monthLabels[i + 1]?.col ?? totalCols;
                const span = nextCol - m.col;
                html += `<span class="cal-month" style="grid-column:span ${span}">${m.label}</span>`;
            });
            return html;
        })();

        // Day label rows (Mon, Wed, Fri only for space)
        const dayAbbr = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
        const dayLabelsHtml = dayAbbr.map((d, i) =>
            (i % 2 === 0) ? `<div class="cal-day">${d}</div>` : `<div class="cal-day"></div>`
        ).join('');

        // Weeks HTML
        const weeksHtml = weeks.map(week => {
            const cells = week.map(day => {
                if (!day) return `<div class="cal-cell cal-cell--empty"></div>`;
                const bg = getColor(day.data);
                const tip = day.data
                    ? `${day.date} | ${day.data.count} trade (${day.data.wins}✅ ${day.data.losses}❌) | P&L: ${day.data.pnl >= 0 ? '+' : ''}$${day.data.pnl.toFixed(2)}`
                    : day.date;
                return `<div class="cal-cell" style="background:${bg}" title="${tip}"></div>`;
            }).join('');
            return `<div class="cal-week">${cells}</div>`;
        }).join('');

        container.innerHTML = `
            <div class="cal-heatmap">
                <div class="cal-heatmap__header">
                    <span class="cal-heatmap__title">📅 Kalender Aktivitas Trading (52 Minggu Terakhir)</span>
                    <div class="cal-heatmap__legend">
                        <span>Rugi</span>
                        <div class="cal-legend-bar">
                            <div style="background:rgba(239,83,80,0.9)"></div>
                            <div style="background:rgba(239,83,80,0.55)"></div>
                            <div style="background:rgba(239,83,80,0.25)"></div>
                            <div style="background:rgba(255,255,255,0.06)"></div>
                            <div style="background:rgba(38,166,154,0.25)"></div>
                            <div style="background:rgba(38,166,154,0.55)"></div>
                            <div style="background:rgba(38,166,154,0.9)"></div>
                        </div>
                        <span>Profit</span>
                    </div>
                </div>
                <div class="cal-heatmap__body">
                    <div class="cal-day-labels">${dayLabelsHtml}</div>
                    <div class="cal-heatmap__scroll">
                        <div class="cal-month-row" style="grid-template-columns:repeat(${totalCols},14px)">${monthHtml}</div>
                        <div class="cal-weeks">${weeksHtml}</div>
                    </div>
                </div>
            </div>`;
    },

    /* ─── Trade per Jam (Heatmap Bars) ───── */
    _renderHourHeatmap(entries) {
        const canvas = document.getElementById('chart-hour-heatmap');
        if (!canvas) return;
        if (this._charts.hourMap) this._charts.hourMap.destroy();

        const hours = Array(24).fill(0).map((_, h) => ({ h, tp: 0, sl: 0 }));
        entries.forEach(e => {
            const time = e.openTime || '';
            const h    = parseInt(time.split(':')[0], 10);
            if (!isNaN(h) && h >= 0 && h < 24) {
                hours[h][e.status]++;
            }
        });

        this._charts.hourMap = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: hours.map(h => `${String(h.h).padStart(2,'0')}:00`),
                datasets: [
                    { label: 'TP', data: hours.map(h => h.tp), backgroundColor: 'rgba(38,166,154,0.7)', borderRadius: 4, stack: 'h' },
                    { label: 'SL', data: hours.map(h => h.sl), backgroundColor: 'rgba(239,83,80,0.6)',  borderRadius: 4, stack: 'h' },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#d1d4dc' } },
                    title: { display: true, text: 'Trade per Jam (WIB)', color: '#d1d4dc' },
                },
                scales: {
                    x: { stacked: true, ticks: { color: '#787b86', maxRotation: 90 }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { stacked: true, ticks: { color: '#787b86' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                },
            },
        });
    },

    /* ─── Base Bar Options ───────────────── */
    _baseBarOpts(title, horizontal = false) {
        return {
            responsive: true,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: {
                legend: { display: false },
                title: { display: true, text: title, color: '#d1d4dc', font: { size: 13 } },
            },
            scales: {
                x: { ticks: { color: '#787b86' }, grid: { color: 'rgba(255,255,255,0.04)' }, min: 0, max: horizontal ? 100 : undefined },
                y: { ticks: { color: '#787b86' }, grid: { color: 'rgba(255,255,255,0.06)' } },
            },
        };
    },

    /* ─── Populate Filter Dropdowns ──────── */
    _populateFilterDropdowns(entries) {
        const pairs   = [...new Set(entries.map(e => e.pair).filter(Boolean))].sort();
        const methods = [...new Set(entries.map(e => e.methodName).filter(Boolean))].sort();
        const emotions= [...new Set(entries.map(e => e.emotion).filter(Boolean))].sort();

        this._fillSelect('stat-filter-pair',    pairs,   'Semua Pair');
        this._fillSelect('stat-filter-method',  methods, 'Semua Metode');
        this._fillSelect('stat-filter-emotion', emotions,'Semua Emosi');
    },

    _fillSelect(id, options, placeholder) {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="all">${placeholder}</option>` +
            options.map(o => `<option value="${o}">${o}</option>`).join('');
        if (cur && cur !== 'all') sel.value = cur;
    },
};
