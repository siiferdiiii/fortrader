/* ========================================
   METHODS.JS - Metode Trading CRUD & UI
   ======================================== */

const Methods = {
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.render();
    },

    cacheDOM() {
        this.grid = document.getElementById('methods-grid');
        this.addBtn = document.getElementById('btn-add-method');
        this.modalOverlay = document.getElementById('method-modal-overlay');
        this.modalTitle = document.getElementById('method-modal-title');
        this.modalClose = document.getElementById('method-modal-close');
        this.modalCancel = document.getElementById('method-modal-cancel');
        this.form = document.getElementById('method-form');
        this.editIdInput = document.getElementById('method-edit-id');
        this.nameInput = document.getElementById('method-name');
        this.entryInput = document.getElementById('method-entry');
        this.exitInput = document.getElementById('method-exit');
    },

    bindEvents() {
        this.addBtn.addEventListener('click', () => this.openModal());

        // Also wire the toolbar shortcut button (page-toolbar__action)
        const toolbarAddBtn = document.getElementById('btn-add-method-toolbar');
        if (toolbarAddBtn) toolbarAddBtn.addEventListener('click', () => this.openModal());

        this.modalClose.addEventListener('click', () => this.closeModal());
        this.modalCancel.addEventListener('click', () => this.closeModal());
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.closeModal();
        });
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });
    },

    openModal(method = null) {
        if (method) {
            this.modalTitle.textContent = 'Edit Metode';
            this.editIdInput.value = method.id;
            this.nameInput.value = method.name;
            this.entryInput.value = method.sopEntry;
            this.exitInput.value = method.sopExit;
        } else {
            this.modalTitle.textContent = 'Tambah Metode';
            this.editIdInput.value = '';
            this.form.reset();
        }
        this.modalOverlay.classList.add('active');
        this.nameInput.focus();
    },

    closeModal() {
        this.modalOverlay.classList.remove('active');
        this.form.reset();
        this.editIdInput.value = '';
    },

    handleSave() {
        const id = this.editIdInput.value || Storage.generateId();
        const method = {
            id,
            name: this.nameInput.value.trim(),
            sopEntry: this.entryInput.value.trim(),
            sopExit: this.exitInput.value.trim(),
            createdAt: this.editIdInput.value
                ? (Storage.getMethods().find(m => m.id === id)?.createdAt || new Date().toISOString())
                : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        Storage.saveMethod(method);
        this.closeModal();
        this.render();
        App.showToast(this.editIdInput.value ? 'Metode berhasil diperbarui!' : 'Metode berhasil ditambahkan!', 'success');

        // Refresh method dropdown in backtest
        if (typeof Backtest !== 'undefined') {
            Backtest.populateMethodDropdown();
        }
    },

    deleteMethod(id) {
        if (confirm('Yakin ingin menghapus metode ini?')) {
            Storage.deleteMethod(id);
            this.render();
            App.showToast('Metode berhasil dihapus.', 'error');
            if (typeof Backtest !== 'undefined') {
                Backtest.populateMethodDropdown();
            }
        }
    },

    render() {
        const methods = Storage.getMethods();
        // Keep the add button, remove old cards
        const existingCards = this.grid.querySelectorAll('.method-card');
        existingCards.forEach(c => c.remove());

        methods.forEach(method => {
            const card = document.createElement('div');
            card.className = 'method-card';
            card.innerHTML = `
        <div class="method-card__name">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${this.escapeHtml(method.name)}
        </div>
        <div class="method-card__section">
          <div class="method-card__section-title">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Entry Rules
          </div>
          <div class="method-card__section-content">${this.escapeHtml(method.sopEntry)}</div>
        </div>
        <div class="method-card__section">
          <div class="method-card__section-title">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Exit Rules
          </div>
          <div class="method-card__section-content">${this.escapeHtml(method.sopExit)}</div>
        </div>
        <div class="method-card__actions">
          <button class="btn btn--secondary btn--sm btn-edit-method" data-id="${method.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn--danger btn--sm btn-delete-method" data-id="${method.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Hapus
          </button>
        </div>
      `;

            // Events
            card.querySelector('.btn-edit-method').addEventListener('click', () => {
                this.openModal(method);
            });
            card.querySelector('.btn-delete-method').addEventListener('click', () => {
                this.deleteMethod(method.id);
            });

            this.grid.appendChild(card);
        });
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
