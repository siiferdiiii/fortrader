/* ========================================
   MIGRATE-LOCAL.JS — One-time LocalStorage → Supabase Migration
   
   Dijalankan otomatis saat user pertama kali
   login setelah update ke Supabase.
   
   Cara kerja:
   1. Cek apakah ada data lama di localStorage
   2. Jika ada, tawarkan user untuk migrasi
   3. Upload data ke Supabase
   4. Hapus data lama dari localStorage
   ======================================== */

const MigrateLocal = {

    LEGACY_KEYS: {
        methods:  'ft_methods',
        sessions: 'ft_sessions',
        journal:  'ft_journal',
        active:   'ft_active_session',
    },

    MIGRATION_FLAG: 'ft_migrated_to_supabase',

    /**
     * Dipanggil setelah user login.
     * Cek apakah ada data lama di localStorage yang belum dimigrasi.
     */
    async check() {
        // Jika sudah pernah migrasi, skip
        if (localStorage.getItem(this.MIGRATION_FLAG)) return;

        // Cek data lama
        const legacy = this._readLegacyData();
        const total  = legacy.methods.length + legacy.sessions.length + legacy.journal.length;

        if (total === 0) {
            // Tidak ada data lama — tandai sudah "migrasi"
            localStorage.setItem(this.MIGRATION_FLAG, '1');
            return;
        }

        // Tampilkan banner migrasi
        this._showBanner(legacy, total);
    },

    /**
     * Baca data lama dari localStorage (format lama dengan camelCase)
     */
    _readLegacyData() {
        const parse = (key) => {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : [];
            } catch { return []; }
        };

        return {
            methods:  parse(this.LEGACY_KEYS.methods),
            sessions: parse(this.LEGACY_KEYS.sessions),
            journal:  parse(this.LEGACY_KEYS.journal),
        };
    },

    /**
     * Tampilkan banner migration di atas halaman
     */
    _showBanner(legacy, total) {
        if (document.getElementById('migration-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'migration-banner';
        banner.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #1a1f35, #252b45);
            border: 1px solid rgba(99,102,241,0.4);
            border-radius: 12px; padding: 16px 20px;
            color: #d1d4dc; font-family: 'Inter', sans-serif;
            font-size: 13px; z-index: 99999;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            max-width: 420px; width: calc(100% - 32px);
            display: flex; flex-direction: column; gap: 10px;
        `;
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;color:#a5b4fc;">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Data Trading Lokal Terdeteksi
            </div>
            <div style="color:#94a3b8;line-height:1.5;">
                Ditemukan <strong style="color:#d1d4dc;">${total} item</strong> 
                (${legacy.methods.length} metode, ${legacy.sessions.length} sesi, ${legacy.journal.length} jurnal)
                yang tersimpan di browser ini. Upload ke cloud agar bisa diakses dari semua perangkat?
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="migrate-confirm-btn" style="
                    background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    border:none;border-radius:7px;padding:8px 16px;
                    color:#fff;font-size:12px;font-weight:600;cursor:pointer;flex:1;
                ">☁️ Upload ke Cloud</button>
                <button id="migrate-skip-btn" style="
                    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
                    border-radius:7px;padding:8px 12px;
                    color:#94a3b8;font-size:12px;cursor:pointer;
                ">Nanti</button>
                <button id="migrate-dismiss-btn" style="
                    background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
                    border-radius:7px;padding:8px 12px;
                    color:#f87171;font-size:12px;cursor:pointer;
                ">Hapus Data Lama</button>
            </div>
            <div id="migrate-progress" style="display:none;color:#6366f1;font-size:12px;text-align:center;"></div>
        `;

        document.body.appendChild(banner);

        document.getElementById('migrate-confirm-btn').addEventListener('click',  () => this.runMigration(legacy, banner));
        document.getElementById('migrate-skip-btn').addEventListener('click',    () => banner.remove());
        document.getElementById('migrate-dismiss-btn').addEventListener('click', () => this._discardLegacy(banner));
    },

    /**
     * Jalankan proses migrasi data ke Supabase
     */
    async runMigration(legacy, banner) {
        const confirmBtn  = document.getElementById('migrate-confirm-btn');
        const progress    = document.getElementById('migrate-progress');
        if (confirmBtn)  confirmBtn.disabled = true;
        if (progress)    { progress.style.display = 'block'; progress.textContent = 'Memulai migrasi...'; }

        let successCount = 0;
        let errorCount   = 0;

        try {
            // Migrate methods
            if (legacy.methods.length > 0) {
                if (progress) progress.textContent = `Mengupload ${legacy.methods.length} metode...`;
                for (const m of legacy.methods) {
                    try {
                        await Storage.saveMethod(m);
                        successCount++;
                    } catch { errorCount++; }
                }
            }

            // Migrate sessions
            if (legacy.sessions.length > 0) {
                if (progress) progress.textContent = `Mengupload ${legacy.sessions.length} sesi backtest...`;
                for (const s of legacy.sessions) {
                    try {
                        await Storage.saveSession(s);
                        successCount++;
                    } catch { errorCount++; }
                }
            }

            // Migrate journal
            if (legacy.journal.length > 0) {
                if (progress) progress.textContent = `Mengupload ${legacy.journal.length} entri jurnal...`;
                for (const j of legacy.journal) {
                    try {
                        await Storage.saveJournalEntry(j);
                        successCount++;
                    } catch { errorCount++; }
                }
            }

            // Tandai migrasi selesai
            localStorage.setItem(this.MIGRATION_FLAG, '1');

            // Hapus data lama dari localStorage
            this._clearLegacyKeys();

            if (progress) {
                progress.style.color = '#10b981';
                progress.textContent = `✅ Migrasi selesai! ${successCount} item berhasil diupload.`;
            }

            if (typeof App !== 'undefined') {
                App.showToast(`☁️ ${successCount} data berhasil diupload ke cloud!`, 'success');
            }

            setTimeout(() => banner?.remove(), 3000);

        } catch (err) {
            console.error('[MigrateLocal] Migration error:', err);
            if (progress) {
                progress.style.color = '#ef4444';
                progress.textContent = `❌ Terjadi error. ${successCount} berhasil, ${errorCount} gagal.`;
            }
            if (confirmBtn) confirmBtn.disabled = false;
        }
    },

    /**
     * Hapus data lama tanpa mengupload
     */
    _discardLegacy(banner) {
        if (!confirm('Yakin hapus semua data lama dari browser ini? Data tidak akan di-upload ke cloud.')) return;
        this._clearLegacyKeys();
        localStorage.setItem(this.MIGRATION_FLAG, '1');
        banner?.remove();
        if (typeof App !== 'undefined') App.showToast('Data lokal lama telah dihapus.', 'error');
    },

    _clearLegacyKeys() {
        Object.values(this.LEGACY_KEYS).forEach(k => localStorage.removeItem(k));
    },
};

// Auto-check setelah Supabase auth state change (user login)
// Hanya jika modul sudah ter-load
window.DB?.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        // Delay sedikit agar Storage._uid() sudah ter-set
        setTimeout(() => MigrateLocal.check(), 1500);
    }
});
