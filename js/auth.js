/* ========================================
   AUTH.JS — Authentication via Supabase Auth
   Menggantikan custom JWT + 7 serverless API
   ======================================== */

const Auth = {
    /* ─── State ──────────────────────────── */
    currentUser: null,
    isLoggedIn: false,
    subscription: null,
    billingCycle: 'monthly',

    /* ─── Init ───────────────────────────── */
    async init() {
        this._cacheDOM();
        this._bindEvents();

        // Restore existing session dari Supabase
        const { data: { session } } = await window.DB.auth.getSession();
        if (session) {
            window._supabaseSession = session;
            await this._onSessionChange(session, false); // false = don't navigate yet
        }

        // Listen for auth state changes setelah initial load
        // (login, logout, token refresh, password recovery)
        window.DB.auth.onAuthStateChange(async (event, session) => {
            // INITIAL_SESSION sudah ditangani oleh getSession() di atas
            if (event === 'INITIAL_SESSION') return;

            window._supabaseSession = session;
            if (session) {
                await this._onSessionChange(session, true); // true = navigate to dashboard
            } else {
                this._onSignOut();
            }
        });

        this._handlePaymentReturn();
    },

    /* ─── Session Handler ────────────────── */
    async _onSessionChange(session, navigate = false) {
        const user = session.user;

        // Load profile from user_profiles table (include privacy fields)
        const { data: profile } = await window.DB
            .from('user_profiles')
            .select('*, subscriptions(plan, status, current_period_end)')
            .eq('id', user.id)
            .maybeSingle();

        this.currentUser = {
            id: user.id,
            email: user.email,
            fullName: profile?.full_name || user.user_metadata?.full_name || 'Trader',
            avatarUrl: profile?.avatar_url || null,
            plan: profile?.plan || 'free',
            emailVerified: user.email_confirmed_at ? true : false,
            createdAt: user.created_at,
            // Public profile fields
            username:         profile?.username          || null,
            bio:              profile?.bio               || '',
            isJournalPublic:  profile?.is_journal_public || false,
            isMethodsPublic:  profile?.is_methods_public || false,
        };

        // Attach subscription data
        if (profile?.subscriptions?.length > 0) {
            const sub = profile.subscriptions[0];
            this.subscription = sub;
            if (sub.status === 'active') {
                this.currentUser.subscriptionEnd = sub.current_period_end;
            }
        }

        this.isLoggedIn = true;
        this._updateUI();
        this.renderAccount();

        // Hanya navigate jika dipanggil dari onAuthStateChange (post-init)
        if (navigate && window.App) {
            App.navigateTo('dashboard');
            if (App.showPromoPopup) App.showPromoPopup();
        }
    },

    _onSignOut() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.subscription = null;
        window._supabaseSession = null;
        // Bersihkan realtime subscriptions
        if (typeof Storage !== 'undefined') Storage.unsubscribeAll();
        this._updateUI();
        if (window.App) App.navigateTo('login');
    },

    /* ─── DOM Cache ──────────────────────── */
    _cacheDOM() {
        this.loginEmail    = document.getElementById('login-email');
        this.loginPass     = document.getElementById('login-password');
        this.loginBtn      = document.getElementById('login-submit');
        this.loginAlert    = document.getElementById('login-alert');

        this.regName       = document.getElementById('reg-name');
        this.regEmail      = document.getElementById('reg-email');
        this.regPass       = document.getElementById('reg-password');
        this.regPassConf   = document.getElementById('reg-password-confirm');
        this.regBtn        = document.getElementById('reg-submit');
        this.regAlert      = document.getElementById('reg-alert');

        this.forgotEmail   = document.getElementById('forgot-email');
        this.forgotBtn     = document.getElementById('forgot-submit');
        this.forgotAlert   = document.getElementById('forgot-alert');

        this.resetPass     = document.getElementById('reset-password');
        this.resetConf     = document.getElementById('reset-confirm');
        this.resetBtn      = document.getElementById('reset-submit');
        this.resetAlert    = document.getElementById('reset-alert');

        this.accAvatar     = document.getElementById('acc-avatar');
        this.accName       = document.getElementById('acc-name');
        this.accEmail      = document.getElementById('acc-email');
        this.accPlanBadge  = document.getElementById('acc-plan-badge');
        this.accJoined     = document.getElementById('acc-joined');
        this.accPlanName   = document.getElementById('acc-plan-name');
        this.accSubEndRow  = document.getElementById('acc-sub-end-row');
        this.accSubEnd     = document.getElementById('acc-sub-end');

        this.topbarUser    = document.getElementById('topbar-user-btn');
        this.sidebarUserArea = document.getElementById('sidebar-user-area');
    },

    /* ─── Bind Events ────────────────────── */
    _bindEvents() {
        if (this.loginBtn)  this.loginBtn.addEventListener('click',  () => this.handleLogin());
        if (this.regBtn)    this.regBtn.addEventListener('click',    () => this.handleRegister());
        if (this.forgotBtn) this.forgotBtn.addEventListener('click', () => this.handleForgotPassword());
        if (this.resetBtn)  this.resetBtn.addEventListener('click',  () => this.handleResetPassword());

        document.querySelectorAll('#page-login .auth-field__input').forEach(input => {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleLogin(); });
        });
        document.querySelectorAll('#page-register .auth-field__input').forEach(input => {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') this.handleRegister(); });
        });

        // Save profile button
        document.getElementById('acc-save-profile')?.addEventListener('click', () => this.handleSaveProfile());
    },

    /* ─── LOGIN ──────────────────────────── */
    async handleLogin() {
        const email    = this.loginEmail?.value.trim();
        const password = this.loginPass?.value;
        this._hideAlert(this.loginAlert);

        if (!email || !password) return this._showAlert(this.loginAlert, 'Email dan password wajib diisi.', 'error');
        if (!this._validateEmail(email)) return this._showAlert(this.loginAlert, 'Format email tidak valid.', 'error');

        this._setLoading(this.loginBtn, 'Memproses...');
        try {
            const { data, error } = await window.DB.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // _onSessionChange akan dipanggil otomatis oleh onAuthStateChange
            App.showToast(`Selamat datang kembali! 👋`, 'success');
            App.navigateTo('dashboard');
        } catch (err) {
            this._showAlert(this.loginAlert, this._friendlyError(err.message), 'error');
        } finally {
            this._resetLoading(this.loginBtn, 'Masuk');
        }
    },

    /* ─── REGISTER ───────────────────────── */
    async handleRegister() {
        const fullName  = this.regName?.value.trim();
        const email     = this.regEmail?.value.trim();
        const pass      = this.regPass?.value;
        const passConf  = this.regPassConf?.value;
        this._hideAlert(this.regAlert);

        if (!fullName || !email || !pass || !passConf) return this._showAlert(this.regAlert, 'Semua field wajib diisi.', 'error');
        if (fullName.length < 2) return this._showAlert(this.regAlert, 'Nama minimal 2 karakter.', 'error');
        if (!this._validateEmail(email)) return this._showAlert(this.regAlert, 'Format email tidak valid.', 'error');
        if (pass.length < 6) return this._showAlert(this.regAlert, 'Password minimal 6 karakter.', 'error');
        if (pass !== passConf) return this._showAlert(this.regAlert, 'Password dan konfirmasi tidak cocok.', 'error');

        this._setLoading(this.regBtn, 'Mendaftarkan...');
        try {
            const { data, error } = await window.DB.auth.signUp({
                email,
                password: pass,
                options: {
                    data: { full_name: fullName },  // disimpan ke user_metadata
                    emailRedirectTo: `${window.location.origin}/app.html?verified=true`,
                },
            });
            if (error) throw error;

            // Update user_profiles.full_name (trigger handle_new_user harusnya sudah insert)
            if (data.user) {
                await window.DB.from('user_profiles').upsert({
                    id: data.user.id,
                    full_name: fullName,
                }, { onConflict: 'id' });
            }

            this._showAlert(this.regAlert,
                'Akun berhasil dibuat! Cek email Anda untuk verifikasi.',
                'success'
            );
            App.showToast('Registrasi berhasil! Cek inbox email Anda. 📧', 'success');

            // Jika auto-confirmed (dev mode), langsung navigasi
            if (data.session) {
                App.navigateTo('account');
            }
        } catch (err) {
            this._showAlert(this.regAlert, this._friendlyError(err.message), 'error');
        } finally {
            this._resetLoading(this.regBtn, 'Daftar Sekarang');
        }
    },

    /* ─── LOGOUT ─────────────────────────── */
    async logout() {
        await window.DB.auth.signOut();
        // _onSignOut akan dipanggil otomatis oleh onAuthStateChange
        App.showToast('Berhasil keluar.', 'success');
    },

    /* ─── FORGOT PASSWORD ────────────────── */
    async handleForgotPassword() {
        const email = this.forgotEmail?.value.trim();
        this._hideAlert(this.forgotAlert);

        if (!email) return this._showAlert(this.forgotAlert, 'Masukkan email terdaftar Anda.', 'error');
        if (!this._validateEmail(email)) return this._showAlert(this.forgotAlert, 'Format email tidak valid.', 'error');

        this._setLoading(this.forgotBtn, 'Memproses...');
        try {
            const { error } = await window.DB.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/app.html?route=reset-password`,
            });
            if (error) throw error;
            this._showAlert(this.forgotAlert, 'Link reset password telah dikirim ke email Anda.', 'success');
            if (this.forgotEmail) this.forgotEmail.value = '';
        } catch (err) {
            this._showAlert(this.forgotAlert, this._friendlyError(err.message), 'error');
        } finally {
            this._resetLoading(this.forgotBtn, 'Kirim Link Reset');
        }
    },

    /* ─── RESET PASSWORD ─────────────────── */
    async handleResetPassword() {
        const pass = this.resetPass?.value;
        const conf = this.resetConf?.value;
        this._hideAlert(this.resetAlert);

        if (!pass || !conf) return this._showAlert(this.resetAlert, 'Semua kolom password wajib diisi.', 'error');
        if (pass.length < 6) return this._showAlert(this.resetAlert, 'Password minimum 6 karakter.', 'error');
        if (pass !== conf) return this._showAlert(this.resetAlert, 'Konfirmasi password tidak cocok.', 'error');

        this._setLoading(this.resetBtn, 'Menyimpan...');
        try {
            const { error } = await window.DB.auth.updateUser({ password: pass });
            if (error) throw error;
            this._showAlert(this.resetAlert, 'Password berhasil diperbarui! Silakan login kembali.', 'success');
            if (this.resetPass) this.resetPass.value = '';
            if (this.resetConf) this.resetConf.value = '';
            setTimeout(() => App.navigateTo('login'), 2000);
        } catch (err) {
            this._showAlert(this.resetAlert, this._friendlyError(err.message), 'error');
        } finally {
            this._resetLoading(this.resetBtn, 'Simpan Password Baru');
        }
    },

    /* ─── RESEND VERIFICATION ────────────── */
    async resendVerification() {
        if (!this.currentUser?.email) return;
        try {
            const { error } = await window.DB.auth.resend({
                type: 'signup',
                email: this.currentUser.email,
                options: {
                    emailRedirectTo: `${window.location.origin}/app.html?verified=true`,
                },
            });
            if (error) throw error;
            App.showToast('Email verifikasi berhasil dikirim ulang! Cek inbox Anda.', 'success');
        } catch (err) {
            App.showToast(this._friendlyError(err.message), 'error');
        }
    },

    /* ─── UPGRADE PLAN ───────────────────── */
    async handleUpgrade(plan) {
        if (!this.isLoggedIn) {
            App.navigateTo('login');
            return App.showToast('Silakan login terlebih dahulu.', 'error');
        }

        const lynkLinks = {
            'basic':    'http://lynk.id/myassisten/2x5lm5ky5jmv/checkout',
            'basic_3mo':'http://lynk.id/myassisten/j6mx7em4rewe/checkout',
            'pro':      'http://lynk.id/myassisten/gewg1v749nml/checkout',
            'pro_3mo':  'http://lynk.id/myassisten/dq891kv8kvl4/checkout',
        };

        const checkoutUrl = lynkLinks[plan];
        if (checkoutUrl) {
            window.open(checkoutUrl, '_blank');
            App.showToast('Silakan selesaikan pembayaran di halaman Lynk.id.', 'success');
        } else {
            App.showToast('Link pembayaran belum tersedia.', 'error');
        }
    },

    /* ─── BILLING CYCLE TOGGLE ───────────── */
    toggleBillingCycle() {
        const toggle = document.getElementById('billing-toggle');
        const labels = document.querySelectorAll('.billing-toggle__label');
        this.billingCycle = this.billingCycle === 'monthly' ? 'quarterly' : 'monthly';
        toggle?.classList.toggle('active', this.billingCycle === 'quarterly');
        labels.forEach(l => l.classList.toggle('billing-toggle__label--active', l.dataset.cycle === this.billingCycle));
        document.querySelectorAll('.pricing-card[data-price-monthly]').forEach(card => {
            const priceEl = card.querySelector('.pricing-card__amount');
            const periodEl = card.querySelector('.pricing-card__period');
            if (priceEl) priceEl.textContent = card.dataset[`price${this.billingCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}`];
            if (periodEl) periodEl.textContent = card.dataset[`period${this.billingCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}`];
        });
    },

    /* ─── PAYMENT RETURN ─────────────────── */
    _handlePaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const payment = urlParams.get('payment');
        const page    = urlParams.get('page');
        const verified = urlParams.get('verified');

        if (verified === 'true') {
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => App.showToast('Email berhasil diverifikasi! ✅', 'success'), 500);
        }
        if (payment === 'success') {
            window.history.replaceState({}, '', window.location.pathname);
            setTimeout(() => {
                App.showToast('Pembayaran berhasil! Plan kamu sudah diupgrade. 🎉', 'success');
                if (page === 'account') App.navigateTo('account');
            }, 500);
        } else if (payment === 'cancelled') {
            window.history.replaceState({}, '', window.location.pathname);
            setTimeout(() => {
                App.showToast('Pembayaran dibatalkan.', 'error');
                if (page === 'account') App.navigateTo('account');
            }, 500);
        }
    },

    /* ─── RENDER ACCOUNT PAGE ────────────── */
    renderAccount() {
        if (!this.isLoggedIn || !this.currentUser) return;
        const u = this.currentUser;
        const initials = (u.fullName || 'TT').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        if (this.accAvatar)    this.accAvatar.textContent = initials;
        if (this.accName)      this.accName.textContent   = u.fullName;
        if (this.accEmail)     this.accEmail.textContent  = u.email;

        if (this.accPlanBadge) {
            const plan = u.plan || 'free';
            this.accPlanBadge.className = `account-info__plan-badge account-info__plan-badge--${plan}`;
            this.accPlanBadge.textContent = { free: '🆓 Free', basic: '⚡ Basic', pro: '👑 Pro' }[plan] || 'Free';
        }

        if (this.accJoined) {
            const d = new Date(u.createdAt);
            this.accJoined.textContent = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        if (this.accPlanName) {
            const planNames = { free: 'Free', basic: 'Basic ($1.99/bln)', pro: 'Pro ($5/bln)' };
            this.accPlanName.textContent = planNames[u.plan] || 'Free';
        }

        if (this.accSubEndRow && this.accSubEnd) {
            if (u.plan !== 'free' && u.subscriptionEnd) {
                this.accSubEndRow.style.display = '';
                this.accSubEnd.textContent = new Date(u.subscriptionEnd)
                    .toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                this.accSubEndRow.style.display = 'none';
            }
        }

        this._updatePricingButtons(u.plan || 'free');

        const verifyBanner = document.getElementById('email-verify-banner');
        if (verifyBanner) verifyBanner.style.display = u.emailVerified ? 'none' : 'block';

        // Privacy settings
        const usernameInput = document.getElementById('acc-username');
        const bioInput      = document.getElementById('acc-bio');
        const toggleJournal = document.getElementById('acc-toggle-journal');
        const toggleMethods = document.getElementById('acc-toggle-methods');
        const profileLink   = document.getElementById('acc-profile-link');

        if (usernameInput) usernameInput.value = u.username || '';
        if (bioInput)      bioInput.value      = u.bio || '';
        if (toggleJournal) toggleJournal.checked = !!u.isJournalPublic;
        if (toggleMethods) toggleMethods.checked = !!u.isMethodsPublic;
        if (profileLink && u.username) {
            const url = `${location.origin}/app.html#/u/${u.username}`;
            profileLink.href        = url;
            profileLink.textContent = url;
            profileLink.closest('.acc-profile-link-wrap')?.style.removeProperty('display');
        } else {
            profileLink?.closest('.acc-profile-link-wrap')?.style.setProperty('display', 'none');
        }
    },

    /* ─── SAVE PROFILE (username, bio, privacy) ── */
    async handleSaveProfile() {
        if (!this.isLoggedIn) return;
        const username        = document.getElementById('acc-username')?.value.trim().toLowerCase();
        const bio             = document.getElementById('acc-bio')?.value.trim();
        const isJournalPublic = document.getElementById('acc-toggle-journal')?.checked || false;
        const isMethodsPublic = document.getElementById('acc-toggle-methods')?.checked || false;

        // Validasi username
        if (username && !/^[a-z0-9_]{3,30}$/.test(username)) {
            App.showToast('Username hanya boleh huruf kecil, angka, underscore (3-30 karakter).', 'error');
            return;
        }

        const btn = document.getElementById('acc-save-profile');
        if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

        try {
            console.log('[Auth] Saving profile...', { username, bio, isJournalPublic, isMethodsPublic });
            const result = await Storage.updateProfile({ username, bio, isJournalPublic, isMethodsPublic });
            console.log('[Auth] updateProfile result:', result);

            if (result) {
                this.currentUser.username        = username || this.currentUser.username;
                this.currentUser.bio             = bio;
                this.currentUser.isJournalPublic = isJournalPublic;
                this.currentUser.isMethodsPublic = isMethodsPublic;
                this.renderAccount();
                App.showToast('✅ Profil berhasil disimpan!', 'success');
            } else {
                App.showToast('❌ Gagal menyimpan. Cek console untuk detail error.', 'error');
            }
        } catch (err) {
            console.error('[Auth] handleSaveProfile exception:', err);
            App.showToast('❌ Terjadi kesalahan. Coba lagi.', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Simpan Profil'; }
        }
    },

    /* ─── UPDATE PRICING BUTTONS ─────────── */
    _updatePricingButtons(currentPlan) {
        document.querySelectorAll('.pricing-card').forEach(card => {
            const plan = card.dataset.plan;
            const btn  = card.querySelector('.pricing-card__cta');
            if (!btn) return;
            if (plan === currentPlan) {
                btn.className = 'pricing-card__cta pricing-card__cta--current';
                btn.textContent = '✓ Plan Saat Ini';
                btn.disabled = true;
            } else {
                btn.disabled = false;
                if (plan === 'free')   { btn.className = 'pricing-card__cta pricing-card__cta--outline'; btn.textContent = 'Pilih Free'; }
                if (plan === 'basic')  { btn.className = 'pricing-card__cta pricing-card__cta--primary'; btn.textContent = 'Upgrade ke Basic'; }
                if (plan === 'pro')    { btn.className = 'pricing-card__cta pricing-card__cta--gold';    btn.textContent = 'Upgrade ke Pro'; }
            }
        });
    },

    /* ─── UI UPDATE ──────────────────────── */
    _updateUI() {
        if (this.topbarUser) {
            if (this.isLoggedIn && this.currentUser) {
                const name     = this.currentUser.fullName || 'TT';
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                this.topbarUser.innerHTML = `<span class="topbar__avatar">${initials}</span>`;
                this.topbarUser.title = name;
            } else {
                this.topbarUser.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                this.topbarUser.title = 'Login';
            }
        }

        if (this.sidebarUserArea) {
            if (this.isLoggedIn && this.currentUser) {
                const name     = this.currentUser.fullName || 'TT';
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                this.sidebarUserArea.innerHTML = `
                    <div class="sidebar-user" onclick="App.navigateTo('account')">
                        <div class="sidebar-user__avatar">${initials}</div>
                        <div class="sidebar-user__info">
                            <div class="sidebar-user__name">${name}</div>
                            <div class="sidebar-user__plan">${(this.currentUser.plan || 'free').toUpperCase()}</div>
                        </div>
                    </div>`;
            } else {
                this.sidebarUserArea.innerHTML = `
                    <button class="sidebar__link" onclick="App.navigateTo('login')">
                        <span class="sidebar__link-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        </span>
                        <span class="sidebar__link-text">Masuk / Daftar</span>
                    </button>`;
            }
        }
    },

    /* ─── HELPERS ────────────────────────── */
    _validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); },

    _friendlyError(msg = '') {
        if (msg.includes('Invalid login credentials'))  return 'Email atau password salah.';
        if (msg.includes('Email not confirmed'))        return 'Email belum diverifikasi. Cek inbox Anda.';
        if (msg.includes('User already registered'))    return 'Email sudah terdaftar. Silakan login.';
        if (msg.includes('Password should be'))        return 'Password minimal 6 karakter.';
        if (msg.includes('Unable to validate'))        return 'Link reset sudah kedaluwarsa. Minta ulang.';
        return msg || 'Terjadi kesalahan. Coba lagi.';
    },

    _setLoading(btn, text) {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = text;
    },

    _resetLoading(btn, text) {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = text;
    },

    _showAlert(el, msg, type) {
        if (!el) return;
        el.textContent = msg;
        el.className = `auth-alert visible auth-alert--${type}`;
    },

    _hideAlert(el) {
        if (!el) return;
        el.className = 'auth-alert';
    },
};
