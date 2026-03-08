/* ========================================
   DASHBOARD.JS – Performance Dashboard
   ======================================== */

const Dashboard = {

    _equityChart: null,
    _doughnutChart: null,

    init() {
        this.cacheDOM();
    },

    cacheDOM() {
        // Stat elements
        this.elTotalTrades = document.getElementById('dash-total-trades');
        this.elWinRate = document.getElementById('dash-win-rate');
        this.elTotalPnl = document.getElementById('dash-total-pnl');
        this.elProfitFactor = document.getElementById('dash-profit-factor');
        this.elBestStreak = document.getElementById('dash-best-streak');
        this.elAvgRR = document.getElementById('dash-avg-rr');

        // Sub labels
        this.elTotalSub = document.getElementById('dash-total-sub');
        this.elWrSub = document.getElementById('dash-wr-sub');
        this.elPnlSub = document.getElementById('dash-pnl-sub');

        // Chart canvases
        this.canvasEquity = document.getElementById('dash-equity-chart');
        this.canvasDoughnut = document.getElementById('dash-doughnut-chart');

        // Leaderboard
        this.leaderboardBody = document.getElementById('dash-leaderboard-body');

        // Containers for toggling empty state
        this.contentWrap = document.getElementById('dash-content');
        this.emptyWrap = document.getElementById('dash-empty');
    },

    /* =========================================
       RENDER — called every time user navigates
       ========================================= */
    render() {
        const entries = Storage.getJournal();
        const closed = entries.filter(e => e.status === 'tp' || e.status === 'sl');

        // Toggle empty vs content
        if (closed.length === 0) {
            if (this.contentWrap) this.contentWrap.style.display = 'none';
            if (this.emptyWrap) this.emptyWrap.style.display = '';
            return;
        }
        if (this.contentWrap) this.contentWrap.style.display = '';
        if (this.emptyWrap) this.emptyWrap.style.display = 'none';

        const stats = this._computeStats(closed);
        this._renderStats(stats);
        this._renderEquityChart(closed);
        this._renderDoughnutChart(stats);
        this._renderLeaderboard(closed);
    },

    /* =========================================
       COMPUTE STATS
       ========================================= */
    _computeStats(closed) {
        let wins = 0, losses = 0;
        let grossProfit = 0, grossLoss = 0;
        let streak = 0, maxWinStreak = 0, maxLoseStreak = 0;
        let currentStreak = 0, lastResult = null;
        let totalRR = 0, rrCount = 0;

        closed.forEach(e => {
            if (e.status === 'tp') {
                wins++;
                grossProfit += Math.abs(e.potentialProfit || 0);
                if (lastResult === 'tp') { currentStreak++; }
                else { currentStreak = 1; }
                lastResult = 'tp';
                if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
            } else {
                losses++;
                grossLoss += Math.abs(e.potentialLoss || 0);
                if (lastResult === 'sl') { currentStreak++; }
                else { currentStreak = 1; }
                lastResult = 'sl';
                if (currentStreak > maxLoseStreak) maxLoseStreak = currentStreak;
            }

            // R:R
            if (e.slPips > 0 && e.tpPips > 0) {
                totalRR += (e.tpPips / e.slPips);
                rrCount++;
            }
        });

        const total = wins + losses;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const pnl = grossProfit - grossLoss;
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? Infinity : 0);
        const avgRR = rrCount > 0 ? totalRR / rrCount : 0;

        return { total, wins, losses, winRate, grossProfit, grossLoss, pnl, profitFactor, maxWinStreak, maxLoseStreak, avgRR };
    },

    /* =========================================
       RENDER STAT CARDS
       ========================================= */
    _renderStats(s) {
        if (this.elTotalTrades) this.elTotalTrades.textContent = s.total;
        if (this.elWinRate) this.elWinRate.textContent = `${s.winRate.toFixed(1)}%`;
        if (this.elTotalPnl) {
            const sign = s.pnl >= 0 ? '+' : '';
            this.elTotalPnl.textContent = `${sign}$${s.pnl.toFixed(2)}`;
        }
        if (this.elProfitFactor) {
            this.elProfitFactor.textContent = s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2);
        }
        if (this.elBestStreak) this.elBestStreak.textContent = s.maxWinStreak;
        if (this.elAvgRR) this.elAvgRR.textContent = `1:${s.avgRR.toFixed(2)}`;

        // Subs
        if (this.elTotalSub) this.elTotalSub.textContent = `${s.wins}W / ${s.losses}L`;
        if (this.elWrSub) this.elWrSub.textContent = `${s.wins} dari ${s.total} trade`;
        if (this.elPnlSub) {
            this.elPnlSub.textContent = `Profit $${s.grossProfit.toFixed(2)} · Loss $${s.grossLoss.toFixed(2)}`;
        }

        // Dynamic color for PnL card
        const pnlCard = this.elTotalPnl?.closest('.dash-stat-card');
        if (pnlCard) {
            pnlCard.classList.remove('dash-stat-card--tp', 'dash-stat-card--sl');
            pnlCard.classList.add(s.pnl >= 0 ? 'dash-stat-card--tp' : 'dash-stat-card--sl');
        }
    },

    /* =========================================
       EQUITY CURVE (Line Chart)
       ========================================= */
    _renderEquityChart(closed) {
        if (!this.canvasEquity) return;

        // Build cumulative P/L series
        const labels = ['Start'];
        const data = [0];
        let cumulative = 0;

        closed.forEach((e, i) => {
            if (e.status === 'tp') {
                cumulative += Math.abs(e.potentialProfit || 0);
            } else {
                cumulative -= Math.abs(e.potentialLoss || 0);
            }
            labels.push(`#${i + 1}`);
            data.push(parseFloat(cumulative.toFixed(2)));
        });

        if (this._equityChart) {
            this._equityChart.data.labels = labels;
            this._equityChart.data.datasets[0].data = data;
            this._equityChart.update();
            return;
        }

        const ctx = this.canvasEquity.getContext('2d');

        // Gradient fill
        const grad = ctx.createLinearGradient(0, 0, 0, 220);
        grad.addColorStop(0, 'rgba(99,102,241,0.35)');
        grad.addColorStop(1, 'rgba(99,102,241,0.0)');

        this._equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Cumulative P/L',
                    data,
                    borderColor: '#818cf8',
                    backgroundColor: grad,
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointBackgroundColor: '#818cf8',
                    pointBorderColor: '#0a0e17',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.35,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148,163,184,0.15)',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => `P/L: $${ctx.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#64748b', font: { size: 10 } },
                        grid: { color: 'rgba(148,163,184,0.06)' },
                    },
                    y: {
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            callback: v => `$${v}`
                        },
                        grid: { color: 'rgba(148,163,184,0.06)' },
                    }
                }
            }
        });
    },

    /* =========================================
       WIN / LOSS DOUGHNUT
       ========================================= */
    _renderDoughnutChart(stats) {
        if (!this.canvasDoughnut) return;

        const data = [stats.wins, stats.losses];
        const labels = ['Win (TP)', 'Loss (SL)'];

        if (this._doughnutChart) {
            this._doughnutChart.data.datasets[0].data = data;
            this._doughnutChart.update();
            return;
        }

        const ctx = this.canvasDoughnut.getContext('2d');

        this._doughnutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderColor: '#0a0e17',
                    borderWidth: 3,
                    hoverOffset: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 11, weight: '600' },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148,163,184,0.15)',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                    }
                }
            }
        });
    },

    /* =========================================
       STRATEGY LEADERBOARD
       ========================================= */
    _renderLeaderboard(closed) {
        if (!this.leaderboardBody) return;

        // Group by methodName
        const map = {};
        closed.forEach(e => {
            const name = e.methodName || 'Tanpa Strategi';
            if (!map[name]) map[name] = { name, wins: 0, losses: 0, profit: 0, loss: 0 };
            if (e.status === 'tp') {
                map[name].wins++;
                map[name].profit += Math.abs(e.potentialProfit || 0);
            } else {
                map[name].losses++;
                map[name].loss += Math.abs(e.potentialLoss || 0);
            }
        });

        // To array, compute WR, sort
        const strategies = Object.values(map).map(s => {
            const total = s.wins + s.losses;
            s.total = total;
            s.winRate = total > 0 ? (s.wins / total) * 100 : 0;
            s.pnl = s.profit - s.loss;
            return s;
        });

        // Sort: best WR first, tie-break by total trades desc
        strategies.sort((a, b) => {
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            return b.total - a.total;
        });

        this.leaderboardBody.innerHTML = '';

        strategies.forEach((s, idx) => {
            const rank = idx + 1;
            const badgeClass = rank === 1 ? 'rank-badge--gold'
                : rank === 2 ? 'rank-badge--silver'
                    : rank === 3 ? 'rank-badge--bronze'
                        : 'rank-badge--default';
            const rowClass = rank === 1 ? 'rank-1' : '';
            const wrClass = s.winRate >= 50 ? 'wr-positive' : 'wr-negative';
            const pnlClass = s.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const pnlSign = s.pnl >= 0 ? '+' : '';

            const tr = document.createElement('tr');
            tr.className = rowClass;
            tr.innerHTML = `
                <td>
                  <span class="strategy-name">
                    <span class="rank-badge ${badgeClass}">${rank}</span>
                    ${this._esc(s.name)}
                  </span>
                </td>
                <td>${s.total}</td>
                <td style="color:var(--clr-tp);">${s.wins}</td>
                <td style="color:var(--clr-sl);">${s.losses}</td>
                <td class="${wrClass}">${s.winRate.toFixed(1)}%</td>
                <td class="${pnlClass}">${pnlSign}$${s.pnl.toFixed(2)}</td>
            `;
            this.leaderboardBody.appendChild(tr);
        });
    },

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },

    /* =========================================
       EXPORT CSV
       ========================================= */
    exportCSV() {
        // Check plan limit
        const check = PlanLimits.check('exportCSV');
        if (!check.allowed) {
            App.showToast(check.message, 'error');
            return;
        }

        const entries = Storage.getJournal();
        const closed = entries.filter(e => e.status === 'tp' || e.status === 'sl');

        if (closed.length === 0) {
            App.showToast('Belum ada data trade untuk di-export.', 'error');
            return;
        }

        // CSV headers
        const headers = ['Tanggal', 'Pair', 'Metode', 'Lot', 'SL Pips', 'TP Pips', 'Status', 'Loss ($)', 'Profit ($)', 'Emosi', 'Catatan'];

        const rows = closed.map(e => {
            const date = new Date(e.closedAt || e.createdAt).toLocaleDateString('id-ID');
            return [
                date,
                e.pair || '',
                e.methodName || '',
                e.lotSize || '',
                e.slPips || '',
                e.tpPips || '',
                e.status === 'tp' ? 'TP (Win)' : 'SL (Loss)',
                e.potentialLoss ? e.potentialLoss.toFixed(2) : '0',
                e.potentialProfit ? e.potentialProfit.toFixed(2) : '0',
                e.emotion || '',
                (e.notes || '').replace(/"/g, '""')
            ].map(v => `"${v}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `fortrader_journal_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        App.showToast('✅ Data berhasil di-export ke CSV!', 'success');
    }
};
