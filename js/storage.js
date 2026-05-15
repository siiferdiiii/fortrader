/* ========================================
   STORAGE.JS — Supabase Database Layer
   Menggantikan localStorage dengan Supabase
   PostgreSQL + Realtime subscriptions.
   Semua method async.
   ======================================== */

const Storage = {

    /* ── Helpers ─────────────────────────── */
    _uid() {
        const session = window._supabaseSession;
        return session?.user?.id || null;
    },

    _db() {
        return window.DB; // supabase client dari supabase-client.js
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    },

    /* ── Error handler ───────────────────── */
    _handleError(label, error) {
        console.error(`[Storage] ${label}:`, error?.message || error);
        return null;
    },

    /* ══════════════════════════════════════
       TRADING METHODS
       ══════════════════════════════════════ */
    async getMethods() {
        const uid = this._uid();
        if (!uid) return [];
        const { data, error } = await this._db()
            .from('trading_methods')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: true });
        if (error) { this._handleError('getMethods', error); return []; }
        // Normalize ke format lama (camelCase)
        return (data || []).map(r => ({
            id: r.id,
            name: r.name,
            sopEntry: r.sop_entry,
            sopExit: r.sop_exit,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
    },

    async saveMethod(method) {
        const uid = this._uid();
        if (!uid) return null;
        const { error } = await this._db()
            .from('trading_methods')
            .upsert({
                id: method.id,
                user_id: uid,
                name: method.name,
                sop_entry: method.sopEntry || '',
                sop_exit: method.sopExit || '',
            }, { onConflict: 'id' });
        if (error) return this._handleError('saveMethod', error);
        return method;
    },

    async deleteMethod(id) {
        const uid = this._uid();
        if (!uid) return;
        const { error } = await this._db()
            .from('trading_methods')
            .delete()
            .eq('id', id)
            .eq('user_id', uid);
        if (error) this._handleError('deleteMethod', error);
    },

    /* ══════════════════════════════════════
       BACKTEST SESSIONS
       ══════════════════════════════════════ */
    async getSessions() {
        const uid = this._uid();
        if (!uid) return [];
        const { data, error } = await this._db()
            .from('backtest_sessions')
            .select('*')
            .eq('user_id', uid)
            .eq('is_active', false)
            .order('created_at', { ascending: false });
        if (error) { this._handleError('getSessions', error); return []; }
        return (data || []).map(r => this._sessionFromRow(r));
    },

    async saveSession(session) {
        const uid = this._uid();
        if (!uid) return null;
        const { error } = await this._db()
            .from('backtest_sessions')
            .upsert(this._sessionToRow(session, uid, false), { onConflict: 'id' });
        if (error) return this._handleError('saveSession', error);
        return session;
    },

    async deleteSession(id) {
        const uid = this._uid();
        if (!uid) return;
        const { error } = await this._db()
            .from('backtest_sessions')
            .delete()
            .eq('id', id)
            .eq('user_id', uid);
        if (error) this._handleError('deleteSession', error);
    },

    /* ── Active Session (sesi sedang berjalan) ── */
    async getActiveSession() {
        const uid = this._uid();
        if (!uid) return null;
        const { data, error } = await this._db()
            .from('backtest_sessions')
            .select('*')
            .eq('user_id', uid)
            .eq('is_active', true)
            .maybeSingle();
        if (error) { this._handleError('getActiveSession', error); return null; }
        return data ? this._sessionFromRow(data) : null;
    },

    async setActiveSession(session) {
        const uid = this._uid();
        if (!uid) return null;
        // Pastikan hanya 1 sesi aktif: nonaktifkan yang lain
        await this._db()
            .from('backtest_sessions')
            .update({ is_active: false })
            .eq('user_id', uid)
            .eq('is_active', true)
            .neq('id', session.id);
        const { error } = await this._db()
            .from('backtest_sessions')
            .upsert(this._sessionToRow(session, uid, true), { onConflict: 'id' });
        if (error) return this._handleError('setActiveSession', error);
        return session;
    },

    async clearActiveSession() {
        const uid = this._uid();
        if (!uid) return;
        const { error } = await this._db()
            .from('backtest_sessions')
            .update({ is_active: false })
            .eq('user_id', uid)
            .eq('is_active', true);
        if (error) this._handleError('clearActiveSession', error);
    },

    /* ── Session row converters ── */
    _sessionToRow(s, uid, isActive) {
        return {
            id: s.id,
            user_id: uid,
            name: s.name,
            pair: s.pair,
            method_id: s.methodId || null,
            method_name: s.methodName || '',
            initial_balance: s.initialBalance,
            current_balance: s.currentBalance,
            risk_pct: s.riskPct,
            rr: s.rr,
            trades: s.trades || [],
            is_active: isActive,
        };
    },

    _sessionFromRow(r) {
        return {
            id: r.id,
            name: r.name,
            pair: r.pair,
            methodId: r.method_id,
            methodName: r.method_name,
            initialBalance: parseFloat(r.initial_balance),
            currentBalance: parseFloat(r.current_balance),
            riskPct: parseFloat(r.risk_pct),
            rr: parseFloat(r.rr),
            trades: r.trades || [],
            createdAt: r.created_at,
        };
    },

    /* ══════════════════════════════════════
       JOURNAL ENTRIES
       ══════════════════════════════════════ */
    async getJournal() {
        const uid = this._uid();
        if (!uid) return [];
        const { data, error } = await this._db()
            .from('journal_entries')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });
        if (error) { this._handleError('getJournal', error); return []; }
        return (data || []).map(r => this._journalFromRow(r));
    },

    async saveJournalEntry(entry) {
        const uid = this._uid();
        if (!uid) return null;
        const { error } = await this._db()
            .from('journal_entries')
            .upsert(this._journalToRow(entry, uid), { onConflict: 'id' });
        if (error) return this._handleError('saveJournalEntry', error);
        return entry;
    },

    async updateJournalEntry(id, updates) {
        const uid = this._uid();
        if (!uid) return null;
        // Fetch existing dulu, lalu merge
        const { data: existing } = await this._db()
            .from('journal_entries')
            .select('*')
            .eq('id', id)
            .eq('user_id', uid)
            .maybeSingle();
        if (!existing) return null;
        const merged = { ...this._journalFromRow(existing), ...updates };
        const { error } = await this._db()
            .from('journal_entries')
            .update(this._journalToRow(merged, uid))
            .eq('id', id)
            .eq('user_id', uid);
        if (error) return this._handleError('updateJournalEntry', error);
        return merged;
    },

    async deleteJournalEntry(id) {
        const uid = this._uid();
        if (!uid) return;

        // Hapus gambar dari Storage dulu sebelum delete entry
        try {
            const { data: entry } = await this._db()
                .from('journal_entries')
                .select('before_images, after_images')
                .eq('id', id)
                .eq('user_id', uid)
                .maybeSingle();

            if (entry) {
                const allPaths = [
                    ...(entry.before_images || []).map(img => img.path).filter(Boolean),
                    ...(entry.after_images  || []).map(img => img.path).filter(Boolean),
                ];
                if (allPaths.length > 0 && typeof ImageUpload !== 'undefined') {
                    await ImageUpload.deleteImages(allPaths);
                }
            }
        } catch (e) {
            console.warn('[Storage] Could not delete images:', e);
        }

        const { error } = await this._db()
            .from('journal_entries')
            .delete()
            .eq('id', id)
            .eq('user_id', uid);
        if (error) this._handleError('deleteJournalEntry', error);
    },

    /* ── Journal row converters ── */
    _journalToRow(e, uid) {
        return {
            id: e.id,
            user_id: uid,
            pair: e.pair,
            method_name: e.methodName || '',
            method_id: e.methodId || null,
            open_time: e.openTime || null,
            close_time: e.closeTime || null,
            close_date: e.closeDate || null,
            balance: e.balance || null,
            risk: e.risk || null,
            lot_size: e.lotSize || null,
            sl_pips: e.slPips || null,
            tp_pips: e.tpPips || null,
            potential_loss: e.potentialLoss || null,
            potential_profit: e.potentialProfit || null,
            actual_result: e.actualResult || null,
            emotion: e.emotion || null,
            notes: e.notes || '',
            sop_entry_checked: e.sopEntryChecked || [],
            sop_exit_checked: e.sopExitChecked || [],
            news_tags: e.newsTags || [],
            status: e.status || 'open',
            before_images: e.beforeImages || [],
            after_images: e.afterImages || [],
        };
    },

    _journalFromRow(r) {
        return {
            id: r.id,
            pair: r.pair,
            methodName: r.method_name,
            methodId: r.method_id,
            openTime: r.open_time,
            closeTime: r.close_time,
            closeDate: r.close_date,
            balance: r.balance ? parseFloat(r.balance) : null,
            risk: r.risk ? parseFloat(r.risk) : null,
            lotSize: r.lot_size ? parseFloat(r.lot_size) : null,
            slPips: r.sl_pips ? parseFloat(r.sl_pips) : null,
            tpPips: r.tp_pips ? parseFloat(r.tp_pips) : null,
            potentialLoss: r.potential_loss ? parseFloat(r.potential_loss) : null,
            potentialProfit: r.potential_profit ? parseFloat(r.potential_profit) : null,
            actualResult: r.actual_result ? parseFloat(r.actual_result) : null,
            emotion: r.emotion,
            notes: r.notes,
            sopEntryChecked: r.sop_entry_checked || [],
            sopExitChecked: r.sop_exit_checked || [],
            newsTags: r.news_tags || [],
            status: r.status,
            beforeImages: r.before_images || [],
            afterImages: r.after_images || [],
            createdAt: r.created_at,
        };
    },

    /* ══════════════════════════════════════
       CALENDAR (tetap localStorage — cache publik)
       ══════════════════════════════════════ */
    getCalendarData() {
        try {
            const raw = localStorage.getItem('ft_calendar_cache');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    saveCalendarData(data) {
        try {
            localStorage.setItem('ft_calendar_cache', JSON.stringify({
                timestamp: Date.now(),
                events: data,
            }));
        } catch { /* ignore */ }
    },

    /* ══════════════════════════════════════
       REALTIME SUBSCRIPTIONS
       ══════════════════════════════════════ */
    _channels: {},

    subscribeToMethods(callback) {
        const uid = this._uid();
        if (!uid) return;
        if (this._channels.methods) this._channels.methods.unsubscribe();
        this._channels.methods = this._db()
            .channel('methods-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trading_methods',
                filter: `user_id=eq.${uid}`,
            }, () => callback())
            .subscribe();
    },

    subscribeToJournal(callback) {
        const uid = this._uid();
        if (!uid) return;
        if (this._channels.journal) this._channels.journal.unsubscribe();
        this._channels.journal = this._db()
            .channel('journal-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'journal_entries',
                filter: `user_id=eq.${uid}`,
            }, () => callback())
            .subscribe();
    },

    subscribeToSessions(callback) {
        const uid = this._uid();
        if (!uid) return;
        if (this._channels.sessions) this._channels.sessions.unsubscribe();
        this._channels.sessions = this._db()
            .channel('sessions-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'backtest_sessions',
                filter: `user_id=eq.${uid}`,
            }, () => callback())
            .subscribe();
    },

    unsubscribeAll() {
        Object.values(this._channels).forEach(ch => {
            try { ch.unsubscribe(); } catch { /* ignore */ }
        });
        this._channels = {};
    },

    /* ══════════════════════════════════════
       PUBLIC PROFILE METHODS
       ══════════════════════════════════════ */

    /** Simpan profil publik user (username, bio, privacy toggles) */
    async updateProfile({ username, bio, isJournalPublic, isMethodsPublic }) {
        const uid = this._uid();
        if (!uid) return null;
        const { error } = await this._db()
            .from('user_profiles')
            .update({
                username:           username   || null,
                bio:                bio        || '',
                is_journal_public:  !!isJournalPublic,
                is_methods_public:  !!isMethodsPublic,
                updated_at:         new Date().toISOString(),
            })
            .eq('id', uid);
        if (error) return this._handleError('updateProfile', error);
        return true;
    },

    /** Ambil profil publik berdasarkan username (tanpa auth) */
    async getPublicProfile(username) {
        const { data, error } = await this._db()
            .from('user_profiles')
            .select('id, username, full_name, bio, is_journal_public, is_methods_public, created_at')
            .eq('username', username)
            .maybeSingle();
        if (error) { this._handleError('getPublicProfile', error); return null; }
        return data || null;
    },

    /** Search user berdasarkan username/nama (hanya yang punya profil publik) */
    async searchUsers(query) {
        if (!query || query.length < 2) return [];
        const { data, error } = await this._db()
            .rpc('search_public_users', { query: query.trim() });
        if (error) { this._handleError('searchUsers', error); return []; }
        return data || [];
    },

    /** Ambil journal entries publik milik userId tertentu */
    async getPublicJournal(userId) {
        const { data, error } = await this._db()
            .from('journal_entries')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['tp', 'sl'])       // hanya closed trades
            .order('created_at', { ascending: false });
        if (error) { this._handleError('getPublicJournal', error); return []; }
        return (data || []).map(r => this._journalFromRow(r));
    },

    /** Ambil trading methods publik milik userId tertentu */
    async getPublicMethods(userId) {
        const { data, error } = await this._db()
            .from('trading_methods')
            .select('id, name, sop_entry, sop_exit, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
        if (error) { this._handleError('getPublicMethods', error); return []; }
        return (data || []).map(r => ({
            id:        r.id,
            name:      r.name,
            sopEntry:  r.sop_entry,
            sopExit:   r.sop_exit,
            createdAt: r.created_at,
        }));
    },
};

