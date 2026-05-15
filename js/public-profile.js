/* ========================================
   PUBLIC-PROFILE.JS — Halaman Profil Publik
   Full journal cards: gambar, emosi, detail
   trade, gallery, statistik, metode.
   ======================================== */

const PublicProfile = {

    _profile: null,
    _journal: [],
    _methods: [],

    /* ─── Init ─────────────────────────── */
    init() {
        this._bindTabEvents();
        this._bindHashRouting();
        this._initLightbox();
    },

    _bindTabEvents() {
        document.addEventListener('click', e => {
            const btn = e.target.closest('.pub-tab-btn');
            if (!btn) return;
            document.querySelectorAll('.pub-tab-btn').forEach(b => b.classList.remove('pub-tab-btn--active'));
            document.querySelectorAll('.pub-tab-panel').forEach(p => p.style.display = 'none');
            btn.classList.add('pub-tab-btn--active');
            const panel = document.getElementById(btn.dataset.tab);
            if (panel) panel.style.display = '';
        });
    },

    _bindHashRouting() {
        window.addEventListener('hashchange', () => this._handleHash());
    },

    _handleHash() {
        const hash = location.hash;
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

        const profile = await Storage.getPublicProfile(username);
        if (!profile || (!profile.is_journal_public && !profile.is_methods_public)) {
            this._showState('notfound');
            return;
        }

        this._profile = profile;

        const [journal, methods] = await Promise.all([
            profile.is_journal_public  ? Storage.getPublicJournal(profile.id)  : Promise.resolve([]),
            profile.is_methods_public  ? Storage.getPublicMethods(profile.id)  : Promise.resolve([]),
        ]);

        this._journal = journal;
        this._methods = methods;

        // Reset to first tab
        document.querySelectorAll('.pub-tab-btn').forEach((b, i) => b.classList.toggle('pub-tab-btn--active', i === 0));
        document.querySelectorAll('.pub-tab-panel').forEach((p, i) => p.style.display = i === 0 ? '' : 'none');

        this._renderHeader();
        this._renderJournal();
        this._renderGallery();
        this._renderStats();
        this._renderMethods();

        const newHash = `#/u/${username}`;
        if (location.hash !== newHash) history.replaceState(null, '', newHash);

        this._showState('content');
    },

    _showState(state) {
        const loading = document.getElementById('pub-profile-loading');
        const notfound = document.getElementById('pub-profile-notfound');
        const content = document.getElementById('pub-profile-content');
        if (loading)  loading.style.display  = state === 'loading'  ? 'flex' : 'none';
        if (notfound) notfound.style.display  = state === 'notfound' ? 'flex' : 'none';
        if (content)  content.style.display   = state === 'content'  ? ''    : 'none';
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
        const total   = closed.length;
        const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '—';
        const netPnl  = closed.reduce((s, e) =>
            s + (e.status === 'tp' ? (e.potentialProfit || 0) : -(e.potentialLoss || 0)), 0);
        const pnlSign = netPnl >= 0 ? '+' : '';
        const pnlClr  = netPnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';
        const joinDate = new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
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

    /* ─── Journal Tab: Full Rich Cards ─── */
    _renderJournal() {
        const panel = document.getElementById('pub-tab-journal');
        if (!panel) return;

        const p = this._profile;
        if (!p.is_journal_public) {
            panel.innerHTML = `<div class="pub-private-notice">🔒 Jurnal bersifat privat</div>`;
            return;
        }
        if (this._journal.length === 0) {
            panel.innerHTML = `<div class="pub-private-notice">📓 Belum ada trade yang dicatat</div>`;
            return;
        }

        const cards = this._journal.map(e => this._buildJournalCard(e)).join('');
        panel.innerHTML = `<div class="pub-journal-list">${cards}</div>`;

        // Bind lightbox clicks
        panel.querySelectorAll('.pub-card-img').forEach(img => {
            img.addEventListener('click', () => {
                this._openLightbox(img.src, img.alt);
            });
        });
    },

    _buildJournalCard(entry) {
        const statusClass = { open: 'pub-card--open', tp: 'pub-card--tp', sl: 'pub-card--sl' }[entry.status] || '';
        const statusLabel = { open: '⬤ Open', tp: '✅ Hit TP', sl: '❌ Hit SL' }[entry.status] || '';
        const pnl         = entry.status === 'tp' ? (entry.potentialProfit || 0) : -(entry.potentialLoss || 0);
        const pnlSign     = pnl >= 0 ? '+' : '';
        const pnlClr      = pnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';

        const beforeImg = (entry.beforeImages || [])[0];
        const afterImg  = (entry.afterImages  || [])[0];
        const allImgs   = [...(entry.beforeImages || []), ...(entry.afterImages || [])];

        const imagesHtml = `
            <div class="pub-card-images">
                <div class="pub-card-img-half ${beforeImg ? '' : 'pub-card-img-half--empty'}">
                    <span class="pub-card-img-label">Before</span>
                    ${beforeImg
                        ? `<img class="pub-card-img" src="${this._esc(beforeImg.url)}" alt="Before setup" loading="lazy">`
                        : `<div class="pub-card-img-placeholder">📷</div>`}
                </div>
                <div class="pub-card-img-half ${afterImg ? '' : 'pub-card-img-half--empty'}">
                    <span class="pub-card-img-label">After</span>
                    ${afterImg
                        ? `<img class="pub-card-img" src="${this._esc(afterImg.url)}" alt="After result" loading="lazy">`
                        : `<div class="pub-card-img-placeholder">📷</div>`}
                </div>
            </div>`;

        const emotionHtml  = entry.emotion && entry.emotion !== '—'
            ? `<span class="pub-emotion-chip">${this._esc(entry.emotion)}</span>` : '';

        const newsHtml = (entry.newsTags || []).length > 0
            ? `<span class="pub-news-chip">🔥 ${this._esc(entry.newsTags.join(', '))}</span>` : '';

        const notesHtml = entry.notes
            ? `<div class="pub-card-notes">📝 ${this._esc(entry.notes)}</div>` : '';

        const closeDate = entry.closeDate || (entry.createdAt || '').slice(0, 10);

        return `
            <div class="pub-journal-card ${statusClass}">
                <div class="pub-card-header">
                    <div class="pub-card-title-row">
                        <span class="pub-card-pair">${this._esc(entry.pair)}</span>
                        ${entry.methodName ? `<span class="pub-card-method">${this._esc(entry.methodName)}</span>` : ''}
                        ${emotionHtml}${newsHtml}
                    </div>
                    <span class="pub-card-status-badge pub-card-status-badge--${entry.status}">${statusLabel}</span>
                </div>

                <div class="pub-card-body">
                    <div class="pub-card-details">
                        <div class="pub-card-field"><span class="pub-card-field-lbl">Lot</span><span class="pub-card-field-val">${entry.lotSize ?? '—'}</span></div>
                        <div class="pub-card-field"><span class="pub-card-field-lbl">Saldo</span><span class="pub-card-field-val">$${entry.balance?.toLocaleString() ?? '—'}</span></div>
                        <div class="pub-card-field"><span class="pub-card-field-lbl">Risk</span><span class="pub-card-field-val">${entry.risk ?? '—'}%</span></div>
                        <div class="pub-card-field"><span class="pub-card-field-lbl">SL</span><span class="pub-card-field-val">${entry.slPips ?? '—'}</span></div>
                        <div class="pub-card-field"><span class="pub-card-field-lbl">TP</span><span class="pub-card-field-val">${entry.tpPips ?? '—'}</span></div>
                        <div class="pub-card-field"><span class="pub-card-field-lbl">Loss</span><span class="pub-card-field-val" style="color:var(--clr-sl)">$${entry.potentialLoss?.toFixed(2) ?? '—'}</span></div>
                        <div class="pub-card-field"><span class="pub-card-field-lbl">Profit</span><span class="pub-card-field-val" style="color:var(--clr-tp)">+$${entry.potentialProfit?.toFixed(2) ?? '—'}</span></div>
                        <div class="pub-card-field pub-card-field--pnl"><span class="pub-card-field-lbl">P&L</span><span class="pub-card-field-val" style="color:${pnlClr};font-weight:800">${pnlSign}$${Math.abs(pnl).toFixed(2)}</span></div>
                    </div>
                    ${imagesHtml}
                </div>

                ${notesHtml}

                <div class="pub-card-footer">
                    <span class="pub-card-time">⏱ ${entry.openTime || '—'} → ${entry.closeTime || '—'}</span>
                    <span class="pub-card-date">${closeDate}</span>
                </div>
            </div>`;
    },

    /* ─── Gallery Tab ──────────────────── */
    _renderGallery() {
        const panel = document.getElementById('pub-tab-gallery');
        if (!panel) return;

        const p = this._profile;
        if (!p.is_journal_public) {
            panel.innerHTML = `<div class="pub-private-notice">🔒 Galeri bersifat privat</div>`;
            return;
        }

        const withImages = this._journal.filter(e =>
            (e.beforeImages || []).length > 0 || (e.afterImages || []).length > 0
        );

        if (withImages.length === 0) {
            panel.innerHTML = `<div class="pub-private-notice">🖼️ Belum ada foto setup yang dibagikan</div>`;
            return;
        }

        const cards = withImages.map(entry => {
            const beforeImg = (entry.beforeImages || [])[0];
            const afterImg  = (entry.afterImages  || [])[0];
            const statusClr = { open: '#6366f1', tp: '#26a69a', sl: '#ef5350' }[entry.status] || '#6366f1';
            const statusLbl = { open: '⬤ Open', tp: '✅ TP', sl: '❌ SL' }[entry.status] || '';
            return `
                <div class="pub-gallery-card">
                    <div class="pub-gallery-images">
                        <div class="pub-gallery-half">
                            ${beforeImg
                                ? `<img class="pub-card-img" src="${this._esc(beforeImg.url)}" alt="Before" loading="lazy">`
                                : `<div class="pub-gallery-empty">Before</div>`}
                            <span class="pub-gallery-label">Before</span>
                        </div>
                        <div class="pub-gallery-half">
                            ${afterImg
                                ? `<img class="pub-card-img" src="${this._esc(afterImg.url)}" alt="After" loading="lazy">`
                                : `<div class="pub-gallery-empty">After</div>`}
                            <span class="pub-gallery-label">After</span>
                        </div>
                    </div>
                    <div class="pub-gallery-info">
                        <span class="pub-card-pair">${this._esc(entry.pair)}</span>
                        <span style="color:${statusClr};font-weight:700;font-size:var(--fs-xs)">${statusLbl}</span>
                        ${entry.methodName ? `<span class="pub-card-method">${this._esc(entry.methodName)}</span>` : ''}
                    </div>
                </div>`;
        }).join('');

        panel.innerHTML = `<div class="pub-gallery-grid">${cards}</div>`;

        panel.querySelectorAll('.pub-card-img').forEach(img => {
            img.addEventListener('click', () => this._openLightbox(img.src, img.alt));
        });
    },

    /* ─── Stats Tab ─────────────────────── */
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

        // Avg win/loss
        const avgWin  = wins  > 0 ? (grossProfit / wins).toFixed(2)  : '0';
        const avgLoss = losses> 0 ? (grossLoss   / losses).toFixed(2) : '0';

        // Best pair
        const pairMap = {};
        closed.forEach(e => {
            if (!pairMap[e.pair]) pairMap[e.pair] = { trades: 0, pnl: 0 };
            pairMap[e.pair].trades++;
            pairMap[e.pair].pnl += e.status === 'tp' ? (e.potentialProfit || 0) : -(e.potentialLoss || 0);
        });
        const bestPair = Object.entries(pairMap).sort((a, b) => b[1].pnl - a[1].pnl)[0];

        // Emotion distribution
        const emotions = {};
        closed.forEach(e => { if (e.emotion) emotions[e.emotion] = (emotions[e.emotion] || 0) + 1; });
        const emotionHtml = Object.entries(emotions).length > 0
            ? Object.entries(emotions).sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([em, cnt]) => `<span class="pub-emotion-chip">${this._esc(em)} <strong>${cnt}x</strong></span>`).join('')
            : '<span style="color:var(--clr-text-muted);font-size:var(--fs-xs)">Tidak ada data</span>';

        panel.innerHTML = `
            <div class="pub-stats-grid">
                <div class="pub-stat-card"><div class="pub-stat-card__val">${total}</div><div class="pub-stat-card__lbl">Total Trade</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val">${winRate}%</div><div class="pub-stat-card__lbl">Win Rate</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:${pnlClr}">${pnlSign}$${Math.abs(netPnl).toFixed(2)}</div><div class="pub-stat-card__lbl">Net P&L</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val">${pf}</div><div class="pub-stat-card__lbl">Profit Factor</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:var(--clr-tp)">$${grossProfit.toFixed(2)}</div><div class="pub-stat-card__lbl">Gross Profit</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:var(--clr-sl)">$${grossLoss.toFixed(2)}</div><div class="pub-stat-card__lbl">Gross Loss</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:var(--clr-tp)">$${avgWin}</div><div class="pub-stat-card__lbl">Avg Win</div></div>
                <div class="pub-stat-card"><div class="pub-stat-card__val" style="color:var(--clr-sl)">$${avgLoss}</div><div class="pub-stat-card__lbl">Avg Loss</div></div>
                ${bestPair ? `<div class="pub-stat-card"><div class="pub-stat-card__val" style="font-size:var(--fs-md)">${this._esc(bestPair[0])}</div><div class="pub-stat-card__lbl">Best Pair</div></div>` : ''}
            </div>

            <div class="pub-stat-section">
                <div class="pub-stat-section__title">Distribusi Emosi Saat Trading</div>
                <div class="pub-emotion-list">${emotionHtml}</div>
            </div>

            <div class="pub-stat-section">
                <div class="pub-stat-section__title">Performa per Pair</div>
                <div class="pub-pair-list">
                    ${Object.entries(pairMap).sort((a,b) => b[1].trades - a[1].trades).map(([pair, data]) => {
                        const clr = data.pnl >= 0 ? 'var(--clr-tp)' : 'var(--clr-sl)';
                        const sign = data.pnl >= 0 ? '+' : '';
                        const pct = Math.abs(data.pnl / (Math.abs(netPnl) || 1) * 100).toFixed(0);
                        return `
                        <div class="pub-pair-row">
                            <span class="pub-pair-row__name">${this._esc(pair)}</span>
                            <div class="pub-pair-row__bar-wrap">
                                <div class="pub-pair-row__bar" style="width:${pct}%;background:${data.pnl>=0?'rgba(38,166,154,0.4)':'rgba(239,83,80,0.4)'}"></div>
                            </div>
                            <span class="pub-pair-row__trades">${data.trades} trade</span>
                            <span class="pub-pair-row__pnl" style="color:${clr}">${sign}$${Math.abs(data.pnl).toFixed(2)}</span>
                        </div>`;
                    }).join('')}
                </div>
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
                ${m.sopEntry ? `<div class="pub-method-card__section"><div class="pub-method-card__label">📌 Entry</div><div class="pub-method-card__text">${this._esc(m.sopEntry)}</div></div>` : ''}
                ${m.sopExit  ? `<div class="pub-method-card__section"><div class="pub-method-card__label">🚪 Exit</div><div class="pub-method-card__text">${this._esc(m.sopExit)}</div></div>` : ''}
            </div>`).join('');

        panel.innerHTML = `<div class="pub-methods-grid">${cards}</div>`;
    },

    /* ─── Lightbox ─────────────────────── */
    _initLightbox() {
        const lb = document.createElement('div');
        lb.id = 'pub-lightbox';
        lb.className = 'pub-lightbox';
        lb.innerHTML = `
            <div class="pub-lightbox__backdrop"></div>
            <img class="pub-lightbox__img" src="" alt="">
            <button class="pub-lightbox__close" aria-label="Tutup">✕</button>`;
        document.body.appendChild(lb);

        lb.querySelector('.pub-lightbox__backdrop').addEventListener('click', () => this._closeLightbox());
        lb.querySelector('.pub-lightbox__close').addEventListener('click',    () => this._closeLightbox());
        document.addEventListener('keydown', e => { if (e.key === 'Escape') this._closeLightbox(); });
    },

    _openLightbox(src, alt = '') {
        const lb = document.getElementById('pub-lightbox');
        if (!lb) return;
        lb.querySelector('.pub-lightbox__img').src = src;
        lb.querySelector('.pub-lightbox__img').alt = alt;
        lb.classList.add('pub-lightbox--open');
        document.body.style.overflow = 'hidden';
    },

    _closeLightbox() {
        const lb = document.getElementById('pub-lightbox');
        if (lb) { lb.classList.remove('pub-lightbox--open'); document.body.style.overflow = ''; }
    },

    /* ─── Helper ───────────────────────── */
    _esc(str = '') {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
