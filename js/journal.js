/* ========================================
   JOURNAL.JS – Trade Journal Page
   ======================================== */

const Journal = {

    init() {
        this.listEl = document.getElementById('journal-list');
        this.statOpen = document.getElementById('journal-stat-open');
        this.statTP = document.getElementById('journal-stat-tp');
        this.statSL = document.getElementById('journal-stat-sl');
        this.statWR = document.getElementById('journal-stat-wr');
        this.render();
    },

    render() {
        const entries = Storage.getJournal();
        this._updateStats(entries);

        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        if (entries.length === 0) {
            this.listEl.innerHTML = `
        <div class="empty-state" style="margin-top: var(--space-2xl);">
          <div class="empty-state__icon">📓</div>
          <div class="empty-state__text">Belum ada catatan trade. Gunakan Kalkulator Trade untuk menyimpan posisi.</div>
        </div>`;
            return;
        }

        entries.forEach(entry => {
            const card = this._buildCard(entry);
            this.listEl.appendChild(card);
        });
    },

    _updateStats(entries) {
        const open = entries.filter(e => e.status === 'open').length;
        const tp = entries.filter(e => e.status === 'tp').length;
        const sl = entries.filter(e => e.status === 'sl').length;
        const closed = tp + sl;
        const wr = closed > 0 ? Math.round((tp / closed) * 100) : 0;

        if (this.statOpen) this.statOpen.textContent = open;
        if (this.statTP) this.statTP.textContent = tp;
        if (this.statSL) this.statSL.textContent = sl;
        if (this.statWR) this.statWR.textContent = `${wr}%`;
    },

    _buildCard(entry) {
        const statusClass = entry.status === 'open' ? 'open'
            : entry.status === 'tp' ? 'closed-tp'
                : 'closed-sl';

        const statusLabel = entry.status === 'open' ? 'Open'
            : entry.status === 'tp' ? 'Hit TP ✅'
                : 'Hit SL ❌';

        const badgeClass = entry.status === 'open' ? 'badge--open'
            : entry.status === 'tp' ? 'badge--tp'
                : 'badge--sl';

        const card = document.createElement('div');
        card.className = `journal-entry ${statusClass}`;
        card.dataset.id = entry.id;

        const actionBtns = entry.status === 'open' ? `
      <button class="btn-hit-tp" data-id="${entry.id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Hit TP
      </button>
      <button class="btn-hit-sl" data-id="${entry.id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Hit SL
      </button>
    ` : `
      <span class="journal-entry__field-value" style="font-size:0.8rem;">
        Exit: ${entry.closeTime || '—'}
      </span>
    `;

        const notesHtml = entry.notes
            ? `<div class="journal-entry__notes">📝 <span>${this._escHtml(entry.notes)}</span></div>`
            : '';

        const emotionHtml = entry.emotion && entry.emotion !== '—'
            ? `<span class="emotion-chip">${this._escHtml(entry.emotion)}</span>`
            : '';

        card.innerHTML = `
      <div class="journal-entry__header">
        <div class="journal-entry__title-row">
          <span class="journal-entry__pair">${entry.pair}</span>
          <span class="journal-entry__strategy">${this._escHtml(entry.methodName)}</span>
          ${emotionHtml}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="journal-entry__status-badge ${badgeClass}">${statusLabel}</span>
        </div>
      </div>

      <div class="journal-entry__body">
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">LOT Size</span>
          <span class="journal-entry__field-value lot-value">${entry.lotSize}</span>
        </div>
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">Saldo</span>
          <span class="journal-entry__field-value">$${entry.balance?.toLocaleString()}</span>
        </div>
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">Risk</span>
          <span class="journal-entry__field-value">${entry.risk}%</span>
        </div>
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">SL (pips)</span>
          <span class="journal-entry__field-value">${entry.slPips}</span>
        </div>
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">TP (pips)</span>
          <span class="journal-entry__field-value">${entry.tpPips}</span>
        </div>
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">Pot. Loss</span>
          <span class="journal-entry__field-value loss-value">$${entry.potentialLoss?.toFixed(2)}</span>
        </div>
        <div class="journal-entry__field">
          <span class="journal-entry__field-label">Pot. Profit</span>
          <span class="journal-entry__field-value profit-value">+$${entry.potentialProfit?.toFixed(2)}</span>
        </div>
      </div>

      ${notesHtml}

      <div class="journal-entry__actions">
        <div class="journal-entry__time-row">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Open: ${entry.openTime || '—'}
        </div>
        ${actionBtns}
        <button class="btn-delete-journal" data-id="${entry.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Hapus
        </button>
      </div>
    `;

        // Events
        const hitTP = card.querySelector('.btn-hit-tp');
        const hitSL = card.querySelector('.btn-hit-sl');
        const delBtn = card.querySelector('.btn-delete-journal');

        if (hitTP) hitTP.addEventListener('click', () => this.hitOutcome(entry.id, 'tp'));
        if (hitSL) hitSL.addEventListener('click', () => this.hitOutcome(entry.id, 'sl'));
        if (delBtn) delBtn.addEventListener('click', () => this.deleteEntry(entry.id));

        return card;
    },

    hitOutcome(id, outcome) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const closeTime = `${hh}:${mm}`;

        Storage.updateJournalEntry(id, {
            status: outcome,
            closeTime,
        });

        this.render();
        const label = outcome === 'tp' ? '✅ Take Profit dicatat!' : '❌ Stop Loss dicatat!';
        App.showToast(label, outcome === 'tp' ? 'success' : 'error');
    },

    deleteEntry(id) {
        if (confirm('Hapus catatan trade ini?')) {
            Storage.deleteJournalEntry(id);
            this.render();
            App.showToast('Catatan dihapus.', 'error');
        }
    },

    _escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    },
};
