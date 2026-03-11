/* ========================================
   APP.JS - SPA Routing & Initialization
   ======================================== */

const App = {
    currentPage: 'backtest',

    // Page labels for topbar
    pageLabels: {
        dashboard: '📊 Dashboard',
        backtest: '⚡ Backtest',
        sessions: '🗂️ Sesi Backtest',
        methods: '📋 Metode Trading',
        calculator: '🧮 Kalkulator Trade',
        journal: '📓 Jurnal Trade',
        login: '🔐 Masuk',
        register: '📝 Daftar',
        account: '👤 Akun Saya',
        affiliate: '⭐ Rekomendasi',
    },

    init() {
        this.cacheDOM();
        this.bindEvents();

        // Initialize modules
        Methods.init();
        Charts.init();
        Backtest.init();
        Sessions.init();
        Calculator.init();
        Journal.init();
        Dashboard.init();
        Auth.init();

        // Wire popup cancel btn
        const cancelBtn = document.getElementById('calc-popup-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => Calculator.closePopup());

        // Set initial page — require login
        if (Auth.isLoggedIn) {
            this.navigateTo('dashboard');
            // Show promo popup for free users
            this.showPromoPopup();
        } else {
            this.navigateTo('login');
        }
    },

    cacheDOM() {
        this.navLinks = document.querySelectorAll('.sidebar__link');
        this.pageViews = document.querySelectorAll('.page-view');
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('sidebar-overlay');
        this.hamburgerBtn = document.getElementById('hamburger-btn');
        this.closeBtn = document.getElementById('sidebar-close');
        this.topbarLabel = document.getElementById('topbar-page-label');
    },

    bindEvents() {
        // Nav links → navigate + close sidebar
        this.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const page = link.dataset.page;
                this.navigateTo(page);
                this.closeSidebar();
            });
        });

        // Hamburger → open sidebar
        this.hamburgerBtn.addEventListener('click', () => this.openSidebar());

        // Close button → close sidebar
        this.closeBtn.addEventListener('click', () => this.closeSidebar());

        // Overlay click → close sidebar
        this.overlay.addEventListener('click', () => this.closeSidebar());

        // Keyboard ESC → close sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSidebar();
        });
    },

    openSidebar() {
        this.sidebar.classList.add('open');
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    },

    navigateTo(page) {
        // Auth gate — block access if not logged in
        const publicPages = ['login', 'register'];
        if (!Auth.isLoggedIn && !publicPages.includes(page)) {
            page = 'login';
        }

        this.currentPage = page;

        // Update sidebar nav links
        this.navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Update page views
        this.pageViews.forEach(view => {
            view.classList.toggle('active', view.id === `page-${page}`);
        });

        // Update topbar page label
        if (this.topbarLabel) {
            this.topbarLabel.textContent = this.pageLabels[page] || page;
        }

        // Hide fixed TP/SL action bar when leaving backtest
        const fixedBar = document.getElementById('fixed-action-bar');
        if (fixedBar && page !== 'backtest') {
            fixedBar.style.display = 'none';
        }

        // Page-specific actions
        if (page === 'backtest' && Charts.equityChart) {
            setTimeout(() => Charts.equityChart.resize(), 50);
        }
        if (page === 'sessions') {
            Sessions.render();
        }
        if (page === 'calculator') {
            Calculator.refresh();
        }
        if (page === 'journal') {
            Journal.render();
        }
        if (page === 'dashboard') {
            Dashboard.render();
        }
        if (page === 'account') {
            Auth.renderAccount();
        }
    },

    /**
     * Toggles a password field's visibility
     */
    togglePassword(button) {
        const input = button.previousElementSibling;
        const icon = button.querySelector('svg');
        if (input.type === 'password') {
            input.type = 'text';
            icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
        } else {
            input.type = 'password';
            icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
        }
    },

    /**
     * Show a toast notification
     * @param {string} message
     * @param {'success'|'error'} type
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    },

    /* =========================================
       PROMO POPUP — random broker/prop firm
       for free users only, once per session
       ========================================= */
    _promoShown: false,

    PROMOS: [
        {
            type: 'broker',
            name: 'HFM',
            color: '#e31e24',
            banner: 'img/logo-hfm.png',
            tagline: 'Mulai Trading dengan Leverage 1:2000!',
            desc: 'Broker global terpercaya. Spread rendah, eksekusi cepat, deposit mulai $5.',
            features: ['Leverage 1:2000', 'Spread 0.0 pips', 'Copy Trading'],
            url: 'https://www.hfmtrade-ind.com/sv/id/?refid=30490470',
            btnText: 'Daftar HFM Sekarang'
        },
        {
            type: 'broker',
            name: 'Exness',
            color: '#fddb37',
            banner: 'img/logo-exness.png',
            tagline: 'Trading dengan Unlimited Leverage!',
            desc: 'Penarikan instan 24/7, regulasi FCA & CySEC, platform canggih.',
            features: ['Leverage Unlimited', 'Withdraw Instan', 'Regulasi FCA'],
            url: 'https://one.exnessonelink.com/a/uec6tfz843?source=app&platform=mobile&pid=mobile_share',
            btnText: 'Daftar Exness Sekarang'
        },
        {
            type: 'propfirm',
            name: 'Funding Pips',
            color: '#818cf8',
            banner: 'img/logo-fundingpips.png',
            tagline: 'Raih Pendanaan $200K+ 🚀',
            desc: '2-Step challenge tanpa batas waktu, fee refundable, profit split 80%+.',
            features: ['No Time Limit', 'Fee Refundable', 'Profit 80-90%'],
            url: 'https://app.fundingpips.com/register?ref=9F3EAD28',
            btnText: 'Ikut Challenge Sekarang'
        },
        {
            type: 'propfirm',
            name: 'The5%ers',
            color: '#34d399',
            banner: 'img/logo-the5ers.png',
            tagline: 'Prop Firm Terpercaya Sejak 2016',
            desc: 'Instant funding, scaling hingga $4M, profit split hingga 100%.',
            features: ['Instant Funding', 'Scale to $4M', 'Profit 80-100%'],
            url: 'https://www.the5ers.com/?afmc=18ea',
            btnText: 'Mulai Trading Sekarang'
        }
    ],

    showPromoPopup() {
        // Only for free users, once per session
        if (this._promoShown) return;
        const plan = PlanLimits.getPlan();
        if (plan !== 'free') return;
        if (['register', 'login'].includes(this.currentPage)) return;

        this._promoShown = true;

        const promo = this.PROMOS[Math.floor(Math.random() * this.PROMOS.length)];
        const overlay = document.getElementById('promo-popup-overlay');
        const content = document.getElementById('promo-popup-content');
        const closeBtn = document.getElementById('promo-popup-close');
        if (!overlay || !content) return;

        const typeLabel = promo.type === 'broker' ? '🏦 Broker' : '🛡️ Prop Firm';

        // Set banner as popup background
        const popup = document.getElementById('promo-popup');
        popup.style.backgroundImage = `url(${promo.banner})`;

        content.innerHTML = `
            <div class="promo-popup__logo-name" style="color:${promo.color}">${promo.name}</div>
            <div class="promo-popup__gradient">
                <div class="promo-popup__badge" style="background:${promo.color}20;color:${promo.color}">${typeLabel}</div>
                <div class="promo-popup__tagline">${promo.tagline}</div>
                <div class="promo-popup__desc">${promo.desc}</div>
                <div class="promo-popup__features">
                    ${promo.features.map(f => `<span class="promo-popup__feat">✅ ${f}</span>`).join('')}
                </div>
                <a href="${promo.url}" target="_blank" rel="noopener noreferrer" class="btn btn--primary promo-popup__cta" style="background:${promo.color}">
                    ${promo.btnText}
                </a>
                <button class="promo-popup__skip" id="promo-popup-skip">Nanti saja</button>
            </div>
        `;

        setTimeout(() => {
            overlay.classList.add('active');
        }, 1500); // delay 1.5s after page load

        const closeFn = () => {
            overlay.classList.remove('active');
        };

        closeBtn.addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeFn();
        });
        content.querySelector('#promo-popup-skip')?.addEventListener('click', closeFn);
    }
};

// ====== Boot ======
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
