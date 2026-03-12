/* ========================================
   AUTH.JS — Authentication Module
   Connects to real API endpoints on Vercel
   Falls back to demo mode if API unavailable
   ======================================== */

const Auth = {
    /* ---------- State ---------- */
    currentUser: null,
    isLoggedIn: false,
    token: null,
    isOnline: false, // true when API is available
    billingCycle: 'monthly', // 'monthly' or 'quarterly'

    /* ---------- Init ---------- */
    init() {
        // Load saved token
        this.token = localStorage.getItem('tt_token');
        const saved = localStorage.getItem('tt_user');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
                this.isLoggedIn = true;
            } catch (e) { /* ignore */ }
        }

        this._cacheDOM();
        this._bindEvents();
        this._updateUI();

        // Check if API is available (async, non-blocking)
        this._checkAPI();

        // Handle payment return
        this._handlePaymentReturn();
    },

    /* ---------- Check API availability ---------- */
    async _checkAPI() {
        try {
            const resp = await fetch('/api/auth/me', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer test' }
            });
            // If we get any response (even 401), API is online
            this.isOnline = true;

            // If we have a token, refresh user data
            if (this.token) {
                const r = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (r.ok) {
                    const data = await r.json();
                    this.currentUser = data.user;
                    this.isLoggedIn = true;
                    // Inject subscription data directly into the user object so it's globally available
                    if (data.subscription) {
                        this.currentUser.subscriptionEnd = data.subscription.current_period_end || data.user.subscriptionEnd;
                        this.subscription = data.subscription;
                    }
                    localStorage.setItem('tt_user', JSON.stringify(this.currentUser));
                    this._updateUI();
                    this.renderAccount();
                    
                    // Trigger popup only after we've confirmed the plan from the DB
                    if (window.App && App.showPromoPopup) {
                        App.showPromoPopup();
                    }
                }
            }
        } catch (e) {
            // API not available — use demo mode
            this.isOnline = false;
        }
    },

    /* ---------- Cache DOM ---------- */
    _cacheDOM() {
        this.loginEmail = document.getElementById('login-email');
        this.loginPass = document.getElementById('login-password');
        this.loginBtn = document.getElementById('login-submit');
        this.loginAlert = document.getElementById('login-alert');

        this.regName = document.getElementById('reg-name');
        this.regEmail = document.getElementById('reg-email');
        this.regPass = document.getElementById('reg-password');
        this.regPassConf = document.getElementById('reg-password-confirm');
        this.regBtn = document.getElementById('reg-submit');
        this.regAlert = document.getElementById('reg-alert');

        this.forgotEmail = document.getElementById('forgot-email');
        this.forgotBtn = document.getElementById('forgot-submit');
        this.forgotAlert = document.getElementById('forgot-alert');

        this.resetPass = document.getElementById('reset-password');
        this.resetConf = document.getElementById('reset-confirm');
        this.resetBtn = document.getElementById('reset-submit');
        this.resetAlert = document.getElementById('reset-alert');

        this.accAvatar = document.getElementById('acc-avatar');
        this.accName = document.getElementById('acc-name');
        this.accEmail = document.getElementById('acc-email');
        this.accPlanBadge = document.getElementById('acc-plan-badge');
        this.accJoined = document.getElementById('acc-joined');
        this.accPlanName = document.getElementById('acc-plan-name');

        this.topbarUser = document.getElementById('topbar-user-btn');
        this.sidebarUserArea = document.getElementById('sidebar-user-area');
        this.accSubEndRow = document.getElementById('acc-sub-end-row');
        this.accSubEnd = document.getElementById('acc-sub-end');
    },

    /* ---------- Bind Events ---------- */
    _bindEvents() {
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.handleLogin());
        }
        if (this.regBtn) {
            this.regBtn.addEventListener('click', () => this.handleRegister());
        }
        if (this.forgotBtn) {
            this.forgotBtn.addEventListener('click', () => this.handleForgotPassword());
        }
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.handleResetPassword());
        }

        document.querySelectorAll('#page-login .auth-field__input').forEach(input => {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleLogin(); });
        });
        document.querySelectorAll('#page-register .auth-field__input').forEach(input => {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleRegister(); });
        });
    },

    /* ---------- Password Recovery ---------- */
    async handleForgotPassword() {
        const email = this.forgotEmail?.value.trim();
        this._hideAlert(this.forgotAlert);

        if (!email) {
            return this._showAlert(this.forgotAlert, 'Masukkan email terdaftar Anda.', 'error');
        }
        if (!this._validateEmail(email)) {
            return this._showAlert(this.forgotAlert, 'Format email tidak valid.', 'error');
        }

        this.forgotBtn.disabled = true;
        this.forgotBtn.textContent = 'Memproses...';
        
        try {
            if (this.isOnline) {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Terjadi kesalahan sistem');
                }
                
                this._showAlert(this.forgotAlert, data.message, 'success');
                this.forgotEmail.value = ''; // clear visual
            } else {
                // Demo Mode
                setTimeout(() => {
                    this._showAlert(this.forgotAlert, 'Link reset password simulasi berhasil dikirim ke email.', 'success');
                }, 1000);
            }
        } catch (e) {
            this._showAlert(this.forgotAlert, e.message, 'error');
        } finally {
            this.forgotBtn.disabled = false;
            this.forgotBtn.textContent = 'Kirim Link Reset';
        }
    },

    async handleResetPassword() {
        const pass = this.resetPass?.value;
        const conf = this.resetConf?.value;
        this._hideAlert(this.resetAlert);

        // Retrieve token passed from App.js URL parsing
        const token = window.App?.currentResetToken;
        
        if (!token) {
            return this._showAlert(this.resetAlert, 'Sesi reset password tidak valid. Silakan ulangi proses Lupa Password.', 'error');
        }
        if (!pass || !conf) {
            return this._showAlert(this.resetAlert, 'Semua kolom password wajib diisi.', 'error');
        }
        if (pass.length < 6) {
            return this._showAlert(this.resetAlert, 'Password minimum 6 karakter.', 'error');
        }
        if (pass !== conf) {
            return this._showAlert(this.resetAlert, 'Konfirmasi password tidak cocok.', 'error');
        }

        this.resetBtn.disabled = true;
        this.resetBtn.textContent = 'Menyimpan...';

        try {
            if (this.isOnline) {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password: pass })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Terjadi kesalahan sistem');
                }
                
                this._showAlert(this.resetAlert, 'Password berhasil diperbarui. Silakan login kembali.', 'success');
                this.resetPass.value = '';
                this.resetConf.value = '';
                
                // Navigate to login after successful reset
                setTimeout(() => {
                    if (window.App) {
                        App.currentResetToken = null; // Clear token state
                        App.navigateTo('login');
                    }
                }, 2000);

            } else {
                // Demo Mode
                setTimeout(() => {
                    this._showAlert(this.resetAlert, 'Simulasi berhasil disimpan.', 'success');
                }, 1000);
            }
        } catch (e) {
            this._showAlert(this.resetAlert, e.message, 'error');
        } finally {
            this.resetBtn.disabled = false;
            this.resetBtn.textContent = 'Simpan Password Baru';
        }
    },

    /* ---------- Login ---------- */
    async handleLogin() {
        const email = this.loginEmail?.value.trim();
        const password = this.loginPass?.value;

        this._hideAlert(this.loginAlert);

        if (!email || !password) {
            return this._showAlert(this.loginAlert, 'Email dan password wajib diisi.', 'error');
        }
        if (!this._validateEmail(email)) {
            return this._showAlert(this.loginAlert, 'Format email tidak valid.', 'error');
        }

        this.loginBtn.disabled = true;
        this.loginBtn.textContent = 'Memproses...';

        try {
            if (this.isOnline) {
                // --- REAL API ---
                const resp = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await resp.json();

                if (!resp.ok) {
                    this._showAlert(this.loginAlert, data.error || 'Login gagal.', 'error');
                    this.loginBtn.disabled = false;
                    this.loginBtn.textContent = 'Masuk';
                    return;
                }

                this.token = data.token;
                this.currentUser = data.user;
                this.isLoggedIn = true;
                
                if (data.subscription) {
                    this.currentUser.subscriptionEnd = data.subscription.current_period_end || data.user.subscriptionEnd;
                    this.subscription = data.subscription;
                }
                
                localStorage.setItem('tt_token', data.token);
                localStorage.setItem('tt_user', JSON.stringify(this.currentUser));
            } else {
                // --- DEMO MODE ---
                await this._demoLogin(email, password);
            }

            this._updateUI();
            this.loginBtn.disabled = false;
            this.loginBtn.textContent = 'Masuk';
            App.navigateTo('dashboard');
            App.showToast('Selamat datang kembali, ' + this.currentUser.fullName + '!', 'success');

        } catch (err) {
            this._showAlert(this.loginAlert, 'Koneksi gagal. Coba lagi.', 'error');
            this.loginBtn.disabled = false;
            this.loginBtn.textContent = 'Masuk';
        }
    },

    /* ---------- Register ---------- */
    async handleRegister() {
        const fullName = this.regName?.value.trim();
        const email = this.regEmail?.value.trim();
        const pass = this.regPass?.value;
        const passConf = this.regPassConf?.value;

        this._hideAlert(this.regAlert);

        if (!fullName || !email || !pass || !passConf) {
            return this._showAlert(this.regAlert, 'Semua field wajib diisi.', 'error');
        }
        if (fullName.length < 2) {
            return this._showAlert(this.regAlert, 'Nama minimal 2 karakter.', 'error');
        }
        if (!this._validateEmail(email)) {
            return this._showAlert(this.regAlert, 'Format email tidak valid.', 'error');
        }
        if (pass.length < 6) {
            return this._showAlert(this.regAlert, 'Password minimal 6 karakter.', 'error');
        }
        if (pass !== passConf) {
            return this._showAlert(this.regAlert, 'Password dan konfirmasi tidak cocok.', 'error');
        }

        this.regBtn.disabled = true;
        this.regBtn.textContent = 'Mendaftarkan...';

        try {
            if (this.isOnline) {
                // --- REAL API ---
                const resp = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: pass, fullName })
                });

                const data = await resp.json();

                if (!resp.ok) {
                    this._showAlert(this.regAlert, data.error || 'Registrasi gagal.', 'error');
                    this.regBtn.disabled = false;
                    this.regBtn.textContent = 'Daftar Sekarang';
                    return;
                }

                this.token = data.token;
                this.currentUser = data.user;
                this.isLoggedIn = true;
                localStorage.setItem('tt_token', data.token);
                localStorage.setItem('tt_user', JSON.stringify(data.user));
            } else {
                // --- DEMO MODE ---
                await this._demoRegister(fullName, email, pass);
            }

            this._updateUI();
            this.regBtn.disabled = false;
            this.regBtn.textContent = 'Daftar Sekarang';
            App.navigateTo('account');
            App.showToast('Akun berhasil dibuat! Selamat datang, ' + this.currentUser.fullName + ' 🎉', 'success');

        } catch (err) {
            this._showAlert(this.regAlert, 'Koneksi gagal. Coba lagi.', 'error');
            this.regBtn.disabled = false;
            this.regBtn.textContent = 'Daftar Sekarang';
        }
    },

    /* ---------- Logout ---------- */
    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.token = null;
        localStorage.removeItem('tt_token');
        localStorage.removeItem('tt_user');
        this._updateUI();
        App.navigateTo('login');
        App.showToast('Berhasil keluar.', 'success');
    },

    /* ---------- Toggle Billing Cycle ---------- */
    toggleBillingCycle() {
        const toggle = document.getElementById('billing-toggle');
        const labels = document.querySelectorAll('.billing-toggle__label');

        this.billingCycle = this.billingCycle === 'monthly' ? 'quarterly' : 'monthly';

        // Toggle switch animation
        toggle.classList.toggle('active', this.billingCycle === 'quarterly');

        // Update label states
        labels.forEach(label => {
            label.classList.toggle('billing-toggle__label--active', label.dataset.cycle === this.billingCycle);
        });

        // Update pricing cards
        document.querySelectorAll('.pricing-card[data-price-monthly]').forEach(card => {
            const priceEl = card.querySelector('.pricing-card__amount');
            const periodEl = card.querySelector('.pricing-card__period');
            if (priceEl) priceEl.textContent = card.dataset[`price${this.billingCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}`];
            if (periodEl) periodEl.textContent = card.dataset[`period${this.billingCycle === 'quarterly' ? 'Quarterly' : 'Monthly'}`];
        });
    },

    /* ---------- Upgrade Plan (Lynk.id) ---------- */
    async handleUpgrade(plan) {
        if (!this.isLoggedIn) {
            App.navigateTo('login');
            return App.showToast('Silakan login terlebih dahulu.', 'error');
        }

        // Dictionary of plan IDs mapped to Lynk.id checkout URLs
        const lynkLinks = {
            'basic': 'http://lynk.id/myassisten/2x5lm5ky5jmv/checkout',
            'basic_3mo': 'http://lynk.id/myassisten/j6mx7em4rewe/checkout',
            'pro': 'http://lynk.id/myassisten/gewg1v749nml/checkout',
            'pro_3mo': 'http://lynk.id/myassisten/dq891kv8kvl4/checkout'
        };

        if (this.isOnline) {
            const checkoutUrl = lynkLinks[plan];
            if (checkoutUrl && checkoutUrl !== '#') {
                // Redirect user to Lynk.id checkout page in new tab or current tab
                window.open(checkoutUrl, '_blank');
            } else {
                App.showToast('Mohon maaf, link pembayaran untuk paket ini sedang disiapkan.', 'error');
            }
        } else {
            // --- DEMO MODE ---
            const prices = { basic: '$1.99/bln', basic_3mo: '$2.99/3bln', pro: '$5/bln', pro_3mo: '$7.50/3bln' };
            const planName = plan.replace('_3mo', ' (3 Bulan)').replace(/^\w/, c => c.toUpperCase());
            App.showToast(`[Demo] Upgrade ke ${planName} (${prices[plan]})`, 'success');

            // Store base plan (basic or pro)
            const basePlan = plan.replace('_3mo', '');
            this.currentUser.plan = basePlan;
            
            // Calculate Expiry Date for Demo
            const isQuarterly = plan.includes('_3mo');
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + (isQuarterly ? 3 : 1));
            this.currentUser.subscriptionEnd = expiryDate.toISOString();

            localStorage.setItem('tt_user', JSON.stringify(this.currentUser));
            
            // Perbarui list user
            const users = JSON.parse(localStorage.getItem('tt_users') || '[]');
            const idx = users.findIndex(u => u.email === this.currentUser.email);
            if(idx !== -1) {
                users[idx].plan = basePlan;
                users[idx].subscriptionEnd = this.currentUser.subscriptionEnd;
                localStorage.setItem('tt_users', JSON.stringify(users));
            }

            this.renderAccount();
            this._updateUI();
        }
    },

    /* ---------- Handle Payment Return ---------- */
    _handlePaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const payment = urlParams.get('payment');
        const page = urlParams.get('page');

        if (payment === 'success') {
            setTimeout(() => {
                App.showToast('Pembayaran berhasil! Plan kamu sudah diupgrade. 🎉', 'success');
                if (page === 'account') App.navigateTo('account');
                // Refresh user data
                this._checkAPI();
            }, 500);
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        } else if (payment === 'cancelled') {
            setTimeout(() => {
                App.showToast('Pembayaran dibatalkan.', 'error');
                if (page === 'account') App.navigateTo('account');
            }, 500);
            window.history.replaceState({}, '', window.location.pathname);
        }
    },

    /* ---------- Render Account Page ---------- */
    renderAccount() {
        if (!this.isLoggedIn || !this.currentUser) return;

        const u = this.currentUser;
        const initials = (u.fullName || u.full_name || 'TT').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

        if (this.accAvatar) this.accAvatar.textContent = initials;
        if (this.accName) this.accName.textContent = u.fullName || u.full_name;
        if (this.accEmail) this.accEmail.textContent = u.email;

        if (this.accPlanBadge) {
            const plan = u.plan || 'free';
            this.accPlanBadge.className = 'account-info__plan-badge account-info__plan-badge--' + plan;
            const labels = { free: '🆓 Free', basic: '⚡ Basic', pro: '👑 Pro' };
            this.accPlanBadge.textContent = labels[plan] || 'Free';
        }

        if (this.accJoined) {
            const d = new Date(u.createdAt || u.created_at);
            this.accJoined.textContent = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        if (this.accPlanName) {
            const planNames = { free: 'Free', basic: 'Basic ($1.99/bln)', pro: 'Pro ($5/bln)' };
            this.accPlanName.textContent = planNames[u.plan] || 'Free';
        }

        // Subscription end date
        if (this.accSubEndRow && this.accSubEnd) {
            // Check possible keys for subscription end
            const subEnd = u.subscriptionEnd || u.subscription_end || (window.Auth && window.Auth.subscription ? window.Auth.subscription.current_period_end : null);
            
            if (u.plan !== 'free') {
                this.accSubEndRow.style.display = '';
                if (subEnd) {
                    const d = new Date(subEnd);
                    this.accSubEnd.textContent = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                } else {
                    this.accSubEnd.textContent = 'Aktif';
                }
            } else {
                this.accSubEndRow.style.display = 'none';
            }
        }

        this._updatePricingButtons(u.plan || 'free');
    },

    /* ---------- Update Pricing Buttons ---------- */
    _updatePricingButtons(currentPlan) {
        document.querySelectorAll('.pricing-card').forEach(card => {
            const plan = card.dataset.plan;
            const btn = card.querySelector('.pricing-card__cta');
            if (!btn) return;

            if (plan === currentPlan) {
                btn.className = 'pricing-card__cta pricing-card__cta--current';
                btn.textContent = '✓ Plan Saat Ini';
                btn.disabled = true;
            } else {
                btn.disabled = false;
                if (plan === 'free') {
                    btn.className = 'pricing-card__cta pricing-card__cta--outline';
                    btn.textContent = 'Pilih Free';
                } else if (plan === 'basic') {
                    btn.className = 'pricing-card__cta pricing-card__cta--primary';
                    btn.textContent = 'Upgrade ke Basic';
                } else if (plan === 'pro') {
                    btn.className = 'pricing-card__cta pricing-card__cta--gold';
                    btn.textContent = 'Upgrade ke Pro';
                }
            }
        });
    },

    /* ---------- UI Update ---------- */
    _updateUI() {
        if (this.topbarUser) {
            if (this.isLoggedIn && this.currentUser) {
                const name = this.currentUser.fullName || this.currentUser.full_name || 'TT';
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
                const name = this.currentUser.fullName || this.currentUser.full_name || 'TT';
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
                    <button class="sidebar__link" data-page="login" onclick="App.navigateTo('login')">
                        <span class="sidebar__link-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                <polyline points="10 17 15 12 10 7"/>
                                <line x1="15" y1="12" x2="3" y2="12"/>
                            </svg>
                        </span>
                        <span class="sidebar__link-text">Masuk / Daftar</span>
                    </button>`;
            }
        }
    },

    /* ==============================
       DEMO MODE FALLBACK
       Used when API is not available
       ============================== */
    async _demoLogin(email, password) {
        const users = JSON.parse(localStorage.getItem('tt_users') || '[]');
        const user = users.find(u => u.email === email);
        if (!user || user.password !== this._simpleHash(password)) {
            throw new Error('Invalid credentials');
        }
        user.lastLoginAt = new Date().toISOString();
        this.currentUser = { fullName: user.fullName, email: user.email, plan: user.plan, createdAt: user.createdAt };
        this.isLoggedIn = true;
        localStorage.setItem('tt_user', JSON.stringify(this.currentUser));
        const idx = users.findIndex(u => u.email === email);
        users[idx] = user;
        localStorage.setItem('tt_users', JSON.stringify(users));
    },

    async _demoRegister(fullName, email, password) {
        const users = JSON.parse(localStorage.getItem('tt_users') || '[]');
        if (users.find(u => u.email === email)) throw new Error('Email exists');
        const newUser = {
            id: Date.now().toString(36),
            email, password: this._simpleHash(password), fullName,
            plan: 'free', createdAt: new Date().toISOString()
        };
        users.push(newUser);
        localStorage.setItem('tt_users', JSON.stringify(users));
        this.currentUser = { fullName, email, plan: 'free', createdAt: newUser.createdAt };
        this.isLoggedIn = true;
        localStorage.setItem('tt_user', JSON.stringify(this.currentUser));
    },

    /* ---------- Helpers ---------- */
    _validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); },
    _simpleHash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return 'h_' + Math.abs(h).toString(36); },
    _showAlert(el, msg, type) { if (!el) return; el.textContent = msg; el.className = `auth-alert visible auth-alert--${type}`; },
    _hideAlert(el) { if (!el) return; el.className = 'auth-alert'; }
};
