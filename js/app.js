/* ========================================
   APP.JS - SPA Routing & Initialization
   ======================================== */

const App = {
    currentPage: 'backtest',

    // Page labels for topbar with SVG icons
    pageLabels: {
        dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Dashboard',
        backtest: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Backtest',
        sessions: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> Sesi Backtest',
        methods: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Metode Trading',
        calculator: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line></svg> Kalkulator Trade',
        journal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> Jurnal Trade',
        login: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Masuk',
        register: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Daftar',
        'forgot-password': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg> Lupa Password',
        'reset-password': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg> Reset Password',
        account: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Akun Saya',
        affiliate: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:bottom;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> Rekomendasi',
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
        this.initPricingSliders();

        // Check for password reset token in URL first
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('reset_token');
        
        if (resetToken) {
            this.currentResetToken = resetToken;
            // Clean up the URL for security/aesthetics without reloading
            window.history.replaceState({}, document.title, window.location.pathname);
            this.navigateTo('reset-password');
        } else if (Auth.isLoggedIn) {
            this.navigateTo('dashboard');
            // Note: showPromoPopup is now deferred and called by Auth._checkAPI() 
            // after the fresh plan data is pulled from the server.
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
        const publicPages = ['login', 'register', 'forgot-password', 'reset-password'];
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
            this.topbarLabel.innerHTML = this.pageLabels[page] || page;
        }

        // Hide specific elements like Sociabuzz button on certain pages
        if (['backtest', 'sessions', 'calculator'].includes(page)) {
            document.body.classList.add('hide-sociabuzz');
        } else {
            document.body.classList.remove('hide-sociabuzz');
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
       PRICING SLIDERS
       ========================================= */
    initPricingSliders() {
        const sliders = document.querySelectorAll('.pricing-slider');
        
        sliders.forEach(slider => {
            let currentSlide = 0;
            const slides = slider.querySelectorAll('.pricing-slider__slide');
            const dots = slider.querySelectorAll('.pricing-slider__dot');
            if(slides.length === 0) return;

            // Auto advance every 4 seconds
            setInterval(() => {
                // remove active class
                slides[currentSlide].classList.remove('active');
                if(dots[currentSlide]) dots[currentSlide].classList.remove('active');
                
                // next slide
                currentSlide = (currentSlide + 1) % slides.length;
                
                // add active class
                slides[currentSlide].classList.add('active');
                if(dots[currentSlide]) dots[currentSlide].classList.add('active');
            }, 4000);

            // Click dots to manual change
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => {
                    slides[currentSlide].classList.remove('active');
                    dots[currentSlide].classList.remove('active');
                    
                    currentSlide = index;
                    
                    slides[currentSlide].classList.add('active');
                    dots[currentSlide].classList.add('active');
                });
            });
        });
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
            tagline: 'Raih Pendanaan $200K+',
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
