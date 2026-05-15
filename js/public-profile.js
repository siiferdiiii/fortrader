/* ========================================
   PUBLIC-PROFILE.JS — Halaman Profil Publik
   Menampilkan jurnal, statistik, metode
   milik trader lain yang set profilnya publik.
   ======================================== */

const PublicProfile = {

    _profile: null,
    _journal: [],
    _methods: [],

    /* ─── Init ─────────────────────────── */
    init() {
        this._bindTabEvents();
        this._bindHashRouting();
    },

    _bindTabEvents() {
        document.querySelectorAll('.pub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pub-tab-btn').forEach(b => b.classList.remove('pub-tab-btn--active'));
                document.querySelectorAll('.pub-tab-panel').forEach(p => p.style.display = 'none');
                btn.classList.add('pub-tab-btn--active');
                const tabId = btn.dataset.tab;
                const panel = document.getElementById(tabId);
                if (panel) panel.style.display = '';
            });
        });
    },

    _bindHashRouting() {
        // Support URL: app.html#/u/username
        window.addEventListener('hashchange', () => this._handleHash());
    },

    _handleHash() {
        const hash = location.hash; // e.g. #/u/siiferd
        const match = hash.match(/^#\/u\/([a-z0-9_]+)$/i);
        if (match) {
            App.navigateTo('profile');
            this.load(match[1]);
        }
    },

    /* ─── Load Profile ─────────────────── */
    async load(username) {
        this._showState('loading');
        this._profile = null;
        this._journal = [];
        this._methods = [];

        // Fetch profile
        const profile = await Storage.getPublicProfile(username);
        if (!profile || (!profile.is_journal_public && !profile.is_methods_public)) {
            this._showState('notfound');
            return;
        }

        this._profile = profile;

        // Fetch data in parallel
        const [journal, methods] = await Promise.all([
            profile.is_journal_public  ? Storage.getPublicJournal(profile.id)  : Promise.resolve([]),
            profile.is_methods_public  ? Storage.getPublicMethods(profile.id)  : Promise.resolve([]),
        ]);

        this._journal = journal;
        this._methods = methods;

        this._renderHeader();
        this._renderJournal();
        this._renderStats();
        this._renderMethods();

        // Update URL hash silently
        const newHash = `#/u/${username}`;
        if (location.hash !== newHash) history.replaceState(null, '', newHash);

        this._showState('content');
    },

    _showState(state) {
        document.getElementById('pub-profile-loading')?.style.setProperty('display', state === 'loading' ? 'flex' : 'none');
        document.getElementById('pub-profile-notfound')?.style.setProperty('display', state === 'notfound' ? 'flex' : 'none');
        document.getElementById('pub-profile-content')?.style.setProperty('display', state === 'content' ? '' : 'none');
    },

    /* ─── Header ───────────────────────── */
    _renderHeader() {
        const p = this._profile;
        const container = document.getElementById('pub-profile-header');
        if (!container || !p) return;

        const initials = (p.full_name || p.username || '??')
            .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        const closed  = this._journal;
        const wins    = closed.filter(e => e.status === 'tp').length;
        const losses  = closed.filter(e => e.status === 'sl').length;
        const total   = closed.length;
        const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '—';
        const netPnl  = closed.reduce((s, e) => {
            return s + (e.status === 'tp' ? (e.potentialProfit || 0) : -(e.potentialLoss || 0));
        }, 0);
        const pnlSign = netPnl >= 0 ? '+' : '';
        const pnlClr  = netPnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';

        const joinDate = new Date(p.created_at).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'long'
        });

        // Share button
        const shareUrl = `${location.origin}${location.pathname}#/u/${p.username}`;

        container.innerHTML = `
            <div class="pub-header-avatar">${initials}</div>
            <div class="pub-header-info">
                <div class="pub-header-name">${this._esc(p.full_name || p.username)}</div>
                <div class="pub-header-username">@${this._esc(p.username)}</div>
                ${p.bio ? `<div class="pub-header-bio">${this._esc(p.bio)}</div>` : ''}
                <div class="pub-header-meta">Bergabung ${joinDate}</div>
            </div>
            <div class="pub-header-stats">
                ${p.is_journal_public ? `
                <div class="pub-stat-pill">
                    <div class="pub-stat-pill__val" style="color:${pnlClr}">${pnlSign}$${Math.abs(netPnl).toFixed(2)}</div>
                    <div class="pub-stat-pill__lbl">Net P&L</div>
                </div>
                <div class="pub-stat-pill">
                    <div class="pub-stat-pill__val">${winRate}%</div>
                    <div class="pub-stat-pill__lbl">Win Rate</div>
                </div>
                <div class="pub-stat-pill">
                    <div class="pub-stat-pill__val">${total}</div>
                    <div class="pub-stat-pill__lbl">Total Trade</div>
                </div>` : ''}
                <button class="pub-share-btn" onclick="navigator.clipboard.writeText('${shareUrl}').then(()=>App.showToast('Link disalin!','success'))">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    Bagikan
                </button>
            </div>`;
    },

    /* ─── Journal Tab ──────────────────── */
    _renderJournal() {
        const panel = document.getElementById('pub-tab-journal');
        if (!panel) return;

        const p = this._profile;
        if (!p.is_journal_public) {
            panel.innerHTML = `<div class="pub-private-notice">🔒 Jurnal bersifat privat</div>`;
            return;
        }

        if (this._journal.length === 0) {
            panel.innerHTML = `<div class="pub-private-notice">Belum ada trade yang dicatat</div>`;
            return;
        }

        const rows = this._journal.map(e => {
            const pnl    = e.status === 'tp' ? (e.potentialProfit || 0) : -(e.potentialLoss || 0);
            const pnlClr = pnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';
            const sign   = pnl >= 0 ? '+' : '';
            const badge  = e.status === 'tp'
                ? '<span class="pub-badge pub-badge--tp">TP</span>'
                : '<span class="pub-badge pub-badge--sl">SL</span>';
            const date   = e.closeDate || (e.createdAt || '').slice(0, 10);
            return `
                <tr>
                    <td>${date}</td>
                    <td><strong>${this._esc(e.pair)}</strong></td>
                    <td>${this._esc(e.methodName || '—')}</td>
                    <td>${badge}</td>
                    <td style="color:${pnlClr};font-weight:700;font-family:var(--font-mono)">${sign}$${Math.abs(pnl).toFixed(2)}</td>
                </tr>`;
        }).join('');

        panel.innerHTML = `
            <div class="pub-table-wrap">
                <table class="pub-table">
                    <thead><tr>
                        <th>Tanggal</th><th>Pair</th><th>Metode</th><th>Status</th><th>P&L</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    },

    /* ─── Stats Tab ────────────────────── */
    _renderStats() {
        const panel = document.getElementById('pub-tab-stats');
        if (!panel) return;

        const p = this._profile;
        if (!p.is_journal_public || this._journal.length === 0) {
            panel.innerHTML = `<div class="pub-private-notice">📊 Belum ada data statistik</div>`;
            return;
        }

        const closed = this._journal;
        const wins   = closed.filter(e => e.status === 'tp').length;
        const losses = closed.filter(e => e.status === 'sl').length;
        const total  = closed.length;
        const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
        const grossProfit = closed.filter(e => e.status === 'tp').reduce((s, e) => s + (e.potentialProfit || 0), 0);
        const grossLoss   = closed.filter(e => e.status === 'sl').reduce((s, e) => s + (e.potentialLoss  || 0), 0);
        const netPnl      = grossProfit - grossLoss;
        const pf          = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0');
        const pnlSign     = netPnl >= 0 ? '+' : '';
        const pnlClr      = netPnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';

        panel.innerHTML = `
            <div class="pub-stats-grid">
                <div class="pub-stat-card"><div class="pub-stat-card__val">${total}</div><div class="pub-stat-card__lbl">Total Trade</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val">${winRate}%</div><div class="pub-stat-card__lbl">Win Rate</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:${pnlClr}">${pnlSign}$${Math.abs(netPnl).toFixed(2)}</div><div class="pub-stat-card__lbl">Net P&L</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val">${pf}</div><div class="pub-stat-card__lbl">Profit Factor</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:var(--clr-tp)">$${grossProfit.toFixed(2)}</div><div class="pub-stat-card__lbl">Gross Profit</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:var(--clr-sl)">$${grossLoss.toFixed(2)}</div><div class="pub-stat-card__lbl">Gross Loss</div></div>
            </div>`;
    },

    /* ─── Methods Tab ──────────────────── */
    _renderMethods() {
        const panel = document.getElementById('pub-tab-methods');
        if (!panel) return;

        const p = this._profile;
        if (!p.is_methods_public) {
            panel.innerHTML = `<div class="pub-private-notice">🔒 Metode bersifat privat</div>`;
            return;
        }

        if (this._methods.length === 0) {
            panel.innerHTML = `<div class="pub-private-notice">Belum ada metode yang dibagikan</div>`;
            return;
        }

        const cards = this._methods.map(m => `
            <div class="pub-method-card">
                <div class="pub-method-card__name">${this._esc(m.name)}</div>
                ${m.sopEntry ? `
                    <div class="pub-method-card__section">
                        <div class="pub-method-card__label">📌 Entry</div>
                        <div class="pub-method-card__text">${this._esc(m.sopEntry)}</div>
                    </div>` : ''}
                ${m.sopExit ? `
                    <div class="pub-method-card__section">
                        <div class="pub-method-card__label">🚪 Exit</div>
                        <div class="pub-method-card__text">${this._esc(m.sopExit)}</div>
                    </div>` : ''}
            </div>`).join('');

        panel.innerHTML = `<div class="pub-methods-grid">${cards}</div>`;
    },

    /* ─── Helper ───────────────────────── */
    _esc(str = '') {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
