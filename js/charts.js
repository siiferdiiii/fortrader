/* ========================================
   CHARTS.JS - Chart.js Integration (Equity Curve)
   ======================================== */

const Charts = {
    equityChart: null,

    init() {
        this.createEquityChart();
    },

    createEquityChart() {
        const ctx = document.getElementById('equity-chart');
        if (!ctx) return;

        // Destroy existing if any
        if (this.equityChart) {
            this.equityChart.destroy();
        }

        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Start'],
                datasets: [{
                    label: 'Ekuitas ($)',
                    data: [10000],
                    borderColor: '#6366f1',
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx: c, chartArea } = chart;
                        if (!chartArea) return 'rgba(99, 102, 241, 0.1)';
                        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
                        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
                        return gradient;
                    },
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#0a0e17',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#818cf8',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.2)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: (items) => `Trade #${items[0].dataIndex}`,
                            label: (item) => `Ekuitas: $${item.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.06)',
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11, family: 'Inter' },
                            maxRotation: 0,
                        },
                        border: { display: false }
                    },
                    y: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.06)',
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11, family: 'Inter' },
                            callback: (val) => '$' + val.toLocaleString('en-US'),
                        },
                        border: { display: false }
                    }
                },
                animation: {
                    duration: 600,
                    easing: 'easeInOutQuart',
                }
            }
        });
    },

    /**
     * Update the equity chart with trade data
     * @param {number} initialBalance - Starting balance
     * @param {Array} trades - Array of trade objects with 'result' ('tp' | 'sl') and 'balanceAfter'
     */
    updateEquityChart(initialBalance, trades) {
        if (!this.equityChart) return;

        const labels = ['Start'];
        const data = [initialBalance];

        trades.forEach((trade, i) => {
            labels.push(`#${i + 1}`);
            data.push(trade.balanceAfter);
        });

        // Dynamic colors based on current vs initial
        const lastBalance = data[data.length - 1];
        const isProfit = lastBalance >= initialBalance;
        const lineColor = isProfit ? '#10b981' : '#ef4444';
        const shadowColor = isProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';

        this.equityChart.data.labels = labels;
        this.equityChart.data.datasets[0].data = data;
        this.equityChart.data.datasets[0].borderColor = lineColor;
        this.equityChart.data.datasets[0].pointBackgroundColor = lineColor;
        this.equityChart.data.datasets[0].backgroundColor = (context) => {
            const chart = context.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return shadowColor;
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, shadowColor);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            return gradient;
        };

        this.equityChart.update('active');
    },

    /**
     * Reset chart to initial state
     */
    reset(initialBalance = 10000) {
        if (!this.equityChart) return;
        this.equityChart.data.labels = ['Start'];
        this.equityChart.data.datasets[0].data = [initialBalance];
        this.equityChart.data.datasets[0].borderColor = '#6366f1';
        this.equityChart.data.datasets[0].pointBackgroundColor = '#6366f1';
        this.equityChart.update('active');
    }
};
