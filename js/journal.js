/* ========================================
   JOURNAL.JS – Trade Journal v2
   Tabs: Log | Galeri | Statistik
   Before/After card + Detail Modal
   ======================================== */

const Journal = {

    _activeTab: 'log',  // 'log' | 'gallery' | 'stats'

    /* ─── Init ───────────────────────────── */
    init() {
        this._cacheDOM();
        this._bindEvents();
        this.render();
        Storage.subscribeToJournal(() => this.render());
    },

    _cacheDOM() {
        this.statOpen = document.getElementById('journal-stat-open');
        this.statTP   = document.getElementById('journal-stat-tp');
        this.statSL   = document.getElementById('journal-stat-sl');
        this.statWR   = document.getElementById('journal-stat-wr');
        this.listEl   = document.getElementById('journal-list');
        this.galleryEl= document.getElementById('journal-gallery-grid');
        this.statsEl  = document.getElementById('journal-stats-container');

        // Tab buttons
        this.tabBtns  = document.querySelectorAll('.journal-tab-btn');

        // Detail Modal
        this.modal     = document.getElementById('journal-detail-modal');
        this.modalClose= document.getElementById('journal-modal-close');
    },

    _bindEvents() {
        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this._switchTab(tab);
            });
        });

        // Filter dropdown (Log tab)
        const filterEl = document.getElementById('journal-filter');
        if (filterEl) filterEl.addEventListener('change', () => this.render());

        // Close modal
        if (this.modalClose) this.modalClose.addEventListener('click', () => this._closeModal());
        if (this.modal) this.modal.addEventListener('click', e => {
            if (e.target === this.modal) this._closeModal();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') this._closeModal();
        });
    },

    _switchTab(tab) {
        this._activeTab = tab;
        this.tabBtns.forEach(b => b.classList.toggle('journal-tab-btn--active', b.dataset.tab === tab));
        document.querySelectorAll('.journal-tab-panel').forEach(p => {
            p.style.display = p.dataset.panel === tab ? '' : 'none';
        });
        if (tab === 'stats') JournalStats.render();
        if (tab === 'gallery') this._renderGallery();
    },

    /* ─── Main Render ────────────────────── */
    async render() {
        const filterEl = document.getElementById('journal-filter');
        const filter   = filterEl?.value || 'all';
        const all      = await Storage.getJournal();
        let entries    = all;
        if (filter === 'tp') entries = all.filter(e => e.status === 'tp');
        if (filter === 'sl') entries = all.filter(e => e.status === 'sl');

        this._updateStats(all);

        if (this._activeTab === 'log')     this._renderLog(entries);
        if (this._activeTab === 'gallery') this._renderGallery(all);
        if (this._activeTab === 'stats')   JournalStats.render();
    },

    /* ─── Stats Bar ──────────────────────── */
    _updateStats(entries) {
        const open   = entries.filter(e => e.status === 'open').length;
        const tp     = entries.filter(e => e.status === 'tp').length;
        const sl     = entries.filter(e => e.status === 'sl').length;
        const closed = tp + sl;
        const wr     = closed > 0 ? Math.round((tp / closed) * 100) : 0;
        if (this.statOpen) this.statOpen.textContent = open;
        if (this.statTP)   this.statTP.textContent   = tp;
        if (this.statSL)   this.statSL.textContent   = sl;
        if (this.statWR)   this.statWR.textContent   = `${wr}%`;
    },

    /* ══════════════════════════════════════
       TAB 1: LOG (kartu trade)
       ══════════════════════════════════════ */
    _renderLog(entries) {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        if (entries.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state" style="margin-top:var(--space-2xl);">
                    <div class="empty-state__icon">📓</div>
                    <div class="empty-state__text">Belum ada catatan trade. Gunakan Kalkulator Trade untuk menyimpan posisi.</div>
                </div>`;
            return;
        }

        entries.forEach(entry => {
            const card = this._buildLogCard(entry);
            this.listEl.appendChild(card);
        });
    },

    _buildLogCard(entry) {
        const statusClass = { open: 'open', tp: 'closed-tp', sl: 'closed-sl' }[entry.status] || 'open';
        const statusLabel = { open: 'Open', tp: 'Hit TP ✅', sl: 'Hit SL ❌' }[entry.status] || 'Open';
        const badgeClass  = { open: 'badge--open', tp: 'badge--tp', sl: 'badge--sl' }[entry.status] || 'badge--open';

        const card = document.createElement('div');
        card.className  = `journal-entry ${statusClass}`;
        card.dataset.id = entry.id;

        /* ── Before/After image thumbnails (inline) ── */
        const beforeImg = (entry.beforeImages || [])[0];
        const afterImg  = (entry.afterImages  || [])[0];
        const hasImages = beforeImg || afterImg;

        const imagesHtml = `
            <div class="journal-entry__img-row" onclick="Journal._openModal('${entry.id}')" title="Lihat detail & upload foto">
                <div class="journal-entry__img-thumb ${beforeImg ? '' : 'journal-entry__img-thumb--empty'}">
                    <span class="journal-entry__img-label">Before</span>
                    ${beforeImg
                        ? `<img src="${this._escHtml(beforeImg.url)}" alt="Before" loading="lazy">`
                        : `<div class="journal-entry__img-placeholder">📷</div>`
                    }
                </div>
                <div class="journal-entry__img-thumb ${afterImg ? '' : 'journal-entry__img-thumb--empty'}">
                    <span class="journal-entry__img-label">After</span>
                    ${afterImg
                        ? `<img src="${this._escHtml(afterImg.url)}" alt="After" loading="lazy">`
                        : `<div class="journal-entry__img-placeholder">📷</div>`
                    }
                </div>
            </div>`;

        /* ── Action buttons ── */
        const actionBtns = entry.status === 'open' ? `
            <button class="btn-hit-tp" data-id="${entry.id}">✅ Hit TP</button>
            <button class="btn-hit-sl" data-id="${entry.id}">❌ Hit SL</button>` :
            `<span class="journal-entry__close-time">Exit: ${entry.closeTime || '—'}</span>`;

        const notesHtml   = entry.notes ? `<div class="journal-entry__notes">📝 ${this._escHtml(entry.notes)}</div>` : '';
        const emotionHtml = entry.emotion && entry.emotion !== '—' ? `<span class="emotion-chip">${this._escHtml(entry.emotion)}</span>` : '';
        const newsHtml    = (entry.newsTags || []).length > 0 ?
            `<span class="journal-entry__strategy" style="background:rgba(239,68,68,0.15);color:var(--clr-sl);border:1px solid rgba(239,68,68,0.3);">🔥 ${this._escHtml(entry.newsTags.join(', '))}</span>` : '';

        card.innerHTML = `
            <div class="journal-entry__header">
                <div class="journal-entry__title-row">
                    <span class="journal-entry__pair">${entry.pair}</span>
                    <span class="journal-entry__strategy">${this._escHtml(entry.methodName || '—')}</span>
                    ${emotionHtml}${newsHtml}
                </div>
                <span class="journal-entry__status-badge ${badgeClass}">${statusLabel}</span>
            </div>
            <div class="journal-entry__content">
                <div class="journal-entry__body">
                    <div class="journal-entry__field"><span class="journal-entry__field-label">LOT</span><span class="journal-entry__field-value lot-value">${entry.lotSize ?? '—'}</span></div>
                    <div class="journal-entry__field"><span class="journal-entry__field-label">Saldo</span><span class="journal-entry__field-value">$${entry.balance?.toLocaleString() ?? '—'}</span></div>
                    <div class="journal-entry__field"><span class="journal-entry__field-label">Risk</span><span class="journal-entry__field-value">${entry.risk ?? '—'}%</span></div>
                    <div class="journal-entry__field"><span class="journal-entry__field-label">SL</span><span class="journal-entry__field-value">${entry.slPips ?? '—'}</span></div>
                    <div class="journal-entry__field"><span class="journal-entry__field-label">TP</span><span class="journal-entry__field-value">${entry.tpPips ?? '—'}</span></div>
                    <div class="journal-entry__field"><span class="journal-entry__field-label">Loss</span><span class="journal-entry__field-value loss-value">$${entry.potentialLoss?.toFixed(2) ?? '—'}</span></div>
                    <div class="journal-entry__field"><span class="journal-entry__field-label">Profit</span><span class="journal-entry__field-value profit-value">+$${entry.potentialProfit?.toFixed(2) ?? '—'}</span></div>
                </div>
                ${imagesHtml}
            </div>
            ${notesHtml}
            <div class="journal-entry__actions">
                <div class="journal-entry__time-row">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Open: ${entry.openTime || '—'}
                </div>
                ${actionBtns}
                <button class="btn-delete-journal" data-id="${entry.id}">🗑</button>
            </div>`;

        card.querySelector('.btn-hit-tp')?.addEventListener('click', () => this.hitOutcome(entry.id, 'tp'));
        card.querySelector('.btn-hit-sl')?.addEventListener('click', () => this.hitOutcome(entry.id, 'sl'));
        card.querySelector('.btn-delete-journal')?.addEventListener('click', () => this.deleteEntry(entry.id));

        return card;
    },

    /* ══════════════════════════════════════
       TAB 2: GALERI
       ══════════════════════════════════════ */
    async _renderGallery(allEntries) {
        if (!this.galleryEl) return;
        const entries = allEntries || await Storage.getJournal();

        // Filter hanya entry yang punya gambar
        const withImages = entries.filter(e =>
            (e.beforeImages || []).length > 0 || (e.afterImages || []).length > 0
        );

        if (withImages.length === 0) {
            this.galleryEl.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;padding:var(--space-3xl) 0;">
                    <div class="empty-state__icon">🖼️</div>
                    <div class="empty-state__text">Belum ada foto setup. Upload foto saat menyimpan trade di Kalkulator.</div>
                </div>`;
            return;
        }

        this.galleryEl.innerHTML = '';
        withImages.forEach(entry => {
            const card = this._buildGalleryCard(entry);
            this.galleryEl.appendChild(card);
        });
    },

    _buildGalleryCard(entry) {
        const beforeImg = (entry.beforeImages || [])[0];
        const afterImg  = (entry.afterImages  || [])[0];
        const statusColor = { open: '#6366f1', tp: '#26a69a', sl: '#ef5350' }[entry.status] || '#6366f1';
        const statusLabel = { open: 'Open', tp: '✅ TP', sl: '❌ SL' }[entry.status] || '';

        const card = document.createElement('div');
        card.className = 'journal-gallery__card';
        card.innerHTML = `
            <div class="journal-gallery__images">
                <div class="journal-gallery__img-half">
                    ${beforeImg
                        ? `<img src="${this._escHtml(beforeImg.url)}" alt="Before" loading="lazy">`
                        : `<div class="journal-gallery__img-empty"><span>Before</span></div>`}
                    <span class="journal-gallery__img-label">Before</span>
                </div>
                <div class="journal-gallery__img-half">
                    ${afterImg
                        ? `<img src="${this._escHtml(afterImg.url)}" alt="After" loading="lazy">`
                        : `<div class="journal-gallery__img-empty"><span>After</span></div>`}
                    <span class="journal-gallery__img-label">After</span>
                </div>
            </div>
            <div class="journal-gallery__info">
                <div class="journal-gallery__pair">${entry.pair}</div>
                <div class="journal-gallery__meta">
                    <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
                    <span>${entry.openTime || '—'}</span>
                </div>
                ${entry.methodName ? `<div class="journal-gallery__method">${this._escHtml(entry.methodName)}</div>` : ''}
            </div>`;

        card.addEventListener('click', () => this._openModal(entry.id));
        return card;
    },

    /* ══════════════════════════════════════
       DETAIL MODAL
       ══════════════════════════════════════ */
    async _openModal(entryId) {
        if (!this.modal) return;
        const entries = await Storage.getJournal();
        const entry   = entries.find(e => e.id === entryId);
        if (!entry) return;

        const content = this.modal.querySelector('#journal-modal-content');
        if (!content) return;

        const statusLabel = { open: '<span style="color:#6366f1">⬤ Open</span>', tp: '<span style="color:#26a69a">✅ Hit TP</span>', sl: '<span style="color:#ef5350">❌ Hit SL</span>' }[entry.status] || '';

        /* ── Build before images ── */
        const beforeImgs = (entry.beforeImages || []);
        const afterImgs  = (entry.afterImages  || []);

        const imgSection = (imgs, label, type, entryId) => {
            if (imgs.length === 0) return `
                <div class="modal-img-section">
                    <div class="modal-img-section__title">${label}</div>
                    <div class="modal-img-upload-zone" data-type="${type}" data-entry="${entryId}">
                        <input type="file" accept="image/*" multiple class="modal-img-input" data-type="${type}" style="display:none">
                        <button class="modal-img-upload-btn" onclick="this.previousElementSibling.click()">
                            📷 Upload Foto ${label}
                        </button>
                    </div>
                </div>`;

            return `
                <div class="modal-img-section">
                    <div class="modal-img-section__title">${label}</div>
                    <div class="modal-img-grid">
                        ${imgs.map((img, i) => `
                            <div class="modal-img-item" onclick="Journal._openLightbox(${JSON.stringify([...beforeImgs, ...afterImgs]).replace(/"/g, '&quot;')}, ${i + (label === 'After' ? beforeImgs.length : 0)})">
                                <img src="${this._escHtml(img.url)}" alt="${label} ${i+1}" loading="lazy">
                            </div>`).join('')}
                        ${imgs.length < ImageUpload.getLimits()[type] ? `
                        <div class="modal-img-add" data-type="${type}" data-entry="${entryId}">
                            <input type="file" accept="image/*" class="modal-img-input" data-type="${type}" style="display:none">
                            <button onclick="this.previousElementSibling.click()">+ Foto</button>
                        </div>` : ''}
                    </div>
                </div>`;
        };

        content.innerHTML = `
            <div class="journal-modal__header">
                <div class="journal-modal__pair">${entry.pair} — ${entry.methodName || 'No Method'}</div>
                <div class="journal-modal__status">${statusLabel}</div>
            </div>

            <div class="journal-modal__images">
                ${imgSection(beforeImgs, 'Before (Setup)', 'before', entryId)}
                ${imgSection(afterImgs,  'After (Hasil)',  'after',  entryId)}
            </div>

            <div class="journal-modal__details">
                <div class="journal-modal__row"><span>Open Time</span><strong>${entry.openTime || '—'}</strong></div>
                <div class="journal-modal__row"><span>Close Time</span><strong>${entry.closeTime || '—'}</strong></div>
                <div class="journal-modal__row"><span>Balance</span><strong>$${entry.balance?.toLocaleString() ?? '—'}</strong></div>
                <div class="journal-modal__row"><span>Risk</span><strong>${entry.risk ?? '—'}%</strong></div>
                <div class="journal-modal__row"><span>Lot Size</span><strong>${entry.lotSize ?? '—'}</strong></div>
                <div class="journal-modal__row"><span>SL (pips)</span><strong>${entry.slPips ?? '—'}</strong></div>
                <div class="journal-modal__row"><span>TP (pips)</span><strong>${entry.tpPips ?? '—'}</strong></div>
                <div class="journal-modal__row"><span>Pot. Loss</span><strong class="loss-value">$${entry.potentialLoss?.toFixed(2) ?? '—'}</strong></div>
                <div class="journal-modal__row"><span>Pot. Profit</span><strong class="profit-value">+$${entry.potentialProfit?.toFixed(2) ?? '—'}</strong></div>
                ${entry.emotion ? `<div class="journal-modal__row"><span>Emosi</span><strong>${this._escHtml(entry.emotion)}</strong></div>` : ''}
                ${(entry.newsTags||[]).length > 0 ? `<div class="journal-modal__row"><span>News</span><strong style="color:var(--clr-sl)">${this._escHtml(entry.newsTags.join(', '))}</strong></div>` : ''}
            </div>

            ${entry.notes ? `<div class="journal-modal__notes">📝 ${this._escHtml(entry.notes)}</div>` : ''}`;

        // Bind upload handlers di modal
        content.querySelectorAll('.modal-img-input').forEach(input => {
            input.addEventListener('change', () => this._handleModalUpload(input, entry));
        });

        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    _closeModal() {
        if (!this.modal) return;
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    /* ─── Upload dari Modal ──────────────── */
    async _handleModalUpload(input, entry) {
        const type  = input.dataset.type; // 'before' | 'after'
        const files = Array.from(input.files || []);
        if (files.length === 0) return;

        const limits   = ImageUpload.getLimits();
        const existing = type === 'before' ? (entry.beforeImages || []) : (entry.afterImages || []);
        const maxCount = limits[type] || 2;

        if (existing.length + files.length > maxCount) {
            App.showToast(`Maksimal ${maxCount} foto ${type} (plan ${Auth?.currentUser?.plan || 'free'}).`, 'error');
            return;
        }

        App.showToast('Mengupload foto...', 'success');
        try {
            const uploaded = await ImageUpload.uploadMultiple(files, entry.id, type);
            const newImages = [...existing, ...uploaded];

            const update = type === 'before'
                ? { ...entry, beforeImages: newImages }
                : { ...entry, afterImages:  newImages };

            await Storage.saveJournalEntry(update);
            App.showToast(`${files.length} foto ${type} berhasil diupload!`, 'success');

            // Refresh list kartu jurnal agar gambar langsung muncul
            await this.render();
            // Refresh modal juga
            this._openModal(entry.id);
        } catch (err) {
            App.showToast('Gagal upload: ' + err.message, 'error');
        }
        input.value = '';
    },

    /* ─── Lightbox ───────────────────────── */
    _lightboxIndex: 0,
    _lightboxImages: [],

    _openLightbox(images, startIndex = 0) {
        this._lightboxImages = images;
        this._lightboxIndex  = startIndex;
        this._showLightboxFrame();
    },

    _showLightboxFrame() {
        const lb = document.getElementById('journal-lightbox');
        if (!lb) return;
        const img = this._lightboxImages[this._lightboxIndex];
        const imgEl  = lb.querySelector('#lb-image');
        const counter= lb.querySelector('#lb-counter');
        if (imgEl) imgEl.src = img?.url || '';
        if (counter) counter.textContent = `${this._lightboxIndex + 1} / ${this._lightboxImages.length}`;
        lb.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    lightboxPrev() {
        this._lightboxIndex = (this._lightboxIndex - 1 + this._lightboxImages.length) % this._lightboxImages.length;
        this._showLightboxFrame();
    },
    lightboxNext() {
        this._lightboxIndex = (this._lightboxIndex + 1) % this._lightboxImages.length;
        this._showLightboxFrame();
    },
    lightboxClose() {
        const lb = document.getElementById('journal-lightbox');
        if (lb) lb.classList.remove('active');
        document.body.style.overflow = '';
    },

    /* ─── Hit TP/SL ──────────────────────── */
    async hitOutcome(id, outcome) {
        const now = new Date();
        const hh  = String(now.getHours()).padStart(2,'0');
        const mm  = String(now.getMinutes()).padStart(2,'0');
        const dt  = now.toISOString().slice(0,10);
        const result = await Storage.updateJournalEntry(id, { status: outcome, closeTime: `${hh}:${mm}`, closeDate: dt });
        if (result === null) {
            App.showToast('Gagal menyimpan hasil trade. Coba lagi.', 'error');
            return;
        }
        App.showToast(outcome === 'tp' ? '✅ Take Profit dicatat!' : '❌ Stop Loss dicatat!', outcome === 'tp' ? 'success' : 'error');
        await this.render();
    },

    /* ─── Delete ─────────────────────────── */
    async deleteEntry(id) {
        if (!confirm('Hapus catatan trade ini? Foto juga akan dihapus.')) return;
        await Storage.deleteJournalEntry(id);
        App.showToast('Catatan dihapus.', 'error');
    },

    /* ─── Export CSV ─────────────────────── */
    async exportCSV() {
        const check = await PlanLimits.check('exportCSV');
        if (!check.allowed) { App.showToast(check.message, 'error'); return; }
        const entries = await Storage.getJournal();
        const closed  = entries.filter(e => e.status === 'tp' || e.status === 'sl');
        if (closed.length === 0) { App.showToast('Belum ada data trade untuk di-export.', 'error'); return; }

        const headers = ['Tanggal','Pair','Metode','Lot','SL Pips','TP Pips','Status','Loss ($)','Profit ($)','Emosi','Catatan','Before Foto','After Foto'];
        const rows = closed.map(e => {
            const date = new Date(e.createdAt).toLocaleDateString('id-ID');
            return [
                date, e.pair||'', e.methodName||'', e.lotSize||'',
                e.slPips||'', e.tpPips||'',
                e.status === 'tp' ? 'TP (Win)' : 'SL (Loss)',
                e.potentialLoss ? e.potentialLoss.toFixed(2) : '0',
                e.potentialProfit ? e.potentialProfit.toFixed(2) : '0',
                e.emotion||'', (e.notes||'').replace(/"/g,'""'),
                (e.beforeImages||[]).map(i=>i.url).join('|'),
                (e.afterImages ||[]).map(i=>i.url).join('|'),
            ].map(v=>`"${v}"`).join(',');
        });

        const csv  = [headers.join(','),...rows].join('\n');
        const blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `fortrader_journal_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        App.showToast('✅ Data berhasil di-export ke CSV!', 'success');
    },

    async clearAllData() {
        if (!confirm('Hapus SEMUA catatan jurnal? Foto juga akan dihapus.')) return;
        const entries = await Storage.getJournal();
        await Promise.all(entries.map(e => Storage.deleteJournalEntry(e.id)));
        App.showToast('Semua catatan jurnal telah dihapus.', 'error');
    },

    _escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
